import os
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlmodel import Session, select
from typing import List
import ipaddress
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
