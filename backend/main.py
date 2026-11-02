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

NO_CACHE_HEADERS = {
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    "Pragma": "no-cache",
    "Expires": "0",
    "Vary": "Cookie",
}

SETUP_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NetDock — Initialize Operator</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: #0b0f17;
      color: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 1.5rem;
      -webkit-font-smoothing: antialiased;
    }
    .auth-card {
      width: 100%;
      max-width: 380px;
      background-color: #0f1522;
      border: 1px solid rgba(148, 163, 184, 0.14);
      border-radius: 12px;
      padding: 2rem;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.45);
    }
    .brand-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 1.5rem;
    }
    .brand-mark {
      width: 32px;
      height: 32px;
      background-color: rgba(99, 102, 241, 0.14);
      border: 1px solid rgba(99, 102, 241, 0.35);
      border-radius: 8px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #a5b4fc;
    }
    .brand-name {
      font-size: 0.9375rem;
      font-weight: 600;
      color: #f8fafc;
    }
    .auth-title {
      font-size: 1.125rem;
      font-weight: 600;
      color: #f8fafc;
      margin-bottom: 0.375rem;
    }
    .auth-subtitle {
      font-size: 0.8125rem;
      color: #94a3b8;
      line-height: 1.5;
      margin-bottom: 1.5rem;
    }
    .field {
      margin-bottom: 1rem;
    }
    .field:last-of-type {
      margin-bottom: 1.5rem;
    }
    label {
      display: block;
      font-size: 0.75rem;
      font-weight: 500;
      color: #94a3b8;
      margin-bottom: 0.375rem;
    }
    input[type="text"], input[type="password"] {
      width: 100%;
      background-color: #090d14;
      border: 1px solid rgba(148, 163, 184, 0.14);
      border-radius: 7px;
      padding: 0.5625rem 0.75rem;
      color: #f1f5f9;
      font-size: 0.8125rem;
      outline: none;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }
    input[type="text"]:focus, input[type="password"]:focus {
      border-color: #6366f1;
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.18);
    }
    button[type="submit"] {
      width: 100%;
      background-color: #6366f1;
      color: #ffffff;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 7px;
      padding: 0.625rem 0.875rem;
      font-size: 0.8125rem;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.15s ease;
    }
    button[type="submit"]:hover {
      background-color: #4f46e5;
    }
    .err-box {
      margin-bottom: 1.25rem;
      padding: 0.625rem 0.75rem;
      background-color: rgba(244, 63, 94, 0.12);
      border: 1px solid rgba(244, 63, 94, 0.3);
      border-radius: 7px;
      color: #fda4af;
      font-size: 0.75rem;
      line-height: 1.4;
    }
</style>
</head>
<body>
  <div class="auth-card">
    <div class="brand-row">
      <div class="brand-mark">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="16" y="16" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="9" y="2" width="6" height="6" rx="1"/><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"/><path d="M12 12V8"/></svg>
      </div>
      <span class="brand-name">NetDock</span>
    </div>
    <h1 class="auth-title">Initialize operator account</h1>
    <p class="auth-subtitle">Configure your primary credentials to secure network telemetry and asset records.</p>
    __ERROR_PLACEHOLDER__
    <form method="POST" action="/auth/setup">
      <div class="field">
        <label for="username">Username</label>
        <input type="text" id="username" name="username" placeholder="admin" required autofocus autocomplete="username" />
      </div>
      <div class="field">
        <label for="password">Operator key (min. 6 characters)</label>
        <input type="password" id="password" name="password" placeholder="••••••••" required autocomplete="new-password" />
      </div>
      <div class="field">
        <label for="confirm_password">Confirm operator key</label>
        <input type="password" id="confirm_password" name="confirm_password" placeholder="••••••••" required autocomplete="new-password" />
      </div>
      <button type="submit">Create Operator Account</button>
    </form>
  </div>
