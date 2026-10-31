import os
import json
import socket
import http.client
import ipaddress
import hashlib
import secrets
import time
from typing import List, Optional

from fastapi import FastAPI, Depends, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse, RedirectResponse
from sqlmodel import Session, select

from database import init_db, get_session, engine
from models import Host, Subnet, Service, Operator

def hash_secret(secret: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac("sha256", secret.encode(), salt.encode(), 100000).hex()

VALID_SESSIONS = set()

SETUP_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NETDOCK // INITIAL PROVISIONING</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #14141b;
      color: #f4f4f5;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 1.5rem;
    }
    .chassis {
      background: #1a1a24;
      border: 2px solid #54546c;
      width: 100%;
      max-width: 440px;
      position: relative;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.85);
    }
    .amber-strip {
      background: #fbbf24;
      height: 4px;
      width: 100%;
    }
    .card-body { padding: 2rem; }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #54546c;
      padding-bottom: 1rem;
      margin-bottom: 1.5rem;
    }
    .title {
      color: #fbbf24;
      font-size: 0.95rem;
      font-weight: 900;
      letter-spacing: 0.12em;
      display: flex;
      align-items: center;
      gap: 0.6rem;
    }
    .indicator {
      width: 9px;
      height: 9px;
      background: #fbbf24;
      box-shadow: 0 0 8px #fbbf24;
    }
    .badge {
      font-size: 0.68rem;
      color: #000;
      background: #fbbf24;
      font-weight: 900;
      padding: 0.15rem 0.45rem;
      border: 1px solid #f59e0b;
      letter-spacing: 0.05em;
    }
    .notice {
      background: #232332;
      border-left: 3px solid #fbbf24;
      padding: 0.75rem 1rem;
      font-size: 0.72rem;
      color: #d4d4d8;
      line-height: 1.4;
      margin-bottom: 1.5rem;
    }
    .field { margin-bottom: 1.25rem; }
    label {
      display: block;
      font-size: 0.72rem;
      font-weight: 800;
      color: #a1a1aa;
      margin-bottom: 0.45rem;
      letter-spacing: 0.08em;
    }
    input {
      width: 100%;
      background: #29293a;
      border: 2px solid #60607a;
      color: #ffffff;
      padding: 0.7rem 0.85rem;
      font-size: 0.85rem;
      font-family: inherit;
      outline: none;
      transition: all 0.15s ease-in-out;
    }
    input:focus {
      border-color: #fbbf24;
      background: #333346;
      box-shadow: 0 0 0 1px #fbbf24;
    }
    button {
      width: 100%;
      background: #fbbf24;
      color: #000;
      font-weight: 900;
      font-size: 0.8rem;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      padding: 0.85rem 1rem;
      border: 2px solid #f59e0b;
      cursor: pointer;
      margin-top: 0.75rem;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.4);
      transition: all 0.15s ease-in-out;
    }
    button:hover {
      background: #f59e0b;
    }
    .err-box {
      background: rgba(185, 28, 28, 0.25);
      border: 2px solid #ef4444;
      color: #fca5a5;
      font-size: 0.75rem;
      font-weight: 700;
      padding: 0.65rem 0.85rem;
      margin-bottom: 1.25rem;
    }
    .footer {
      margin-top: 1.75rem;
      padding-top: 0.85rem;
      border-top: 2px solid #54546c;
      display: flex;
      justify-content: space-between;
      font-size: 0.68rem;
      font-weight: 700;
      color: #71717a;
    }
  </style>
</head>
<body>
  <div class="chassis">
    <div class="amber-strip"></div>
    <div class="card-body">
      <div class="header">
        <div class="title"><span class="indicator"></span>NETDOCK // INIT</div>
        <div class="badge">FIRST_RUN</div>
      </div>
      <div class="notice">
        [INITIAL_PROVISIONING]<br>
        Create your primary operator key. Credentials are encrypted and persisted to your mounted SQLite database.
      </div>
      __ERROR_PLACEHOLDER__
      <form method="POST" action="/auth/setup">
        <div class="field">
          <label>// DESIRED_OPERATOR_ID</label>
          <input type="text" name="username" placeholder="e.g. admin" required autocomplete="username" autofocus />
        </div>
        <div class="field">
          <label>// CREATE_ACCESS_KEY</label>
          <input type="password" name="password" minlength="6" placeholder="Min 6 characters" required autocomplete="new-password" />
        </div>
        <div class="field">
          <label>// CONFIRM_ACCESS_KEY</label>
          <input type="password" name="confirm_password" minlength="6" required autocomplete="new-password" />
        </div>
        <button type="submit">[ PROVISION_CREDENTIALS ]</button>
      </form>
      <div class="footer">
        <span>STORAGE: /data/netdock.db</span>
        <span>SECURITY: PBKDF2_SHA256</span>
      </div>
    </div>
  </div>
