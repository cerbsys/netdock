import logging
import sqlite3
import platform
from datetime import datetime, timezone
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy import text

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] netdock: %(message)s"
)
logger = logging.getLogger("netdock")

APP_VERSION = "1.4.0"
if "PROCESS_START_TIME" not in globals():
    import time as _time_mod
    PROCESS_START_TIME = int(_time_mod.time())

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

from database import engine, init_db, get_session, ACTIVE_DB_PATH
from models import Subnet, Host, Service, Operator, CustomDeviceType, AppSettings

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
    def __init__(self, socket_path: str, timeout: float = 5.0):
        super().__init__("localhost", timeout=timeout)
        self.socket_path = socket_path

    def connect(self):
        sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        sock.settimeout(self.timeout)
        sock.connect(self.socket_path)
        self.sock = sock


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


# --- Settings, Account, Backup/Restore & System Diagnostics Routes ---
from pydantic import BaseModel

ALLOWED_THEMES = {"dark", "light", "system"}
ALLOWED_ACCENTS = {"indigo", "sky", "emerald", "amber", "rose", "slate"}
ALLOWED_DENSITIES = {"comfortable", "default", "compact"}
ALLOWED_LOG_LIMITS = {50, 100, 250, 500, 1000, 2500}
ALLOWED_LOG_REFRESH = {0, 2, 5, 10, 30}
ALLOWED_SORT_BY = {"hostname", "name", "ip", "status", "device_type"}
ALLOWED_SORT_ORDER = {"asc", "desc"}
ALLOWED_REFRESH_INTERVALS = {0, 15, 30, 60, 300}

DEFAULT_SETTINGS_DICT = {
    "id": "global",
    "theme": "dark",
    "accent_color": "indigo",
    "density": "default",
    "container_log_limit": 250,
    "log_refresh_interval": 5,
    "container_sort_by": "hostname",
    "container_sort_order": "asc",
    "auto_refresh_interval": 0,
    "confirm_destructive": True,
}


@app.exception_handler(HTTPException)
async def custom_http_exception_handler(request: Request, exc: HTTPException):
    msg = str(exc.detail) if exc.detail else "Request failed."
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": f"HTTP_{exc.status_code}",
            "message": msg,
            "detail": msg,
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    first_msg = "Invalid request parameters."
    if errors:
        loc = ".".join(str(x) for x in errors[0].get("loc", []) if x != "body")
        err_msg = errors[0].get("msg", "invalid value")
        first_msg = f"Validation error on '{loc}': {err_msg}" if loc else f"Validation error: {err_msg}"
    logger.warning("Request validation error on %s: %s", request.url.path, first_msg)
    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "error": "VALIDATION_ERROR",
            "message": first_msg,
            "detail": first_msg,
        },
    )


@app.exception_handler(Exception)
async def global_unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled backend exception on %s %s", request.method, request.url.path)
    msg = f"Internal server error: {str(exc)}"
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": "INTERNAL_SERVER_ERROR",
            "message": msg,
            "detail": msg,
        },
    )


def resolve_active_db_path() -> str:
    try:
        if ACTIVE_DB_PATH:
            return str(ACTIVE_DB_PATH)
    except Exception:
        pass
    try:
        if engine.url.database:
            return str(engine.url.database)
    except Exception:
        pass
    return "/data/inventory.db"


import threading as _threading

_SCHEMA_MIGRATION_LOCK = _threading.Lock()
_SCHEMA_MIGRATED_DONE = False

if "DEFAULT_SETTINGS_DICT" in globals() and isinstance(DEFAULT_SETTINGS_DICT, dict):
    DEFAULT_SETTINGS_DICT.setdefault("docker_parent_host", "")
    DEFAULT_SETTINGS_DICT.setdefault("docker_socket_path", "/var/run/docker.sock")
    DEFAULT_SETTINGS_DICT.setdefault("default_tab", "dashboard")
    DEFAULT_SETTINGS_DICT.setdefault("app_name", "NetDock")
    DEFAULT_SETTINGS_DICT.setdefault("environment_label", "Production")

try:
    from sqlalchemy import event as _sa_event
    @_sa_event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL;")
        cursor.execute("PRAGMA busy_timeout=30000;")
        cursor.execute("PRAGMA synchronous=NORMAL;")
        cursor.execute("PRAGMA foreign_keys=ON;")
        cursor.close()
except Exception as _pragma_exc:
    logger.warning("Could not attach SQLAlchemy PRAGMA listener: %s", _pragma_exc)