</body>
</html>"""

LOGIN_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NetDock — Sign In</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: #0b0f17;
      color: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 1.5rem;
      -webkit-font-smoothing: antialiased;
    }
    .auth-card {
      width: 100%;
      max-width: 380px;
      background-color: #0f1522;
      border: 1px solid rgba(148, 163, 184, 0.14);
      border-radius: 12px;
      padding: 2rem;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.45);
    }
    .brand-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 1.5rem;
    }
    .brand-mark {
      width: 32px;
      height: 32px;
      background-color: rgba(99, 102, 241, 0.14);
      border: 1px solid rgba(99, 102, 241, 0.35);
      border-radius: 8px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #a5b4fc;
    }
    .brand-name {
      font-size: 0.9375rem;
      font-weight: 600;
      color: #f8fafc;
    }
    .auth-title {
      font-size: 1.125rem;
      font-weight: 600;
      color: #f8fafc;
      margin-bottom: 0.375rem;
    }
    .auth-subtitle {
      font-size: 0.8125rem;
      color: #94a3b8;
      line-height: 1.5;
      margin-bottom: 1.5rem;
    }
    .field {
      margin-bottom: 1rem;
    }
    .field:last-of-type {
      margin-bottom: 1.5rem;
    }
    label {
      display: block;
      font-size: 0.75rem;
      font-weight: 500;
      color: #94a3b8;
      margin-bottom: 0.375rem;
    }
    input[type="text"], input[type="password"] {
      width: 100%;
      background-color: #090d14;
      border: 1px solid rgba(148, 163, 184, 0.14);
      border-radius: 7px;
      padding: 0.5625rem 0.75rem;
      color: #f1f5f9;
      font-size: 0.8125rem;
      outline: none;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }
    input[type="text"]:focus, input[type="password"]:focus {
      border-color: #6366f1;
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.18);
    }
    button[type="submit"] {
      width: 100%;
      background-color: #6366f1;
      color: #ffffff;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 7px;
      padding: 0.625rem 0.875rem;
      font-size: 0.8125rem;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.15s ease;
    }
    button[type="submit"]:hover {
      background-color: #4f46e5;
    }
    .err-box {
      margin-bottom: 1.25rem;
      padding: 0.625rem 0.75rem;
      background-color: rgba(244, 63, 94, 0.12);
      border: 1px solid rgba(244, 63, 94, 0.3);
      border-radius: 7px;
      color: #fda4af;
      font-size: 0.75rem;
      line-height: 1.4;
    }
</style>
</head>
<body>
  <div class="auth-card">
    <div class="brand-row">
      <div class="brand-mark">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="16" y="16" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="9" y="2" width="6" height="6" rx="1"/><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"/><path d="M12 12V8"/></svg>
      </div>
      <span class="brand-name">NetDock</span>
    </div>
    <h1 class="auth-title">Sign in to NetDock</h1>
    <p class="auth-subtitle">Enter your operator credentials to access the infrastructure inventory.</p>
    __ERROR_PLACEHOLDER__
    <form method="POST" action="/auth/login">
      <div class="field">
        <label for="username">Username</label>
        <input type="text" id="username" name="username" placeholder="admin" required autofocus autocomplete="username" />
      </div>
      <div class="field">
        <label for="password">Operator key</label>
        <input type="password" id="password" name="password" placeholder="••••••••" required autocomplete="current-password" />
      </div>
      <button type="submit">Sign In</button>
    </form>
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
            return Response(content='{"detail":"SETUP_REQUIRED"}', status_code=503, media_type="application/json", headers=NO_CACHE_HEADERS)
        return HTMLResponse(content=SETUP_HTML.replace("__ERROR_PLACEHOLDER__", ""), status_code=200, headers=NO_CACHE_HEADERS)

    # If system is provisioned, verify session token
    session_token = request.cookies.get("netdock_session")
    if session_token and session_token in VALID_SESSIONS:
        response = await call_next(request)
        if not path.startswith("/assets/"):
            for k, v in NO_CACHE_HEADERS.items():
                response.headers[k] = v
        return response

    # Deny unauthenticated API calls
    if path.startswith("/api/"):
        return Response(content='{"detail":"UNAUTHORIZED_OPERATOR"}', status_code=401, media_type="application/json", headers=NO_CACHE_HEADERS)

    # Serve login terminal
    return HTMLResponse(content=LOGIN_HTML.replace("__ERROR_PLACEHOLDER__", ""), status_code=200, headers=NO_CACHE_HEADERS)

@app.post("/auth/setup")
async def handle_setup(request: Request):
    if has_operator_account():
        return RedirectResponse(url="/", status_code=303)

    form = await request.form()
    username = form.get("username", "").strip()
    password = form.get("password", "")
    confirm_password = form.get("confirm_password", "")

    if not username or len(password) < 6:
        err = '<div class="err-box">Username is required and password must be at least 6 characters.</div>'
        return HTMLResponse(content=SETUP_HTML.replace("__ERROR_PLACEHOLDER__", err), status_code=400)

    if password != confirm_password:
        err = '<div class="err-box">Passwords do not match. Please try again.</div>'
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

    error_banner = '<div class="err-box">Invalid operator key. Please try again.</div>'
    return HTMLResponse(content=LOGIN_HTML.replace("__ERROR_PLACEHOLDER__", error_banner), status_code=401)

@app.get("/auth/login")
async def get_login_page(request: Request):
    if not has_operator_account():
        return RedirectResponse(url="/", status_code=303, headers=NO_CACHE_HEADERS)
    session_token = request.cookies.get("netdock_session")
    if session_token and session_token in VALID_SESSIONS:
        return RedirectResponse(url="/", status_code=303, headers=NO_CACHE_HEADERS)
    return HTMLResponse(content=LOGIN_HTML.replace("__ERROR_PLACEHOLDER__", ""), status_code=200, headers=NO_CACHE_HEADERS)

@app.get("/api/v1/auth/session")
def check_auth_session(request: Request):
    session_token = request.cookies.get("netdock_session")
    if session_token and session_token in VALID_SESSIONS:
        return Response(content='{"authenticated":true}', media_type="application/json", headers=NO_CACHE_HEADERS)
    return Response(content='{"authenticated":false}', status_code=401, media_type="application/json", headers=NO_CACHE_HEADERS)

@app.api_route("/auth/logout", methods=["GET", "POST"])
@app.api_route("/api/v1/auth/logout", methods=["GET", "POST"])
def handle_logout(request: Request):
    token = request.cookies.get("netdock_session")
    if token:
        VALID_SESSIONS.discard(token)
    if request.method == "GET":
        response = HTMLResponse(content=LOGIN_HTML.replace("__ERROR_PLACEHOLDER__", ""), status_code=200, headers=NO_CACHE_HEADERS)
    else:
        response = Response(content='{"status":"logged_out","authenticated":false}', media_type="application/json", headers=NO_CACHE_HEADERS)
    response.delete_cookie(key="netdock_session", path="/", httponly=True, samesite="lax")
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
        return FileResponse(os.path.join(STATIC_DIR, "index.html"), headers=NO_CACHE_HEADERS)
