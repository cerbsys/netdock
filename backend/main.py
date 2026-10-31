import os
import json
import socket
import http.client
import ipaddress
from typing import List

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlmodel import Session, select

from database import init_db, get_session
from models import Host, Subnet, Service

app = FastAPI(title="NetDock API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    init_db()

# --- Subnet Routes ---
@app.get("/api/v1/subnets", response_model=List[Subnet])
def list_subnets(session: Session = Depends(get_session)):
    return session.exec(select(Subnet)).all()

@app.post("/api/v1/subnets", response_model=Subnet)
def create_subnet(subnet: Subnet, session: Session = Depends(get_session)):
    session.add(subnet)
    session.commit()
    session.refresh(subnet)
    return subnet

@app.delete("/api/v1/subnets/{subnet_id}")
def delete_subnet(subnet_id: str, session: Session = Depends(get_session)):
    subnet = session.get(Subnet, subnet_id)
    if not subnet:
        raise HTTPException(status_code=404, detail="Subnet not found")

    assigned_hosts = session.exec(select(Host).where(Host.subnet_id == subnet_id)).all()
    if assigned_hosts:
        hostnames = ", ".join(h.hostname for h in assigned_hosts)
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete subnet '{subnet.name}'. Assigned hosts exist: {hostnames}"
        )

    session.delete(subnet)
    session.commit()
    return {"status": "deleted", "id": subnet_id}

# --- Host Routes ---
@app.get("/api/v1/hosts", response_model=List[Host])
def list_hosts(session: Session = Depends(get_session)):
    return session.exec(select(Host)).all()

@app.post("/api/v1/hosts", response_model=Host)
def create_host(host: Host, session: Session = Depends(get_session)):
    subnet = session.get(Subnet, host.subnet_id)
    if not subnet:
        raise HTTPException(status_code=400, detail=f"Subnet '{host.subnet_id}' does not exist.")

    net = ipaddress.IPv4Network(subnet.cidr, strict=True)
    host_addr = ipaddress.IPv4Address(host.ip)

    if host_addr not in net:
        raise HTTPException(
            status_code=400,
            detail=f"IP {host.ip} does not fall within subnet {subnet.name} ({subnet.cidr})."
        )

    if host_addr == net.network_address:
        raise HTTPException(
            status_code=400,
            detail=f"IP {host.ip} is the subnet network address (.0)."
        )

    if host_addr == net.broadcast_address:
        raise HTTPException(
            status_code=400,
            detail=f"IP {host.ip} is the subnet broadcast address (.255)."
        )

    existing_ip = session.exec(select(Host).where(Host.ip == host.ip)).first()
    if existing_ip:
        raise HTTPException(
            status_code=400,
            detail=f"IP {host.ip} is already assigned to host '{existing_ip.hostname}'."
        )

    session.add(host)
    session.commit()
    session.refresh(host)
    return host

@app.put("/api/v1/hosts/{host_id}", response_model=Host)
def update_host(host_id: str, updated_data: Host, session: Session = Depends(get_session)):
    host = session.get(Host, host_id)
    if not host:
        raise HTTPException(status_code=404, detail="Host not found")
    host_data = updated_data.model_dump(exclude_unset=True)
    for key, value in host_data.items():
        setattr(host, key, value)
    session.add(host)
    session.commit()
    session.refresh(host)
    return host

@app.delete("/api/v1/hosts/{host_id}")
def delete_host(host_id: str, session: Session = Depends(get_session)):
    host = session.get(Host, host_id)
    if not host:
        raise HTTPException(status_code=404, detail="Host not found")
    session.delete(host)
    session.commit()
    return {"status": "deleted", "id": host_id}

# --- Docker Raw Socket HTTP Client (Standard Library) ---
class UnixSocketHTTPConnection(http.client.HTTPConnection):
    def __init__(self, socket_path):
        super().__init__("localhost")
        self.socket_path = socket_path

    def connect(self):
        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.sock.connect(self.socket_path)

