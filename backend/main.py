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
from models import Host, Subnet, Service, Operator, AppSettings, CustomDeviceType

def hash_secret(secret: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac("sha256", secret.encode(), salt.encode(), 100000).hex()

VALID_SESSIONS = set()
PROCESS_START_TIME = int(time.time())
APP_VERSION = '1.4.0'

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
    with Session(engine) as session:
        ensure_host_inventory_schema(session)


def infer_category_from_type(dev_type: str) -> str:
    t = (dev_type or "").strip().lower()
    if t in {
        "router", "core switch", "access switch", "layer 2 switch", "layer 3 switch",
        "switch", "firewall", "wireless access point", "wireless controller",
        "network gateway", "modem", "load balancer", "vpn gateway"
    }:
        return "Network Infrastructure"
    if t in {
        "nvr (network video recorder)", "dvr (digital video recorder)", "ip camera",
        "security camera system", "access control panel", "door controller", "alarm system"
    }:
        return "Security and Surveillance"
    if t in {"network storage", "backup server", "storage array", "san controller"}:
        return "Storage and Backup"
    if t in {
        "wireless bridge", "mesh node", "wireless repeater", "voip phone",
        "pbx / voip server", "sip gateway", "cellular gateway"
    }:
        return "Wireless and Communication"
    if t in {
        "smart home hub", "iot gateway", "smart device", "printer",
        "ups", "pdu", "environmental sensor", "other iot device"
    }:
        return "IoT and Smart Devices"
    if t in {"other network device", "custom device type"}:
        return "Other"
    return "Servers and Computing"


def ensure_host_inventory_schema(session: Session):
    from sqlalchemy import text
    subnet_columns = {
        "gateway": ("TEXT", "''"),
        "vlan_id": ("INTEGER", "NULL"),
        "description": ("TEXT", "''"),
    }
    host_columns = {
        "name": ("TEXT", "''"),
        "device_category": ("TEXT", "'Servers and Computing'"),
        "manufacturer": ("TEXT", "''"),
        "model": ("TEXT", "''"),
        "ipv6": ("TEXT", "''"),
        "location": ("TEXT", "''"),
        "serial_number": ("TEXT", "''"),
        "firmware_version": ("TEXT", "''"),
        "specs_json": ("TEXT", "'{}'"),
        "updated_at": ("INTEGER", "0"),
    }
    try:
        SQLModel.metadata.create_all(engine)

        # Ensure subnet columns exist
        s_rows = session.exec(text("PRAGMA table_info(subnet)")).all()
        existing_subnet_cols = {r[1] for r in s_rows}
        for col_name, (col_type, default_val) in subnet_columns.items():
            if col_name not in existing_subnet_cols:
                session.exec(
                    text(f"ALTER TABLE subnet ADD COLUMN {col_name} {col_type} DEFAULT {default_val}")
                )
        session.commit()

        # Ensure host columns exist
        h_rows = session.exec(text("PRAGMA table_info(host)")).all()
        existing_host_cols = {r[1] for r in h_rows}
        for col_name, (col_type, default_val) in host_columns.items():
            if col_name not in existing_host_cols:
                session.exec(
                    text(f"ALTER TABLE host ADD COLUMN {col_name} {col_type} DEFAULT {default_val}")
                )
        session.commit()

        # Backfill legacy records
        all_hosts = session.exec(select(Host)).all()
        dirty = False
        for h in all_hosts:
            if not h.name:
                h.name = h.hostname
                dirty = True
            if not h.device_category:
                h.device_category = infer_category_from_type(h.device_type)
                dirty = True
            if h.specs_json is None or h.specs_json == "":
                h.specs_json = "{}"
                dirty = True
        if dirty:
            session.commit()
    except Exception:
        session.rollback()


def validate_and_normalize_host(host: Host, session: Session, is_update: bool = False):
    host.name = (host.name or host.hostname or "").strip()
    host.hostname = (host.hostname or host.name or "").strip()
    if not host.name:
        raise HTTPException(status_code=400, detail="Device Name is required.")
    if not host.device_type or not host.device_type.strip():
        raise HTTPException(status_code=400, detail="Device Type is required.")

    host.device_type = host.device_type.strip()
    if not host.device_category or not host.device_category.strip():
        host.device_category = infer_category_from_type(host.device_type)

    host.ip = (host.ip or "").strip()
    host.ipv6 = (host.ipv6 or "").strip()
    host.mac = (host.mac or "").strip()
    host.subnet_id = (host.subnet_id or "").strip()

    # Validate IPv4 and optional Subnet membership
    if host.ip:
        try:
            host_addr = ipaddress.IPv4Address(host.ip)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid IPv4 address format: '{host.ip}'.")

        if host.subnet_id:
            subnet = session.get(Subnet, host.subnet_id)
            if not subnet:
                raise HTTPException(status_code=400, detail=f"Subnet '{host.subnet_id}' does not exist.")
            net = ipaddress.IPv4Network(subnet.cidr, strict=False)
            if host_addr not in net:
                raise HTTPException(
                    status_code=400,
                    detail=f"IP {host.ip} does not fall within subnet {subnet.name} ({subnet.cidr})."
                )
            if net.num_addresses > 2:
                if host_addr == net.network_address:
                    raise HTTPException(status_code=400, detail=f"IP {host.ip} is the subnet network address.")
                if host_addr == net.broadcast_address:
                    raise HTTPException(status_code=400, detail=f"IP {host.ip} is the subnet broadcast address.")

        if host.ip != "127.0.0.1":
            existing_ip = session.exec(select(Host).where(Host.ip == host.ip)).first()
            if existing_ip and existing_ip.id != host.id:
                raise HTTPException(
                    status_code=400,
                    detail=f"IPv4 {host.ip} is already assigned to device '{existing_ip.name or existing_ip.hostname}'."
                )

    # Validate IPv6 if provided
    if host.ipv6:
        try:
            ipaddress.IPv6Address(host.ipv6.split("/")[0])
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid IPv6 address format: '{host.ipv6}'.")

    # Validate specs_json is valid JSON object string
    if host.specs_json:
        try:
            parsed = json.loads(host.specs_json)
            if not isinstance(parsed, dict):
                host.specs_json = "{}"
        except Exception:
            host.specs_json = "{}"
    else:
        host.specs_json = "{}"

    host.updated_at = int(time.time())


# --- Subnet Routes ---
@app.get("/api/v1/subnets", response_model=List[Subnet])
def list_subnets(session: Session = Depends(get_session)):
    ensure_host_inventory_schema(session)
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
        hostnames = ", ".join((h.name or h.hostname) for h in assigned_hosts)
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete subnet '{subnet.name}'. Assigned devices exist: {hostnames}"
        )

    session.delete(subnet)
    session.commit()
    return {"status": "deleted", "id": subnet_id}