def open_sqlite_connection(readonly: bool = False, timeout: float = 30.0) -> sqlite3.Connection:
    db_file = resolve_active_db_path()
    if readonly and os.path.exists(db_file):
        uri = f"file:{db_file}?mode=ro"
        conn = sqlite3.connect(uri, uri=True, timeout=timeout, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA busy_timeout = 30000;")
        return conn
    conn = sqlite3.connect(db_file, timeout=timeout, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA busy_timeout = 30000;")
    conn.execute("PRAGMA synchronous = NORMAL;")
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def run_with_db_retry(operation_name: str, fn, max_attempts: int = 4):
    delay = 0.15
    for attempt in range(1, max_attempts + 1):
        try:
            return fn()
        except sqlite3.OperationalError as exc:
            msg = str(exc).lower()
            if ("locked" in msg or "busy" in msg) and attempt < max_attempts:
                logger.warning(
                    "[DB-LOCK] %s transient lock (attempt %d/%d): %s; retrying in %.2fs",
                    operation_name, attempt, max_attempts, exc, delay
                )
                time.sleep(delay)
                delay *= 2.0
                continue
            logger.error("[DB-ERROR] %s failed after %d attempts: %s", operation_name, attempt, exc)
            raise
        except sqlite3.IntegrityError as exc:
            logger.error("[DB-CONSTRAINT] %s constraint violation: %s", operation_name, exc)
            raise


def get_canonical_default_settings() -> dict:
    base = dict(DEFAULT_SETTINGS_DICT) if "DEFAULT_SETTINGS_DICT" in globals() else {}
    now_ts = int(time.time())
    defaults = {
        "id": "global",
        "theme": "dark",
        "accent_color": "indigo",
        "density": "default",
        "default_tab": "dashboard",
        "app_name": "NetDock",
        "app_title": "NetDock",
        "environment_label": "Production",
        "app_version": APP_VERSION if "APP_VERSION" in globals() else "1.4.0",
        "docker_socket_path": "/var/run/docker.sock",
        "docker_parent_host": "",
        "container_log_limit": 250,
        "log_refresh_interval": 5,
        "container_sort_by": "hostname",
        "container_sort_order": "asc",
        "auto_refresh_interval": 0,
        "confirm_destructive": 1,
        "updated_at": now_ts,
    }
    defaults.update(base)
    if defaults.get("docker_parent_host") is None:
        defaults["docker_parent_host"] = ""
    defaults["id"] = "global"
    defaults["updated_at"] = now_ts
    return defaults


def build_schema_safe_appsettings_row(conn: sqlite3.Connection, overrides: dict = None) -> dict:
    cur = conn.cursor()
    cur.execute("PRAGMA table_info(appsettings)")
    cols_info = [dict(r) for r in cur.fetchall()]
    canonical = get_canonical_default_settings()
    if overrides:
        for k, v in overrides.items():
            if v is not None:
                canonical[k] = v

    dph = canonical.get("docker_parent_host", "")
    canonical["docker_parent_host"] = str(dph).strip() if dph is not None else ""

    row_values = {}
    for col in cols_info:
        cname = col["name"]
        ctype = (col.get("type") or "TEXT").upper()
        dflt = col.get("dflt_value")
        if cname in canonical and canonical[cname] is not None:
            val = canonical[cname]
            if isinstance(val, bool) and ("INT" in ctype or "BOOL" in ctype):
                val = 1 if val else 0
            row_values[cname] = val
        elif dflt is not None:
            cleaned = str(dflt).strip("'\"")
            if "INT" in ctype:
                try:
                    row_values[cname] = int(cleaned)
                except Exception:
                    row_values[cname] = 0
            else:
                row_values[cname] = cleaned
        else:
            if "INT" in ctype or "BOOL" in ctype:
                row_values[cname] = 0
            elif "REAL" in ctype or "FLOA" in ctype or "DOUB" in ctype:
                row_values[cname] = 0.0
            else:
                row_values[cname] = ""
    row_values["id"] = "global"
    return row_values


def upsert_appsettings_row_on_conn(conn: sqlite3.Connection, target_values: dict) -> dict:
    safe_row = build_schema_safe_appsettings_row(conn, target_values)
    cols = list(safe_row.keys())
    placeholders = ", ".join(["?" for _ in cols])
    col_list_sql = ", ".join([f'"{c}"' for c in cols])
    update_clause = ", ".join([f'"{c}" = excluded."{c}"' for c in cols if c != "id"])
    sql = (
        f'INSERT INTO appsettings ({col_list_sql}) VALUES ({placeholders}) '
        f'ON CONFLICT(id) DO UPDATE SET {update_clause}'
    )
    cur = conn.cursor()
    cur.execute(sql, [safe_row[c] for c in cols])
    return safe_row


def _demux_docker_log_stream(raw_bytes: bytes) -> str:
    if not raw_bytes:
        return ""
    pos = 0
    total = len(raw_bytes)
    chunks = []
    if total >= 8 and raw_bytes[0] in (0, 1, 2) and raw_bytes[1:4] == b"\x00\x00\x00":
        while pos + 8 <= total:
            frame_size = int.from_bytes(raw_bytes[pos + 4:pos + 8], byteorder="big")
            pos += 8
            if frame_size < 0 or pos + frame_size > total:
                chunks.append(raw_bytes[pos - 8:].decode("utf-8", errors="replace"))
                break
            chunks.append(raw_bytes[pos:pos + frame_size].decode("utf-8", errors="replace"))
            pos += frame_size
        return "".join(chunks)
    return raw_bytes.decode("utf-8", errors="replace")


def fetch_container_logs_lock_free(container_ref: str, tail: int = None, timestamps: bool = False) -> dict:
    socket_path = "/var/run/docker.sock"
    default_tail = 250
    resolved_target = (container_ref or "").strip()

    try:
        conn = open_sqlite_connection(readonly=True, timeout=5.0)
        try:
            cur = conn.cursor()
            cur.execute("SELECT container_log_limit, docker_socket_path FROM appsettings WHERE id = 'global'")
            s_row = cur.fetchone()
            if s_row:
                if s_row["container_log_limit"]:
                    default_tail = int(s_row["container_log_limit"])
                if s_row["docker_socket_path"]:
                    socket_path = str(s_row["docker_socket_path"]).strip() or "/var/run/docker.sock"

            if resolved_target.isdigit():
                cur.execute("SELECT hostname, name, specs_json FROM host WHERE id = ?", (int(resolved_target),))
                h_row = cur.fetchone()
                if h_row:
                    specs = json.loads(h_row["specs_json"] or "{}") if h_row["specs_json"] else {}
                    resolved_target = (
                        specs.get("container_id")
                        or specs.get("container_name")
                        or h_row["hostname"]
                        or h_row["name"]
                        or resolved_target
                    )
        finally:
            conn.close()
    except Exception as db_exc:
        logger.warning("[DOCKER-LOGS] Settings lookup warning: %s", db_exc)

    effective_tail = max(1, min(int(tail if tail is not None else default_tail), 5000))
    if not resolved_target:
        raise HTTPException(status_code=400, detail="Container identifier is required.")
    if not os.path.exists(socket_path):
        raise HTTPException(status_code=503, detail=f"Docker Engine socket is unavailable at {socket_path}.")

    import urllib.parse
    encoded_id = urllib.parse.quote(resolved_target, safe="")
    ts_flag = "1" if timestamps else "0"

    conn_http = UnixSocketHTTPConnection(socket_path, timeout=10.0)
    try:
        conn_http.request("GET", f"/containers/{encoded_id}/json")
        inspect_resp = conn_http.getresponse()
        inspect_raw = inspect_resp.read()
        if inspect_resp.status == 404:
            raise HTTPException(status_code=404, detail=f"Container '{resolved_target}' was not found in Docker Engine.")
        if inspect_resp.status >= 400:
            raise HTTPException(status_code=502, detail=f"Docker Engine returned HTTP {inspect_resp.status}.")
        inspect_data = json.loads(inspect_raw.decode("utf-8", errors="replace") or "{}")
        c_name = (inspect_data.get("Name") or "").lstrip("/") or resolved_target
        c_state = (inspect_data.get("State") or {}).get("Status") or "unknown"
        c_id = inspect_data.get("Id") or resolved_target
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Could not connect to Docker Engine: {exc}")
    finally:
        try:
            conn_http.close()
        except Exception:
            pass

    conn_logs = UnixSocketHTTPConnection(socket_path, timeout=15.0)
    try:
        logs_path = f"/containers/{encoded_id}/logs?stdout=1&stderr=1&tail={effective_tail}&timestamps={ts_flag}"
        conn_logs.request("GET", logs_path)
        logs_resp = conn_logs.getresponse()
        logs_raw = logs_resp.read()
        if logs_resp.status == 404:
            raise HTTPException(status_code=404, detail=f"Container '{resolved_target}' was not found.")
        if logs_resp.status >= 400:
            raise HTTPException(status_code=502, detail=f"Docker Engine returned HTTP {logs_resp.status} retrieving logs.")
        decoded_logs = _demux_docker_log_stream(logs_raw)
        log_lines = decoded_logs.splitlines() if decoded_logs else []
        return {
            "status": "ok",
            "container_id": c_id,
            "container_name": c_name,
            "container_state": c_state,
            "tail": effective_tail,
            "timestamps": bool(timestamps),
            "line_count": len(log_lines),
            "logs": decoded_logs,
            "lines": log_lines,
            "empty": len(log_lines) == 0,
            "message": "No log output available for this container." if len(log_lines) == 0 else "OK",
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Failed retrieving container logs: {exc}")
    finally:
        try:
            conn_logs.close()
        except Exception:
            pass


def repair_operator_table_everywhere():
    """Ensure the operator table uses id TEXT PRIMARY KEY across SQLAlchemy engine and all /data/*.db files."""
    candidate_paths = set()
    try:
        candidate_paths.add(resolve_active_db_path())
    except Exception:
        pass
    for p in ("/data/inventory.db", "/data/netdock.db"):
        if os.path.exists(p) or os.path.exists(os.path.dirname(p)):
            candidate_paths.add(p)
    try:
        eng_db = getattr(getattr(engine, "url", None), "database", None)
        if eng_db:
            candidate_paths.add(eng_db)
    except Exception:
        pass

    for db_p in candidate_paths:
        if not db_p:
            continue
        try:
            os.makedirs(os.path.dirname(os.path.abspath(db_p)), exist_ok=True)
            conn = sqlite3.connect(db_p, timeout=30.0)
            conn.row_factory = sqlite3.Row
            try:
                cur = conn.cursor()
                cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='operator'")
                if not cur.fetchone():
                    cur.execute("""
                        CREATE TABLE IF NOT EXISTS "operator" (
                            id TEXT NOT NULL PRIMARY KEY,
                            username TEXT NOT NULL,
                            password_hash TEXT NOT NULL,
                            salt TEXT NOT NULL,
                            created_at INTEGER NOT NULL DEFAULT 0
                        )
                    """)
                    conn.commit()
                    continue

                cur.execute('PRAGMA table_info("operator")')
                op_cols = [dict(r) for r in cur.fetchall()]
                id_col = next((c for c in op_cols if c["name"] == "id"), None)
                if id_col and "INT" in (id_col.get("type") or "").upper():
                    cur.execute('SELECT * FROM "operator"')
                    existing_ops = [dict(r) for r in cur.fetchall()]
                    cur.execute('DROP TABLE IF EXISTS "operator_legacy_int_id"')
                    cur.execute('ALTER TABLE "operator" RENAME TO "operator_legacy_int_id"')
                    cur.execute("""
                        CREATE TABLE "operator" (
                            id TEXT NOT NULL PRIMARY KEY,
                            username TEXT NOT NULL,
                            password_hash TEXT NOT NULL,
                            salt TEXT NOT NULL,
                            created_at INTEGER NOT NULL DEFAULT 0
                        )
                    """)
                    for idx, op_row in enumerate(existing_ops):
                        raw_id = op_row.get("id")
                        new_id = "sys_op" if (idx == 0 or raw_id in (None, 1, "1", "sys_op")) else str(raw_id)
                        cur.execute(
                            'INSERT OR REPLACE INTO "operator" (id, username, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?)',
                            (
                                new_id,
                                op_row.get("username") or "admin",
                                op_row.get("password_hash") or "",
                                op_row.get("salt") or "",
                                int(op_row.get("created_at") or int(time.time())),
                            ),
                        )
                    cur.execute('DROP TABLE "operator_legacy_int_id"')
                    conn.commit()
                    logger.info("[DB-MIGRATE] Repaired operator.id (INTEGER -> TEXT) in %s", db_p)
            finally:
                conn.close()
        except Exception as exc:
            logger.warning("[DB-MIGRATE] Could not inspect/repair operator table in %s: %s", db_p, exc)


def ensure_all_schemas_and_migrate(force: bool = False) -> dict:
    global _SCHEMA_MIGRATED_DONE
    db_file = resolve_active_db_path()
    if _SCHEMA_MIGRATED_DONE and not force:
        return {"db_path": db_file, "migrations_applied": [], "cached": True}

    with _SCHEMA_MIGRATION_LOCK:
        if _SCHEMA_MIGRATED_DONE and not force:
            return {"db_path": db_file, "migrations_applied": [], "cached": True}

        migrations_applied = []
        os.makedirs(os.path.dirname(db_file), exist_ok=True)
        try:
            SQLModel.metadata.create_all(engine)
        except Exception as exc:
            logger.warning("[DB-MIGRATE] create_all warning: %s", exc)

        def _migrate_step():
            conn = open_sqlite_connection(readonly=False, timeout=30.0)
            try:
                cur = conn.cursor()
                table_migrations = {
                    "subnet": [
                        ("gateway", "TEXT DEFAULT ''"),
                        ("vlan_id", "INTEGER DEFAULT NULL"),
                        ("description", "TEXT DEFAULT ''"),
                    ],
                    "service": [
                        ("protocol", "TEXT DEFAULT 'TCP'"),
                        ("status", "TEXT DEFAULT 'running'"),
                    ],
                    "appsettings": [
                        ("theme", "TEXT NOT NULL DEFAULT 'dark'"),
                        ("accent_color", "TEXT NOT NULL DEFAULT 'indigo'"),
                        ("density", "TEXT NOT NULL DEFAULT 'default'"),
                        ("docker_parent_host", "TEXT NOT NULL DEFAULT ''"),
                        ("docker_socket_path", "TEXT NOT NULL DEFAULT '/var/run/docker.sock'"),
                        ("default_tab", "TEXT NOT NULL DEFAULT 'dashboard'"),
                        ("container_log_limit", "INTEGER NOT NULL DEFAULT 250"),
                        ("log_refresh_interval", "INTEGER NOT NULL DEFAULT 5"),
                        ("container_sort_by", "TEXT NOT NULL DEFAULT 'hostname'"),
                        ("container_sort_order", "TEXT NOT NULL DEFAULT 'asc'"),
                        ("auto_refresh_interval", "INTEGER NOT NULL DEFAULT 0"),
                        ("confirm_destructive", "INTEGER NOT NULL DEFAULT 1"),
                        ("updated_at", "INTEGER NOT NULL DEFAULT 0"),
                    ],
                }
                for table_name, columns in table_migrations.items():
                    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table_name,))
                    if not cur.fetchone():
                        continue
                    cur.execute(f'PRAGMA table_info("{table_name}")')
                    existing_cols = {row["name"] for row in cur.fetchall()}
                    for col_name, col_def in columns:
                        if col_name not in existing_cols:
                            cur.execute(f'ALTER TABLE "{table_name}" ADD COLUMN "{col_name}" {col_def}')
                            migrations_applied.append(f"{table_name}.{col_name}")

                                # Repair legacy operator table if id was created as INTEGER PRIMARY KEY instead of TEXT PRIMARY KEY
                cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='operator'")
                if cur.fetchone():
                    cur.execute('PRAGMA table_info("operator")')
                    op_cols = [dict(r) for r in cur.fetchall()]
                    id_col = next((c for c in op_cols if c["name"] == "id"), None)
                    if id_col and "INT" in (id_col.get("type") or "").upper():
                        cur.execute('SELECT * FROM "operator"')
                        existing_ops = [dict(r) for r in cur.fetchall()]
                        cur.execute('ALTER TABLE "operator" RENAME TO "operator_legacy_int_id"')
                        cur.execute("""
                            CREATE TABLE "operator" (
                                id TEXT NOT NULL PRIMARY KEY,
                                username TEXT NOT NULL,
                                password_hash TEXT NOT NULL,
                                salt TEXT NOT NULL,
                                created_at INTEGER NOT NULL DEFAULT 0
                            )
                        """)
                        for idx, op_row in enumerate(existing_ops):
                            raw_id = op_row.get("id")
                            new_id = "sys_op" if (idx == 0 or raw_id in (None, 1, "1", "sys_op")) else str(raw_id)
                            cur.execute(
                                'INSERT OR REPLACE INTO "operator" (id, username, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?)',
                                (
                                    new_id,
                                    op_row.get("username") or "admin",
                                    op_row.get("password_hash") or "",
                                    op_row.get("salt") or "",
                                    int(op_row.get("created_at") or int(time.time())),
                                )
                            )
                        cur.execute('DROP TABLE "operator_legacy_int_id"')
                        migrations_applied.append("operator.id_int_to_text")

                cur.execute("SELECT * FROM appsettings WHERE id = 'global'")
                existing_row = cur.fetchone()
                if not existing_row:
                    upsert_appsettings_row_on_conn(conn, get_canonical_default_settings())
                    migrations_applied.append("appsettings.init_global_row")
                else:
                    existing_dict = dict(existing_row)
                    if existing_dict.get("docker_parent_host") is None:
                        upsert_appsettings_row_on_conn(conn, existing_dict)
                        migrations_applied.append("appsettings.repair_null_columns")
                conn.commit()
            except Exception:
                conn.rollback()
                raise
            finally:
                conn.close()

        run_with_db_retry("ensure_all_schemas_and_migrate", _migrate_step)
        _SCHEMA_MIGRATED_DONE = True
        return {"db_path": db_file, "migrations_applied": migrations_applied, "cached": False}



# Run schema verification immediately when module loads
try:
    ensure_all_schemas_and_migrate()
except Exception as _boot_exc:
    logger.error("Startup schema verification warning: %s", _boot_exc)


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


def normalize_settings_dict(raw: dict) -> dict:
    theme = str(raw.get("theme") or "dark").strip().lower()
    if theme not in ALLOWED_THEMES:
        theme = "dark"

    accent = str(raw.get("accent_color") or "indigo").strip().lower()
    if accent not in ALLOWED_ACCENTS:
        accent = "indigo"

    density = str(raw.get("density") or "default").strip().lower()
    if density not in ALLOWED_DENSITIES:
        density = "default"

    try:
        log_limit = int(raw.get("container_log_limit", 250))
    except Exception:
        log_limit = 250
    if log_limit not in ALLOWED_LOG_LIMITS:
        log_limit = 250

    try:
        log_refresh = int(raw.get("log_refresh_interval", 5))
    except Exception:
        log_refresh = 5
    if log_refresh not in ALLOWED_LOG_REFRESH:
        log_refresh = 5

    sort_by = str(raw.get("container_sort_by") or "hostname").strip()
    if sort_by not in ALLOWED_SORT_BY:
        sort_by = "hostname"

    sort_order = str(raw.get("container_sort_order") or "asc").strip().lower()
    if sort_order not in ALLOWED_SORT_ORDER:
        sort_order = "asc"

    try:
        auto_refresh = int(raw.get("auto_refresh_interval", 0))
    except Exception:
        auto_refresh = 0
    if auto_refresh not in ALLOWED_REFRESH_INTERVALS:
        auto_refresh = 0

    confirm_val = raw.get("confirm_destructive")
    if confirm_val is None:
        confirm_bool = True
    elif isinstance(confirm_val, bool):
        confirm_bool = confirm_val
    elif isinstance(confirm_val, (int, float)):
        confirm_bool = bool(confirm_val)
    else:
        confirm_bool = str(confirm_val).strip().lower() not in {"0", "false", "no"}

    try:
        updated_at = int(raw.get("updated_at") or int(time.time()))
    except Exception:
        updated_at = int(time.time())

    return {
        "id": "global",
        "theme": theme,
        "accent_color": accent,
        "density": density,
        "container_log_limit": log_limit,
        "log_refresh_interval": log_refresh,
        "container_sort_by": sort_by,
        "container_sort_order": sort_order,
        "auto_refresh_interval": auto_refresh,
        "confirm_destructive": confirm_bool,
        "updated_at": updated_at,
    }


def read_settings_from_sqlite() -> dict:
    ensure_all_schemas_and_migrate()
    def _read():
        conn = open_sqlite_connection(readonly=True, timeout=15.0)
        try:
            cur = conn.cursor()
            cur.execute("SELECT * FROM appsettings WHERE id = 'global'")
            row = cur.fetchone()
            if row:
                data = dict(row)
                if data.get("docker_parent_host") is None:
                    data["docker_parent_host"] = ""
                return normalize_settings_dict(data) if "normalize_settings_dict" in globals() else data
            return normalize_settings_dict(get_canonical_default_settings()) if "normalize_settings_dict" in globals() else get_canonical_default_settings()
        finally:
            conn.close()
    return run_with_db_retry("read_settings_from_sqlite", _read)



def write_settings_to_sqlite(new_settings: dict) -> dict:
    ensure_all_schemas_and_migrate()
    def _write():
        conn = open_sqlite_connection(readonly=False, timeout=20.0)
        try:
            cur = conn.cursor()
            cur.execute("SELECT * FROM appsettings WHERE id = 'global'")
            existing = dict(cur.fetchone() or {})
            merged = get_canonical_default_settings()
            merged.update({k: v for k, v in existing.items() if v is not None})
            if isinstance(new_settings, dict):
                for k, v in new_settings.items():
                    if v is not None:
                        merged[k] = v
            merged["id"] = "global"
            merged["updated_at"] = int(time.time())
            if merged.get("docker_parent_host") is None:
                merged["docker_parent_host"] = ""
            saved = upsert_appsettings_row_on_conn(conn, merged)
            conn.commit()
            return normalize_settings_dict(saved) if "normalize_settings_dict" in globals() else saved
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
    return run_with_db_retry("write_settings_to_sqlite", _write)



@app.get("/api/v1/settings")
def read_app_settings():
    return read_settings_from_sqlite()


@app.put("/api/v1/settings")
def update_app_settings(payload: SettingsUpdatePayload):
    current = read_settings_from_sqlite()

    if payload.theme is not None:
        clean_theme = payload.theme.strip().lower()
        if clean_theme not in ALLOWED_THEMES:
            raise HTTPException(status_code=400, detail="Theme must be 'dark', 'light', or 'system'.")
        current["theme"] = clean_theme

    if payload.accent_color is not None:
        clean_accent = payload.accent_color.strip().lower()
        if clean_accent not in ALLOWED_ACCENTS:
            raise HTTPException(status_code=400, detail="Unsupported accent color.")
        current["accent_color"] = clean_accent

    if payload.density is not None:
        clean_density = payload.density.strip().lower()
        if clean_density not in ALLOWED_DENSITIES:
            raise HTTPException(status_code=400, detail="Density must be 'comfortable', 'default', or 'compact'.")
        current["density"] = clean_density

    if payload.container_log_limit is not None:
        if payload.container_log_limit not in ALLOWED_LOG_LIMITS:
            raise HTTPException(status_code=400, detail="Log limit must be 50, 100, 250, 500, 1000, or 2500 lines.")
        current["container_log_limit"] = int(payload.container_log_limit)

    if payload.log_refresh_interval is not None:
        if payload.log_refresh_interval not in ALLOWED_LOG_REFRESH:
            raise HTTPException(status_code=400, detail="Log refresh interval must be 0, 2, 5, 10, or 30 seconds.")
        current["log_refresh_interval"] = int(payload.log_refresh_interval)

    if payload.container_sort_by is not None:
        if payload.container_sort_by not in ALLOWED_SORT_BY:
            raise HTTPException(status_code=400, detail="Invalid container sort field.")
        current["container_sort_by"] = payload.container_sort_by

    if payload.container_sort_order is not None:
        if payload.container_sort_order not in ALLOWED_SORT_ORDER:
            raise HTTPException(status_code=400, detail="Sort order must be 'asc' or 'desc'.")
        current["container_sort_order"] = payload.container_sort_order

    if payload.auto_refresh_interval is not None:
        if payload.auto_refresh_interval not in ALLOWED_REFRESH_INTERVALS:
            raise HTTPException(status_code=400, detail="Refresh interval must be 0, 15, 30, 60, or 300 seconds.")
        current["auto_refresh_interval"] = int(payload.auto_refresh_interval)

    if payload.confirm_destructive is not None:
        current["confirm_destructive"] = bool(payload.confirm_destructive)

    return write_settings_to_sqlite(current)


@app.post("/api/v1/settings/reset")
def reset_app_settings():
    ensure_all_schemas_and_migrate()
    def _do_reset():
        conn = open_sqlite_connection(readonly=False, timeout=20.0)
        try:
            defaults = get_canonical_default_settings()
            defaults["docker_parent_host"] = ""
            defaults["updated_at"] = int(time.time())
            saved_row = upsert_appsettings_row_on_conn(conn, defaults)
            conn.commit()
            return normalize_settings_dict(saved_row) if "normalize_settings_dict" in globals() else saved_row
        except Exception as exc:
            conn.rollback()
            logger.exception("[DB-ROLLBACK] Failed resetting settings: %s", exc)
            raise HTTPException(status_code=500, detail=f"Failed to reset application settings: {exc}")
        finally:
            conn.close()
    return run_with_db_retry("reset_app_settings", _do_reset)



def reset_app_settings():
    ensure_all_schemas_and_migrate()
    def _do_reset():
        conn = open_sqlite_connection(readonly=False, timeout=20.0)
        try:
            defaults = get_canonical_default_settings()
            defaults["docker_parent_host"] = ""
            defaults["updated_at"] = int(time.time())
            saved_row = upsert_appsettings_row_on_conn(conn, defaults)
            conn.commit()
            return normalize_settings_dict(saved_row) if "normalize_settings_dict" in globals() else saved_row
        except Exception as exc:
            conn.rollback()
            logger.exception("[DB-ROLLBACK] Failed resetting settings: %s", exc)
            raise HTTPException(status_code=500, detail=f"Failed to reset application settings: {exc}")
        finally:
            conn.close()
    return run_with_db_retry("reset_app_settings", _do_reset)



# --- Safe Value Serializer & Consistent SQLite Snapshot Backup/Restore ---
def sanitize_sqlite_value(val, table_name: str = "", col_name: str = ""):
    if val is None or isinstance(val, (str, int, float, bool)):
        return val
    if isinstance(val, (bytes, bytearray, memoryview)):
        raw_bytes = bytes(val)
        try:
            return raw_bytes.decode("utf-8")
        except UnicodeDecodeError:
            import base64
            return {"__encoding__": "base64", "data": base64.b64encode(raw_bytes).decode("ascii")}
    if isinstance(val, (datetime,)):
        return val.isoformat()
    return str(val)


@app.get("/api/v1/backup/export")
@app.get("/api/v1/export")

def serialize_appsettings(row_or_dict=None) -> dict:
    """Serialize or normalize settings database row/dict for JSON export."""
    if hasattr(row_or_dict, "__dict__"):
        d = {k: v for k, v in row_or_dict.__dict__.items() if not k.startswith("_")}
    elif isinstance(row_or_dict, dict):
        d = dict(row_or_dict)
    else:
        d = {}
    if "normalize_settings_dict" in globals():
        return normalize_settings_dict(d)
    return d


def export_json_backup(session: Session = Depends(get_session)):
    db_file = resolve_active_db_path()

    try:
        hosts_list = session.exec(select(Host)).all()
        subnets_list = session.exec(select(Subnet)).all()
        services_list = session.exec(select(Service)).all()
        custom_types_list = session.exec(select(CustomDeviceType)).all()
        
        settings_row = session.get(AppSettings, "global")
        settings_dict = serialize_appsettings(settings_row) if settings_row else DEFAULT_SETTINGS_DICT
    except Exception as exc:
        logger.exception("Failed querying database via session for backup: %s", exc)
        raise HTTPException(status_code=500, detail=f"Could not read database for backup: {str(exc)}")

    hosts_data = []
    for h in hosts_list:
        h_dict = h.model_dump()
        specs_raw = h_dict.get("specs_json") or "{}"
        try:
            parsed = json.loads(specs_raw) if isinstance(specs_raw, str) else specs_raw
            if not isinstance(parsed, dict):
                parsed = {}
        except Exception:
            parsed = {}
        h_dict["specs_json"] = json.dumps(parsed, ensure_ascii=False)
        h_dict["specs"] = parsed
        hosts_data.append(h_dict)

    subnets_data = [s.model_dump() for s in subnets_list]
    services_data = [srv.model_dump() for srv in services_list]

    custom_types_data = []
    for ct in custom_types_list:
        ct_dict = ct.model_dump()
        f_raw = ct_dict.get("fields_json") or "[]"
        try:
            parsed = json.loads(f_raw) if isinstance(f_raw, str) else f_raw
            if not isinstance(parsed, list):
                parsed = []
        except Exception:
            parsed = []
        ct_dict["fields_json"] = json.dumps(parsed, ensure_ascii=False)
        ct_dict["fields"] = parsed
        custom_types_data.append(ct_dict)

    now_utc = datetime.now(timezone.utc)
    docker_hosts = [
        h for h in hosts_data
        if (h.get("device_type") or "").lower() in {"docker host", "container"}
        or "docker" in (h.get("os") or "").lower()
    ]

    payload = {
        "backup_format": "netdock-backup",
        "version": "2.0",
        "app_version": APP_VERSION,
        "generated_at": now_utc.isoformat(),
        "timestamp": int(now_utc.timestamp()),
        "counts": {
            "hosts": len(hosts_data),
            "docker_entities": len(docker_hosts),
            "subnets": len(subnets_data),
            "services": len(services_data),
            "custom_device_types": len(custom_types_data),
        },
        "settings": settings_dict,
        "appearance": {
            "theme": settings_dict.get("theme", "dark"),
            "accent_color": settings_dict.get("accent_color", "indigo"),
            "density": settings_dict.get("density", "default"),
        },
        "subnets": subnets_data,
        "custom_device_types": custom_types_data,
        "hosts": hosts_data,
        "services": services_data,
    }

    try:
        date_str = now_utc.strftime("%Y-%m-%d")
        filename = f"netdock-backup-{date_str}.json"
        json_bytes = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
        logger.info("Successfully generated session-based backup export (%d bytes).", len(json_bytes))
        return Response(
            content=json_bytes,
            media_type="application/json; charset=utf-8",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Cache-Control": "no-store",
            },
        )
    except Exception as exc:
        logger.exception("JSON serialization error during export: %s", exc)
        raise HTTPException(status_code=500, detail="Could not serialize backup payload to JSON.")