def query_docker_socket(path="/containers/json?all=1"):
    conn = UnixSocketHTTPConnection("/var/run/docker.sock")
    try:
        conn.request("GET", path)
        res = conn.getresponse()
        if res.status != 200:
            raise Exception(f"Docker daemon returned HTTP {res.status}")
        data = res.read().decode("utf-8")
        return json.loads(data)
    finally:
        conn.close()

# --- Docker Sync Endpoint ---
@app.post("/api/v1/integrations/docker/sync")
def sync_docker_containers(session: Session = Depends(get_session)):
    try:
        containers = query_docker_socket()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to access Docker socket: {str(e)}"
        )

    synced_hosts = []
    try:
        existing_subnets = session.exec(select(Subnet)).all()
        default_subnet_id = existing_subnets[0].id if existing_subnets else ""

        for c in containers:
            raw_names = c.get("Names", [])
            name = raw_names[0].lstrip("/") if raw_names else c.get("Id", "")[:12]
            status = "active" if c.get("State") == "running" else "inactive"

            ip_address = ""
            mac_address = ""
            networks = c.get("NetworkSettings", {}).get("Networks", {})
            for net_name, net_data in networks.items():
                if net_data.get("IPAddress"):
                    ip_address = net_data.get("IPAddress")
                    mac_address = net_data.get("MacAddress", "")
                    break

            if not ip_address:
                ip_address = "127.0.0.1"

            matched_subnet_id = default_subnet_id
            for s in existing_subnets:
                try:
                    if ipaddress.IPv4Address(ip_address) in ipaddress.IPv4Network(s.cidr, strict=False):
                        matched_subnet_id = s.id
                        break
                except ValueError:
                    continue

            existing = session.exec(select(Host).where(Host.hostname == name)).first()
            image_name = c.get("Image", "unknown")
            created_epoch = c.get("Created", 0)

            if not existing:
                new_entry = Host(
                    id=f"cnt-{c.get('Id', '')[:10]}",
                    hostname=name,
                    ip=ip_address,
                    mac=mac_address,
                    os=f"Docker: {image_name}",
                    device_type="container",
                    status=status,
                    subnet_id=matched_subnet_id,
                    parent_id="cerberus",
                    notes=f"Auto-synced from Docker daemon. Epoch: {created_epoch}"
                )
                session.add(new_entry)
                synced_hosts.append(name)
            else:
                existing.status = status
                if ip_address != "127.0.0.1":
                    existing.ip = ip_address
                if mac_address:
                    existing.mac = mac_address
                session.add(existing)
                synced_hosts.append(name)

        session.commit()
    except Exception as err:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Database sync error: {str(err)}")

    return {
        "status": "success",
        "total_discovered": len(containers),
        "synced_count": len(synced_hosts),
        "containers": synced_hosts
    }

# --- Backup / Restore Routes ---
@app.get("/api/v1/export")
def export_database(session: Session = Depends(get_session)):
    return {
        "subnets": [s.model_dump() for s in session.exec(select(Subnet)).all()],
        "hosts": [h.model_dump() for h in session.exec(select(Host)).all()],
        "services": [srv.model_dump() for srv in session.exec(select(Service)).all()]
    }

@app.post("/api/v1/import")
def import_database(payload: dict, session: Session = Depends(get_session)):
    for srv in session.exec(select(Service)).all():
        session.delete(srv)
    for h in session.exec(select(Host)).all():
        session.delete(h)
    for s in session.exec(select(Subnet)).all():
        session.delete(s)
    session.commit()

    for s_data in payload.get("subnets", []):
        session.add(Subnet(**s_data))
    for h_data in payload.get("hosts", []):
        session.add(Host(**h_data))
    for srv_data in payload.get("services", []):
        session.add(Service(**srv_data))
    session.commit()
    return {"status": "success", "imported": True}

# --- Static Frontend Serving ---
STATIC_DIR = "/app/static"
if os.path.exists(STATIC_DIR):
    if os.path.exists(os.path.join(STATIC_DIR, "assets")):
        app.mount("/assets", StaticFiles(directory=os.path.join(STATIC_DIR, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        target = os.path.join(STATIC_DIR, full_path)
        if os.path.isfile(target):
            return FileResponse(target)
        return FileResponse(os.path.join(STATIC_DIR, "index.html"))