# --- Host / Network Device Routes ---
@app.get("/api/v1/hosts", response_model=List[Host])
def list_hosts(session: Session = Depends(get_session)):
    ensure_host_inventory_schema(session)
    return session.exec(select(Host)).all()


@app.post("/api/v1/hosts", response_model=Host)
def create_host(host: Host, session: Session = Depends(get_session)):
    ensure_host_inventory_schema(session)
    if not host.id:
        host.id = f"dev-{secrets.token_hex(4)}"
    validate_and_normalize_host(host, session, is_update=False)
    session.add(host)
    session.commit()
    session.refresh(host)
    return host


@app.put("/api/v1/hosts/{host_id}", response_model=Host)
def update_host(host_id: str, updated_data: Host, session: Session = Depends(get_session)):
    ensure_host_inventory_schema(session)
    host = session.get(Host, host_id)
    if not host:
        raise HTTPException(status_code=404, detail="Device not found")

    host_data = updated_data.model_dump(exclude_unset=True)
    for key, value in host_data.items():
        if key != "id":
            setattr(host, key, value)

    validate_and_normalize_host(host, session, is_update=True)
    session.add(host)
    session.commit()
    session.refresh(host)
    return host


@app.delete("/api/v1/hosts/{host_id}")
def delete_host(host_id: str, session: Session = Depends(get_session)):
    host = session.get(Host, host_id)
    if not host:
        raise HTTPException(status_code=404, detail="Device not found")
    session.delete(host)
    session.commit()
    return {"status": "deleted", "id": host_id}