@app.post("/api/v1/backup/import")
@app.post("/api/v1/import")
async def import_json_backup(request: Request, session: Session = Depends(get_session)):
    ensure_all_schemas_and_migrate()

    try:
        raw_body = await request.body()
        if not raw_body:
            raise HTTPException(status_code=400, detail="Backup file is empty.")
        payload = json.loads(raw_body.decode("utf-8"))
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("Rejected malformed JSON backup import: %s", exc)
        raise HTTPException(status_code=400, detail="Invalid JSON file. Could not parse backup contents.")

    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Invalid backup structure: root element must be a JSON object.")

    data_root = payload.get("data") if isinstance(payload.get("data"), dict) else payload
    version = str(payload.get("version", "1.0"))
    if not version.startswith(("1.", "2.")):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported backup format version '{version}'. Expected version 1.x or 2.x.",
        )

    hosts_in = data_root.get("hosts")
    subnets_in = data_root.get("subnets")
    custom_types_in = data_root.get("custom_device_types", [])
    services_in = data_root.get("services", [])
    settings_in = data_root.get("settings")

    if hosts_in is None and subnets_in is None and settings_in is None and not custom_types_in:
        raise HTTPException(
            status_code=400,
            detail="Backup file does not contain recognizable NetDock records ('hosts', 'subnets', or 'settings').",
        )

    if hosts_in is not None and not isinstance(hosts_in, list):
        raise HTTPException(status_code=400, detail="Invalid backup format: 'hosts' must be a list.")
    if subnets_in is not None and not isinstance(subnets_in, list):
        raise HTTPException(status_code=400, detail="Invalid backup format: 'subnets' must be a list.")

    imported_counts = {"subnets": 0, "custom_device_types": 0, "hosts": 0, "services": 0, "settings_updated": False}

    try:
        for s_item in (subnets_in or []):
            if not isinstance(s_item, dict):
                continue
            s_id = str(s_item.get("id") or "").strip() or f"sub-{secrets.token_hex(4)}"
            cidr_val = str(s_item.get("cidr") or "").strip()
            name_val = str(s_item.get("name") or cidr_val or s_id).strip()
            if not cidr_val:
                continue
            existing_sub = session.get(Subnet, s_id)
            if existing_sub:
                existing_sub.name = name_val
                existing_sub.cidr = cidr_val
                existing_sub.gateway = str(s_item.get("gateway") or "")
                existing_sub.vlan_id = s_item.get("vlan_id")
                existing_sub.description = str(s_item.get("description") or "")
                session.add(existing_sub)
            else:
                session.add(
                    Subnet(
                        id=s_id,
                        name=name_val,
                        cidr=cidr_val,
                        gateway=str(s_item.get("gateway") or ""),
                        vlan_id=s_item.get("vlan_id"),
                        description=str(s_item.get("description") or ""),
                    )
                )
            imported_counts["subnets"] += 1

        for ct_item in (custom_types_in or []):
            if not isinstance(ct_item, dict):
                continue
            ct_name = str(ct_item.get("name") or "").strip()
            if not ct_name:
                continue
            ct_id = str(ct_item.get("id") or "").strip() or f"cdt-{secrets.token_hex(4)}"
            fields_val = ct_item.get("fields_json")
            if isinstance(ct_item.get("fields"), list) and not fields_val:
                fields_val = json.dumps(ct_item["fields"], ensure_ascii=False)
            elif not isinstance(fields_val, str):
                fields_val = "[]"

            existing_ct = session.get(CustomDeviceType, ct_id)
            if not existing_ct:
                existing_ct = session.exec(select(CustomDeviceType).where(CustomDeviceType.name == ct_name)).first()

            if existing_ct:
                existing_ct.name = ct_name
                existing_ct.category = str(ct_item.get("category") or "Other")
                existing_ct.icon_name = str(ct_item.get("icon_name") or "Box")
                existing_ct.fields_json = fields_val
                session.add(existing_ct)
            else:
                session.add(
                    CustomDeviceType(
                        id=ct_id,
                        name=ct_name,
                        category=str(ct_item.get("category") or "Other"),
                        icon_name=str(ct_item.get("icon_name") or "Box"),
                        fields_json=fields_val,
                        created_at=int(ct_item.get("created_at") or int(time.time())),
                    )
                )
            imported_counts["custom_device_types"] += 1

        for h_item in (hosts_in or []):
            if not isinstance(h_item, dict):
                continue
            h_id = str(h_item.get("id") or "").strip() or f"dev-{secrets.token_hex(4)}"
            h_hostname = str(h_item.get("hostname") or h_item.get("name") or "").strip()
            h_name = str(h_item.get("name") or h_hostname).strip()
            if not h_name:
                continue

            specs_val = h_item.get("specs_json")
            if isinstance(h_item.get("specs"), dict) and not specs_val:
                specs_val = json.dumps(h_item["specs"], ensure_ascii=False)
            elif isinstance(specs_val, dict):
                specs_val = json.dumps(specs_val, ensure_ascii=False)
            elif not isinstance(specs_val, str) or not specs_val.strip():
                specs_val = "{}"

            dev_type = str(h_item.get("device_type") or "Physical Server").strip()
            dev_cat = str(h_item.get("device_category") or "").strip() or infer_category_from_type(dev_type)

            existing_host = session.get(Host, h_id)
            if existing_host:
                existing_host.name = h_name
                existing_host.hostname = h_hostname
                existing_host.device_category = dev_cat
                existing_host.device_type = dev_type
                existing_host.manufacturer = str(h_item.get("manufacturer") or "")
                existing_host.model = str(h_item.get("model") or "")
                existing_host.ip = str(h_item.get("ip") or "")
                existing_host.ipv6 = str(h_item.get("ipv6") or "")
                existing_host.mac = str(h_item.get("mac") or "")
                existing_host.location = str(h_item.get("location") or "")
                existing_host.serial_number = str(h_item.get("serial_number") or "")
                existing_host.firmware_version = str(h_item.get("firmware_version") or "")
                existing_host.os = str(h_item.get("os") or "")
                existing_host.status = str(h_item.get("status") or "online")
                existing_host.subnet_id = str(h_item.get("subnet_id") or "")
                existing_host.parent_id = h_item.get("parent_id") or None
                existing_host.notes = str(h_item.get("notes") or "")
                existing_host.specs_json = specs_val
                existing_host.updated_at = int(time.time())
                session.add(existing_host)
            else:
                session.add(
                    Host(
                        id=h_id,
                        name=h_name,
                        hostname=h_hostname,
                        device_category=dev_cat,
                        device_type=dev_type,
                        manufacturer=str(h_item.get("manufacturer") or ""),
                        model=str(h_item.get("model") or ""),
                        ip=str(h_item.get("ip") or ""),
                        ipv6=str(h_item.get("ipv6") or ""),
                        mac=str(h_item.get("mac") or ""),
                        location=str(h_item.get("location") or ""),
                        serial_number=str(h_item.get("serial_number") or ""),
                        firmware_version=str(h_item.get("firmware_version") or ""),
                        os=str(h_item.get("os") or ""),
                        status=str(h_item.get("status") or "online"),
                        subnet_id=str(h_item.get("subnet_id") or ""),
                        parent_id=h_item.get("parent_id") or None,
                        notes=str(h_item.get("notes") or ""),
                        specs_json=specs_val,
                        updated_at=int(time.time()),
                    )
                )
            imported_counts["hosts"] += 1

        for srv_item in (services_in or []):
            if not isinstance(srv_item, dict):
                continue
            srv_id = str(srv_item.get("id") or "").strip() or f"srv-{secrets.token_hex(4)}"
            host_id = str(srv_item.get("host_id") or "").strip()
            srv_name = str(srv_item.get("name") or "").strip()
            if not host_id or not srv_name:
                continue
            existing_srv = session.get(Service, srv_id)
            if existing_srv:
                existing_srv.host_id = host_id
                existing_srv.name = srv_name
                existing_srv.port = int(srv_item.get("port") or 80)
                existing_srv.protocol = str(srv_item.get("protocol") or "TCP")
                existing_srv.status = str(srv_item.get("status") or "running")
                session.add(existing_srv)
            else:
                session.add(
                    Service(
                        id=srv_id,
                        host_id=host_id,
                        name=srv_name,
                        port=int(srv_item.get("port") or 80),
                        protocol=str(srv_item.get("protocol") or "TCP"),
                        status=str(srv_item.get("status") or "running"),
                    )
                )
            imported_counts["services"] += 1

        session.commit()

        if isinstance(settings_in, dict):
            current_s = read_settings_from_sqlite()
            current_s.update({k: v for k, v in settings_in.items() if k in DEFAULT_SETTINGS_DICT})
            write_settings_to_sqlite(current_s)
            imported_counts["settings_updated"] = True

        logger.info("Backup import completed successfully: %s", imported_counts)
        return {
            "success": True,
            "status": "imported",
            "version": version,
            "imported": imported_counts,
            "message": (
                f"Restored {imported_counts['hosts']} devices, "
                f"{imported_counts['subnets']} subnets, and "
                f"{imported_counts['custom_device_types']} custom types."
            ),
        }
    except Exception as exc:
        session.rollback()
        logger.exception("Backup import failed during transaction: %s", exc)
        raise HTTPException(status_code=500, detail=f"Failed to import backup data: {str(exc)}")