</body>
</html>"""

LOGIN_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NETDOCK // OPERATOR AUTH</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #14141b;
      color: #f4f4f5;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 1.5rem;
    }
    .chassis {
      background: #1a1a24;
      border: 2px solid #54546c;
      width: 100%;
      max-width: 420px;
      position: relative;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.85);
    }
    .amber-strip {
      background: #fbbf24;
      height: 4px;
      width: 100%;
    }
    .card-body { padding: 2rem; }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #54546c;
      padding-bottom: 1rem;
      margin-bottom: 1.75rem;
    }
    .title {
      color: #fbbf24;
      font-size: 0.95rem;
      font-weight: 900;
      letter-spacing: 0.12em;
      display: flex;
      align-items: center;
      gap: 0.6rem;
    }
    .indicator {
      width: 9px;
      height: 9px;
      background: #fbbf24;
      box-shadow: 0 0 8px #fbbf24;
    }
    .badge {
      font-size: 0.7rem;
      color: #000;
      background: #fbbf24;
      font-weight: 900;
      padding: 0.15rem 0.45rem;
      border: 1px solid #f59e0b;
      letter-spacing: 0.05em;
    }
    .field { margin-bottom: 1.25rem; }
    label {
      display: block;
      font-size: 0.72rem;
      font-weight: 800;
      color: #a1a1aa;
      margin-bottom: 0.45rem;
      letter-spacing: 0.08em;
    }
    input {
      width: 100%;
      background: #29293a;
      border: 2px solid #60607a;
      color: #ffffff;
      padding: 0.7rem 0.85rem;
      font-size: 0.85rem;
      font-family: inherit;
      outline: none;
      transition: all 0.15s ease-in-out;
    }
    input:focus {
      border-color: #fbbf24;
      background: #333346;
      box-shadow: 0 0 0 1px #fbbf24;
    }
    button {
      width: 100%;
      background: #333346;
      color: #ffffff;
      font-weight: 900;
      font-size: 0.8rem;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      padding: 0.85rem 1rem;
      border: 2px solid #60607a;
      cursor: pointer;
      margin-top: 0.75rem;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.4);
      transition: all 0.15s ease-in-out;
    }
    button:hover {
      background: #43435c;
      color: #fbbf24;
      border-color: #fbbf24;
    }
    .err-box {
      background: rgba(185, 28, 28, 0.25);
      border: 2px solid #ef4444;
      color: #fca5a5;
      font-size: 0.75rem;
      font-weight: 700;
      padding: 0.65rem 0.85rem;
      margin-bottom: 1.25rem;
      letter-spacing: 0.05em;
    }
    .footer {
      margin-top: 1.75rem;
      padding-top: 0.85rem;
      border-top: 2px solid #54546c;
      display: flex;
      justify-content: space-between;
      font-size: 0.68rem;
      font-weight: 700;
      color: #71717a;
    }
  </style>
</head>
<body>
  <div class="chassis">
    <div class="amber-strip"></div>
    <div class="card-body">
      <div class="header">
        <div class="title"><span class="indicator"></span>NETDOCK // AUTH</div>
        <div class="badge">SYS_GATE</div>
      </div>
      __ERROR_PLACEHOLDER__
      <form method="POST" action="/auth/login">
        <div class="field">
          <label>// OPERATOR_ID</label>
          <input type="text" name="username" required autocomplete="username" autofocus />
        </div>
        <div class="field">
          <label>// ACCESS_KEY</label>
          <input type="password" name="password" required autocomplete="current-password" />
        </div>
        <button type="submit">[ INITIALIZE_SESSION ]</button>
      </form>
      <div class="footer">
        <span>CHASSIS: 01_ARMORED</span>
        <span>ENGINE: SQLITE_WAL</span>
      </div>
    </div>
  </div>
</body>
</html>"""