# --- Custom Device Type Routes ---
@app.get("/api/v1/device-types/custom", response_model=List[CustomDeviceType])
def list_custom_device_types(session: Session = Depends(get_session)):
    ensure_host_inventory_schema(session)
    return session.exec(select(CustomDeviceType)).all()


@app.post("/api/v1/device-types/custom", response_model=CustomDeviceType)
def create_custom_device_type(custom_type: CustomDeviceType, session: Session = Depends(get_session)):
    ensure_host_inventory_schema(session)
    clean_name = (custom_type.name or "").strip()
    if not clean_name:
        raise HTTPException(status_code=400, detail="Custom device type name is required.")
    existing = session.exec(select(CustomDeviceType).where(CustomDeviceType.name == clean_name)).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Custom device type '{clean_name}' already exists.")
    custom_type.id = custom_type.id or f"cdt-{secrets.token_hex(4)}"
    custom_type.name = clean_name
    custom_type.category = (custom_type.category or "Other").strip()
    custom_type.icon_name = (custom_type.icon_name or "Box").strip()
    custom_type.created_at = int(time.time())
    try:
        parsed_fields = json.loads(custom_type.fields_json or "[]")
        if not isinstance(parsed_fields, list):
            custom_type.fields_json = "[]"
    except Exception:
        custom_type.fields_json = "[]"

    session.add(custom_type)
    session.commit()
    session.refresh(custom_type)
    return custom_type


@app.delete("/api/v1/device-types/custom/{type_id}")
def delete_custom_device_type(type_id: str, session: Session = Depends(get_session)):
    ensure_host_inventory_schema(session)
    target = session.get(CustomDeviceType, type_id)
    if not target:
        raise HTTPException(status_code=404, detail="Custom device type not found.")
    session.delete(target)
    session.commit()
    return {"status": "deleted", "id": type_id}


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
                    name=name,
                    hostname=name,
                    device_category="Servers and Computing",
                    device_type="container",
                    manufacturer="Docker",
                    model=image_name,
                    ip=ip_address,
                    mac=mac_address,
                    os=f"Docker: {image_name}",
                    status=status,
                    subnet_id=matched_subnet_id,
                    parent_id=parent_target_id,
                    notes=f"Auto-synced from Docker daemon. Epoch: {created_epoch}",
                    specs_json=json.dumps({"docker_support": "Container Workload", "virtualization_platform": "Docker Engine", "container_image": image_name}),
                    updated_at=int(time.time())
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


# --- Settings, Account, Docker Preferences & System Management Routes ---
import platform
from pydantic import BaseModel
from sqlalchemy import text

ALLOWED_THEMES = {"dark", "light", "system"}
ALLOWED_ACCENTS = {"indigo", "sky", "emerald", "amber", "rose", "slate"}
ALLOWED_DENSITIES = {"comfortable", "default", "compact"}
ALLOWED_LOG_LIMITS = {50, 100, 250, 500, 1000, 2500}
ALLOWED_LOG_REFRESH = {0, 2, 5, 10, 30}
ALLOWED_SORT_BY = {"hostname", "ip", "status", "device_type"}
ALLOWED_SORT_ORDER = {"asc", "desc"}
ALLOWED_REFRESH_INTERVALS = {0, 15, 30, 60, 300}

class SettingsUpdatePayload(BaseModel):
    theme: Optional[str] = None
    accent_color: Optional[str] = None
    density: Optional[str] = None
    container_log_limit: Optional[int] = None
    log_refresh_interval: Optional[int] = None
    container_sort_by: Optional[str] = None
    container_sort_order: Optional[str] = None
    auto_refresh_interval: Optional[int] = None
    confirm_destructive: Optional[bool] = None