# --- Real Docker Engine Integration & Diagnostics ---
def docker_unix_get_json(path: str, sock_path: str = "/var/run/docker.sock", timeout: float = 4.0):
    conn = UnixSocketHTTPConnection(sock_path, timeout=timeout)
    try:
        conn.request("GET", path, headers={"Host": "localhost", "Accept": "application/json"})
        res = conn.getresponse()
        raw = res.read().decode("utf-8", errors="replace").strip()
        if res.status != 200:
            raise RuntimeError(f"HTTP {res.status}: {raw[:160]}")
        return json.loads(raw) if raw else {}
    finally:
        conn.close()


def diagnose_docker_engine(sock_path: str = "/var/run/docker.sock") -> dict:
    if not os.path.exists(sock_path):
        return {
            "connected": False,
            "health": "Unavailable",
            "status": "unreachable",
            "reason": "Docker socket (/var/run/docker.sock) is not mounted inside container.",
            "engine_version": None,
            "api_version": None,
            "containers_summary": {"total": 0, "running": 0, "stopped": 0, "paused": 0},
            "containers": [],
        }

    try:
        st = os.stat(sock_path)
        sock_gid = st.st_gid
        sock_mode = oct(st.st_mode & 0o777)
    except Exception:
        sock_gid = None
        sock_mode = None

    try:
        # 1. Ping Docker daemon
        conn = UnixSocketHTTPConnection(sock_path, timeout=3.0)
        conn.request("GET", "/_ping", headers={"Host": "localhost"})
        ping_res = conn.getresponse()
        ping_body = ping_res.read().decode("utf-8", errors="replace").strip()
        conn.close()
        if ping_res.status != 200:
            return {
                "connected": False,
                "health": "Error",
                "status": "unreachable",
                "reason": f"Docker daemon ping returned HTTP {ping_res.status}",
                "engine_version": None,
                "api_version": None,
                "containers_summary": {"total": 0, "running": 0, "stopped": 0, "paused": 0},
                "containers": [],
            }

        # 2. Fetch Docker Engine version & container list
        ver_data = docker_unix_get_json("/version", sock_path=sock_path)
        raw_containers = docker_unix_get_json("/containers/json?all=1", sock_path=sock_path)
        if not isinstance(raw_containers, list):
            raw_containers = []

        running_cnt = 0
        paused_cnt = 0
        stopped_cnt = 0
        container_items = []
        for c in raw_containers:
            state = str(c.get("State") or "").lower()
            if state == "running":
                running_cnt += 1
            elif state == "paused":
                paused_cnt += 1
            else:
                stopped_cnt += 1
            names = c.get("Names") or []
            clean_name = names[0].lstrip("/") if names else (c.get("Id") or "")[:12]
            container_items.append({
                "id": (c.get("Id") or "")[:12],
                "name": clean_name,
                "image": c.get("Image") or "",
                "state": state,
                "status": c.get("Status") or state,
            })

        engine_ver = ver_data.get("Version") or "Unknown"
        api_ver = ver_data.get("ApiVersion") or "Unknown"
        return {
            "connected": True,
            "health": "Healthy",
            "status": "connected",
            "reason": f"Connected to Docker Engine v{engine_ver} (API v{api_ver}, {running_cnt}/{len(raw_containers)} running)",
            "engine_version": engine_ver,
            "api_version": api_ver,
            "socket_gid": sock_gid,
            "socket_mode": sock_mode,
            "containers_summary": {
                "total": len(raw_containers),
                "running": running_cnt,
                "paused": paused_cnt,
                "stopped": stopped_cnt,
            },
            "containers": container_items,
        }
    except PermissionError:
        proc_uid = os.getuid()
        proc_gid = os.getgid()
        proc_groups = os.getgroups()
        return {
            "connected": False,
            "health": "Error",
            "status": "permission_denied",
            "reason": (
                f"Permission denied on {sock_path} "
                f"(socket GID={sock_gid}, mode={sock_mode}; container UID={proc_uid}, GID={proc_gid}, groups={proc_groups})."
            ),
            "engine_version": None,
            "api_version": None,
            "containers_summary": {"total": 0, "running": 0, "stopped": 0, "paused": 0},
            "containers": [],
        }
    except Exception as exc:
        logger.warning("Docker socket connection error on %s: %s", sock_path, exc)
        return {
            "connected": False,
            "health": "Unavailable",
            "status": "unreachable",
            "reason": f"Docker daemon unreachable ({type(exc).__name__}: {str(exc)})",
            "engine_version": None,
            "api_version": None,
            "containers_summary": {"total": 0, "running": 0, "stopped": 0, "paused": 0},
            "containers": [],
        }


