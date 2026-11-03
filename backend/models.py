from typing import Optional
from sqlmodel import SQLModel, Field


class Subnet(SQLModel, table=True):
    id: str = Field(primary_key=True)
    name: str
    cidr: str
    gateway: Optional[str] = ""
    vlan_id: Optional[int] = None
    description: Optional[str] = ""


class Host(SQLModel, table=True):
    id: str = Field(primary_key=True)
    name: Optional[str] = Field(default="")
    hostname: str
    device_category: Optional[str] = Field(default="Servers and Computing")
    device_type: str = Field(default="Physical Server")
    manufacturer: Optional[str] = Field(default="")
    model: Optional[str] = Field(default="")
    ip: str = Field(default="")
    ipv6: Optional[str] = Field(default="")
    mac: Optional[str] = Field(default="")
    location: Optional[str] = Field(default="")
    serial_number: Optional[str] = Field(default="")
    firmware_version: Optional[str] = Field(default="")
    os: Optional[str] = Field(default="")
    status: str = Field(default="online")
    subnet_id: Optional[str] = Field(default="")
    parent_id: Optional[str] = Field(default=None)
    notes: Optional[str] = Field(default="")
    specs_json: Optional[str] = Field(default="{}")
    updated_at: Optional[int] = Field(default=0)


class CustomDeviceType(SQLModel, table=True):
    id: str = Field(primary_key=True)
    name: str
    category: str = Field(default="Other")
    icon_name: str = Field(default="Box")
    fields_json: str = Field(default="[]")
    created_at: int = Field(default=0)


class Service(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    host_id: str
    port: int
    protocol: str = "tcp"
    service_name: str
    status: str = "open"


class Operator(SQLModel, table=True):
    id: str = Field(default="sys_op", primary_key=True)
    username: str
    salt: str
    password_hash: str
    created_at: int = Field(default=0)


class AppSettings(SQLModel, table=True):
    id: str = Field(default="global", primary_key=True)
    theme: str = Field(default="dark")
    accent_color: str = Field(default="indigo")
    density: str = Field(default="default")
    container_log_limit: int = Field(default=250)
    log_refresh_interval: int = Field(default=5)
    container_sort_by: str = Field(default="hostname")
    container_sort_order: str = Field(default="asc")
    auto_refresh_interval: int = Field(default=0)
    confirm_destructive: bool = Field(default=True)
    updated_at: int = Field(default=0)