class CredentialsUpdatePayload(BaseModel):
    current_password: str
    new_username: Optional[str] = None
    new_password: Optional[str] = None
    confirm_password: Optional[str] = None
    revoke_other_sessions: bool = True

def ensure_appsettings_schema(session: Session):
    required_columns = {
        "theme": ("TEXT", "'dark'"),
        "accent_color": ("TEXT", "'indigo'"),
        "density": ("TEXT", "'default'"),
        "container_log_limit": ("INTEGER", "250"),
        "log_refresh_interval": ("INTEGER", "5"),
        "container_sort_by": ("TEXT", "'hostname'"),
        "container_sort_order": ("TEXT", "'asc'"),
        "auto_refresh_interval": ("INTEGER", "0"),
        "confirm_destructive": ("INTEGER", "1"),
        "updated_at": ("INTEGER", "0"),
    }
    try:
        rows = session.exec(text("PRAGMA table_info(appsettings)")).all()
        existing_cols = {r[1] for r in rows}
        if not existing_cols:
            SQLModel.metadata.create_all(engine)
            return
        for col_name, (col_type, default_val) in required_columns.items():
            if col_name not in existing_cols:
                session.exec(
                    text(f"ALTER TABLE appsettings ADD COLUMN {col_name} {col_type} DEFAULT {default_val}")
                )
        session.commit()
    except Exception:
        session.rollback()

def get_or_create_settings(session: Session) -> AppSettings:
    ensure_appsettings_schema(session)
    try:
        settings_row = session.get(AppSettings, "global")
        if not settings_row:
            settings_row = AppSettings(id="global", updated_at=int(time.time()))
            session.add(settings_row)
            session.commit()
            session.refresh(settings_row)

        dirty = False
        if settings_row.theme not in ALLOWED_THEMES:
            settings_row.theme = "dark"
            dirty = True
        if settings_row.accent_color not in ALLOWED_ACCENTS:
            settings_row.accent_color = "indigo"
            dirty = True
        if settings_row.density not in ALLOWED_DENSITIES:
            settings_row.density = "default"
            dirty = True
        if settings_row.container_log_limit not in ALLOWED_LOG_LIMITS:
            settings_row.container_log_limit = 250
            dirty = True
        if settings_row.log_refresh_interval not in ALLOWED_LOG_REFRESH:
            settings_row.log_refresh_interval = 5
            dirty = True
        if settings_row.container_sort_by not in ALLOWED_SORT_BY:
            settings_row.container_sort_by = "hostname"
            dirty = True
        if settings_row.container_sort_order not in ALLOWED_SORT_ORDER:
            settings_row.container_sort_order = "asc"
            dirty = True
        if settings_row.auto_refresh_interval not in ALLOWED_REFRESH_INTERVALS:
            settings_row.auto_refresh_interval = 0
            dirty = True
        if dirty:
            session.add(settings_row)
            session.commit()
            session.refresh(settings_row)
        return settings_row
    except Exception:
        session.rollback()
        return AppSettings(id="global", updated_at=int(time.time()))

@app.get("/api/v1/settings", response_model=AppSettings)
def read_app_settings(session: Session = Depends(get_session)):
    return get_or_create_settings(session)