@app.get("/api/v1/integrations/docker/containers")
def list_docker_engine_containers():
    diag = diagnose_docker_engine("/var/run/docker.sock")
    if not diag["connected"]:
        raise HTTPException(status_code=503, detail=diag["reason"])
    return {
        "connected": True,
        "engine_version": diag["engine_version"],
        "api_version": diag["api_version"],
        "summary": diag["containers_summary"],
        "containers": diag["containers"],
    }


@app.get("/api/v1/integrations/docker/logs/{container_name}")
def get_container_logs(container_name: str, tail: int = None, limit: int = None, lines: int = None, timestamps: bool = False):
    return fetch_container_logs_lock_free(container_ref=container_name, tail=(tail or limit or lines), timestamps=timestamps)


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
    session: Session = Depends(get_session),
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
                raise HTTPException(
                    status_code=400,
                    detail="Username may only contain letters, numbers, '_', '-', and '.'.",
                )
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


# --- Centralized Database Diagnostic & System Health Endpoint ---
def run_centralized_db_diagnostics() -> dict:
    db_file = resolve_active_db_path()
    wal_file = f"{db_file}-wal"
    shm_file = f"{db_file}-shm"

    exists = os.path.exists(db_file)
    readable = os.access(db_file, os.R_OK) if exists else False
    writable = os.access(db_file, os.W_OK) if exists else False

    integrity_status = "error"
    journal_mode = "unknown"
    tables_found = []
    required_tables = {"subnet", "host", "service", "operator", "customdevicetype", "appsettings"}
    missing_tables = []
    settings_rw_ok = False
    error_detail = None

    conn = None
    try:
        conn = sqlite3.connect(db_file, timeout=10.0)
        cur = conn.cursor()
        cur.execute("PRAGMA wal_checkpoint(PASSIVE);")

        jm_row = cur.execute("PRAGMA journal_mode;").fetchone()
        if jm_row:
            journal_mode = str(jm_row[0]).upper()

        ic_row = cur.execute("PRAGMA integrity_check;").fetchone()
        if ic_row:
            integrity_status = str(ic_row[0])

        tables_found = [
            r[0]
            for r in cur.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
            ).fetchall()
        ]
        missing_tables = sorted(list(required_tables - set(tables_found)))

        # Non-destructive settings read & write verification (re-writes existing updated_at value)
        cur.execute("SELECT theme, updated_at FROM appsettings WHERE id = 'global'")
        s_row = cur.fetchone()
        if s_row is not None:
            cur.execute("UPDATE appsettings SET updated_at = ? WHERE id = 'global'", (s_row[1],))
            conn.commit()
            settings_rw_ok = True
    except Exception as exc:
        logger.exception("Database diagnostic failure on %s: %s", db_file, exc)
        error_detail = f"{type(exc).__name__}: {str(exc)}"
    finally:
        if conn:
            conn.close()

    main_size = os.path.getsize(db_file) if os.path.exists(db_file) else 0
    wal_size = os.path.getsize(wal_file) if os.path.exists(wal_file) else 0
    shm_size = os.path.getsize(shm_file) if os.path.exists(shm_file) else 0
    total_size = main_size + wal_size

    is_healthy = (
        exists
        and readable
        and writable
        and integrity_status.lower() == "ok"
        and len(missing_tables) == 0
        and settings_rw_ok
    )

    return {
        "database_path": db_file,
        "database_exists": exists,
        "readable": readable,
        "writable": writable,
        "database_healthy": is_healthy,
        "health_label": "Healthy" if is_healthy else ("Degraded" if exists and readable else "Error"),
        "integrity_check": integrity_status,
        "journal_mode": journal_mode,
        "tables": tables_found,
        "missing_tables": missing_tables,
        "migrations_complete": len(missing_tables) == 0,
        "settings_rw_verified": settings_rw_ok,
        "database_size_bytes": total_size,
        "main_file_bytes": main_size,
        "wal_file_bytes": wal_size,
        "shm_file_bytes": shm_size,
        "error": error_detail,
    }