app = FastAPI(title="NetDock API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def has_operator_account() -> bool:
    with Session(engine) as session:
        return session.exec(select(Operator)).first() is not None

# --- Global Security Barrier ---
@app.middleware("http")
async def security_barrier(request: Request, call_next):
    path = request.url.path

    # Allow auth endpoints and static bundle assets
    if path.startswith("/auth/") or path.startswith("/assets/"):
        return await call_next(request)

    # If system is unprovisioned, route browser to setup wizard
    if not has_operator_account():
        if path.startswith("/api/"):
            return Response(content='{"detail":"SETUP_REQUIRED"}', status_code=503, media_type="application/json")
        return HTMLResponse(content=SETUP_HTML.replace("__ERROR_PLACEHOLDER__", ""), status_code=200)

    # If system is provisioned, verify session token
    session_token = request.cookies.get("netdock_session")
    if session_token and session_token in VALID_SESSIONS:
        return await call_next(request)

    # Deny unauthenticated API calls
    if path.startswith("/api/"):
        return Response(content='{"detail":"UNAUTHORIZED_OPERATOR"}', status_code=401, media_type="application/json")

    # Serve login terminal
    return HTMLResponse(content=LOGIN_HTML.replace("__ERROR_PLACEHOLDER__", ""), status_code=200)

@app.post("/auth/setup")
async def handle_setup(request: Request):
    if has_operator_account():
        return RedirectResponse(url="/", status_code=303)

    form = await request.form()
    username = form.get("username", "").strip()
    password = form.get("password", "")
    confirm_password = form.get("confirm_password", "")

    if not username or len(password) < 6:
        err = '<div class="err-box">[ERR] Username required, password must be at least 6 characters.</div>'
        return HTMLResponse(content=SETUP_HTML.replace("__ERROR_PLACEHOLDER__", err), status_code=400)

    if password != confirm_password:
        err = '<div class="err-box">[ERR] Passwords do not match. Re-enter keys.</div>'
        return HTMLResponse(content=SETUP_HTML.replace("__ERROR_PLACEHOLDER__", err), status_code=400)

    salt = secrets.token_hex(16)
    p_hash = hash_secret(password, salt)

    with Session(engine) as session:
        new_op = Operator(
            id="sys_op",
            username=username,
            salt=salt,
            password_hash=p_hash,
            created_at=int(time.time())
        )
        session.add(new_op)
        session.commit()

    # Automatically initialize session upon account creation
    token = secrets.token_urlsafe(32)
    VALID_SESSIONS.add(token)
    response = RedirectResponse(url="/", status_code=303)
    response.set_cookie(
        key="netdock_session",
        value=token,
        httponly=True,
        samesite="lax",
        path="/",
        max_age=86400 * 7
    )
    return response

@app.post("/auth/login")
async def handle_login(request: Request):
    form = await request.form()
    username = form.get("username", "").strip()
    password = form.get("password", "")

    with Session(engine) as session:
        op = session.exec(select(Operator).where(Operator.username == username)).first()
        if op:
            computed = hash_secret(password, op.salt)
            if secrets.compare_digest(computed, op.password_hash):
                token = secrets.token_urlsafe(32)
                VALID_SESSIONS.add(token)
                response = RedirectResponse(url="/", status_code=303)
                response.set_cookie(
                    key="netdock_session",
                    value=token,
                    httponly=True,
                    samesite="lax",
                    path="/",
                    max_age=86400 * 7
                )
                return response

    error_banner = '<div class="err-box">[ERR] ACCESS_DENIED: Invalid operator key</div>'
    return HTMLResponse(content=LOGIN_HTML.replace("__ERROR_PLACEHOLDER__", error_banner), status_code=401)

@app.api_route("/auth/logout", methods=["GET", "POST"])
def handle_logout(request: Request):
    token = request.cookies.get("netdock_session")
    if token and token in VALID_SESSIONS:
        VALID_SESSIONS.discard(token)
    response = Response(content='{"status":"logged_out"}', media_type="application/json")
    response.delete_cookie(key="netdock_session", path="/")
    return response

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

# --- Docker Raw Socket HTTP Client ---
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

        all_hosts = session.exec(select(Host)).all()
        cerb_parent = next((h for h in all_hosts if h.hostname.lower() == "cerberus"), None)
        parent_target_id = cerb_parent.id if cerb_parent else None

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
                    parent_id=parent_target_id,
                    notes=f"Auto-synced from Docker daemon. Epoch: {created_epoch}"
                )
                session.add(new_entry)
                synced_hosts.append(name)
            else:
                existing.status = status
                existing.parent_id = parent_target_id
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
        "parent_linked_to": parent_target_id,
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