@app.put("/api/v1/settings", response_model=AppSettings)
def update_app_settings(payload: SettingsUpdatePayload, session: Session = Depends(get_session)):
    settings_row = get_or_create_settings(session)

    if payload.theme is not None:
        if payload.theme not in ALLOWED_THEMES:
            raise HTTPException(status_code=400, detail="Theme must be 'dark', 'light', or 'system'.")
        settings_row.theme = payload.theme

    if payload.accent_color is not None:
        if payload.accent_color not in ALLOWED_ACCENTS:
            raise HTTPException(status_code=400, detail="Unsupported accent color.")
        settings_row.accent_color = payload.accent_color

    if payload.density is not None:
        if payload.density not in ALLOWED_DENSITIES:
            raise HTTPException(status_code=400, detail="Density must be 'comfortable', 'default', or 'compact'.")
        settings_row.density = payload.density

    if payload.container_log_limit is not None:
        if payload.container_log_limit not in ALLOWED_LOG_LIMITS:
            raise HTTPException(status_code=400, detail="Log limit must be 50, 100, 250, 500, 1000, or 2500 lines.")
        settings_row.container_log_limit = payload.container_log_limit

    if payload.log_refresh_interval is not None:
        if payload.log_refresh_interval not in ALLOWED_LOG_REFRESH:
            raise HTTPException(status_code=400, detail="Log refresh interval must be 0, 2, 5, 10, or 30 seconds.")
        settings_row.log_refresh_interval = payload.log_refresh_interval

    if payload.container_sort_by is not None:
        if payload.container_sort_by not in ALLOWED_SORT_BY:
            raise HTTPException(status_code=400, detail="Invalid container sort field.")
        settings_row.container_sort_by = payload.container_sort_by

    if payload.container_sort_order is not None:
        if payload.container_sort_order not in ALLOWED_SORT_ORDER:
            raise HTTPException(status_code=400, detail="Sort order must be 'asc' or 'desc'.")
        settings_row.container_sort_order = payload.container_sort_order

    if payload.auto_refresh_interval is not None:
        if payload.auto_refresh_interval not in ALLOWED_REFRESH_INTERVALS:
            raise HTTPException(status_code=400, detail="Refresh interval must be 0, 15, 30, 60, or 300 seconds.")
        settings_row.auto_refresh_interval = payload.auto_refresh_interval

    if payload.confirm_destructive is not None:
        settings_row.confirm_destructive = bool(payload.confirm_destructive)

    settings_row.updated_at = int(time.time())
    session.add(settings_row)
    session.commit()
    session.refresh(settings_row)
    return settings_row

@app.post("/api/v1/settings/reset", response_model=AppSettings)
def reset_app_settings(session: Session = Depends(get_session)):
    ensure_appsettings_schema(session)
    existing = session.get(AppSettings, "global")
    if existing:
        session.delete(existing)
        session.commit()
    fresh = AppSettings(id="global", updated_at=int(time.time()))
    session.add(fresh)
    session.commit()
    session.refresh(fresh)
    return fresh