@app.get("/api/v1/system/diagnostics")
def get_detailed_diagnostics():
    db_diag = run_centralized_db_diagnostics()
    docker_diag = diagnose_docker_engine("/var/run/docker.sock")
    return {
        "timestamp": int(time.time()),
        "database": db_diag,
        "docker": docker_diag,
    }


@app.get("/api/v1/system/info")
def get_system_information(session: Session = Depends(get_session)):
    db_diag = run_centralized_db_diagnostics()
    docker_diag = diagnose_docker_engine("/var/run/docker.sock")

    hosts_list = session.exec(select(Host)).all()
    subnets_list = session.exec(select(Subnet)).all()
    services_list = session.exec(select(Service)).all()
    custom_types_list = session.exec(select(CustomDeviceType)).all()

    active_count = sum(
        1 for h in hosts_list
        if (h.status or "").lower() in {"active", "online"}
    )
    tracked_db_containers = sum(
        1 for h in hosts_list
        if (h.device_type or "").lower() == "container"
    )
    live_docker_containers = docker_diag["containers_summary"]["total"]
    container_count = max(tracked_db_containers, live_docker_containers)

    if db_diag["database_healthy"] and docker_diag["connected"]:
        overall_status = "healthy"
    elif db_diag["database_healthy"]:
        overall_status = "degraded"
    else:
        overall_status = "error"

    return {
        "app_name": "NetDock",
        "app_version": APP_VERSION,
        "environment": "Production",
        "api_status": overall_status,
        "api_health_label": "Healthy" if db_diag["database_healthy"] else "Degraded",
        "uptime_seconds": max(0, int(time.time()) - PROCESS_START_TIME),
        "started_at": PROCESS_START_TIME,
        "python_version": platform.python_version(),
        "os_platform": f"{platform.system()} {platform.release()} ({platform.machine()})",
        "database_path": db_diag["database_path"],
        "database_exists": db_diag["database_exists"],
        "database_readable": db_diag["readable"],
        "database_writable": db_diag["writable"],
        "database_healthy": db_diag["database_healthy"],
        "database_health_label": db_diag["health_label"],
        "database_integrity": db_diag["integrity_check"],
        "settings_rw_verified": db_diag["settings_rw_verified"],
        "journal_mode": db_diag["journal_mode"],
        "database_size_bytes": db_diag["database_size_bytes"],
        "database_main_bytes": db_diag["main_file_bytes"],
        "database_wal_bytes": db_diag["wal_file_bytes"],
        "docker_socket_path": "/var/run/docker.sock",
        "docker_status": "connected" if docker_diag["connected"] else "unreachable",
        "docker_health_label": docker_diag["health"],
        "docker_diagnostic_status": docker_diag["status"],
        "docker_engine_version": docker_diag["engine_version"],
        "docker_api_version": docker_diag["api_version"],
        "docker_containers_summary": docker_diag["containers_summary"],
        "docker_error": None if docker_diag["connected"] else docker_diag["reason"],
        "docker_message": docker_diag["reason"],
        "counts": {
            "hosts": len(hosts_list),
            "active_hosts": active_count,
            "containers": container_count,
            "tracked_containers": tracked_db_containers,
            "live_docker_containers": live_docker_containers,
            "subnets": len(subnets_list),
            "services": len(services_list),
            "custom_device_types": len(custom_types_list),
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

try:
    repair_operator_table_everywhere()
    ensure_all_schemas_and_migrate(force=True)
except Exception as _startup_mig_exc:
    logger.warning("[DB-MIGRATE] Startup migration hook warning: %s", _startup_mig_exc)