@app.get("/api/v1/integrations/docker/logs/{container_name}")
def get_container_logs(
    container_name: str,
    tail: Optional[int] = None,
    session: Session = Depends(get_session)
):
    cfg = get_or_create_settings(session)
    line_limit = tail if (tail in ALLOWED_LOG_LIMITS) else (cfg.container_log_limit or 250)
    conn = UnixSocketHTTPConnection("/var/run/docker.sock")
    try:
        conn.request("GET", f"/containers/{container_name}/logs?stdout=1&stderr=1&tail={line_limit}&timestamps=1")
        res = conn.getresponse()
        raw = res.read()
        if res.status != 200:
            raise HTTPException(status_code=res.status, detail=f"Docker daemon returned HTTP {res.status}")
        cleaned_lines = []
        for line in raw.split(b"\n"):
            if len(line) > 8 and line[0] in (0, 1, 2) and line[1:4] == b"\x00\x00\x00":
                line = line[8:]
            text_line = line.decode("utf-8", errors="replace").strip()
            if text_line:
                cleaned_lines.append(text_line)
        return {
            "container": container_name,
            "tail": line_limit,
            "lines": cleaned_lines[-line_limit:],
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unable to read container logs: {str(e)}")
    finally:
        conn.close()

@app.get("/api/v1/account")
def get_operator_account(session: Session = Depends(get_session)):
    op = session.exec(select(Operator)).first()
    if not op:
        raise HTTPException(status_code=404, detail="Operator account not provisioned.")
    return {
        "username": op.username,
        "created_at": op.created_at,
        "active_sessions": len(VALID_SESSIONS),
        "hash_algorithm": "PBKDF2-HMAC-SHA256 (100,000 iterations)",
    }

@app.put("/api/v1/account/credentials")
def update_operator_credentials(
    payload: CredentialsUpdatePayload,
    request: Request,
    session: Session = Depends(get_session)
):
    op = session.exec(select(Operator)).first()
    if not op:
        raise HTTPException(status_code=404, detail="Operator account not found.")

    if not payload.current_password:
        raise HTTPException(status_code=400, detail="Current operator password is required.")

    computed_current = hash_secret(payload.current_password, op.salt)
    if not secrets.compare_digest(computed_current, op.password_hash):
        raise HTTPException(status_code=401, detail="Current operator password is incorrect.")

    changed_fields = []

    if payload.new_username is not None:
        clean_user = payload.new_username.strip()
        if clean_user and clean_user != op.username:
            if len(clean_user) < 3 or len(clean_user) > 32:
                raise HTTPException(status_code=400, detail="Username must be between 3 and 32 characters.")
            if not all(c.isalnum() or c in "_-." for c in clean_user):
                raise HTTPException(status_code=400, detail="Username may only contain letters, numbers, '_', '-', and '.'.")
            op.username = clean_user
            changed_fields.append("username")

    if payload.new_password:
        if len(payload.new_password) < 6:
            raise HTTPException(status_code=400, detail="New password must be at least 6 characters.")
        if payload.new_password != (payload.confirm_password or ""):
            raise HTTPException(status_code=400, detail="New password and confirmation do not match.")
        new_salt = secrets.token_hex(16)
        op.salt = new_salt
        op.password_hash = hash_secret(payload.new_password, new_salt)
        changed_fields.append("password")

    if not changed_fields:
        raise HTTPException(status_code=400, detail="No credential changes were provided.")

    session.add(op)
    session.commit()

    current_token = request.cookies.get("netdock_session")
    if payload.revoke_other_sessions:
        VALID_SESSIONS.clear()
        if current_token:
            VALID_SESSIONS.add(current_token)

    return {
        "status": "updated",
        "username": op.username,
        "updated_fields": changed_fields,
        "active_sessions": len(VALID_SESSIONS),
    }

@app.post("/api/v1/account/sessions/revoke")
def revoke_other_operator_sessions(request: Request):
    current_token = request.cookies.get("netdock_session")
    revoked_count = max(0, len(VALID_SESSIONS) - (1 if current_token in VALID_SESSIONS else 0))
    VALID_SESSIONS.clear()
    if current_token:
        VALID_SESSIONS.add(current_token)
    return {
        "status": "revoked",
        "revoked_sessions": revoked_count,
        "active_sessions": len(VALID_SESSIONS),
    }

@app.get("/api/v1/system/info")
def get_system_information(session: Session = Depends(get_session)):
    db_file = "/data/netdock.db"
    db_size = os.path.getsize(db_file) if os.path.exists(db_file) else 0

    docker_ok = False
    docker_err = None
    sock_path = "/var/run/docker.sock"
    try:
        conn = UnixSocketHTTPConnection(sock_path)
        conn.request("GET", "/_ping")
        res = conn.getresponse()
        docker_ok = (res.status == 200)
        conn.close()
    except Exception as e:
        docker_err = str(e)

    hosts_list = session.exec(select(Host)).all()
    subnets_list = session.exec(select(Subnet)).all()
    services_list = session.exec(select(Service)).all()

    return {
        "app_name": "NetDock",
        "app_version": APP_VERSION,
        "environment": "Production",
        "api_status": "healthy",
        "uptime_seconds": max(0, int(time.time()) - PROCESS_START_TIME),
        "started_at": PROCESS_START_TIME,
        "python_version": platform.python_version(),
        "os_platform": f"{platform.system()} {platform.release()} ({platform.machine()})",
        "database_path": db_file,
        "database_size_bytes": db_size,
        "docker_socket_path": sock_path,
        "docker_status": "connected" if docker_ok else "unreachable",
        "docker_error": docker_err,
        "counts": {
            "hosts": len(hosts_list),
            "active_hosts": sum(1 for h in hosts_list if h.status == "active"),
            "containers": sum(1 for h in hosts_list if h.device_type == "container"),
            "subnets": len(subnets_list),
            "services": len(services_list),
            "active_sessions": len(VALID_SESSIONS),
        },
    }

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
