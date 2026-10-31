from typing import Optional
from sqlmodel import SQLModel, Field
from pydantic import field_validator
import ipaddress
import re

MAC_REGEX = re.compile(r"^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$")
HOSTNAME_REGEX = re.compile(r"^(?![0-9]+$)(?!-)[a-zA-Z0-9-]{1,63}(?<!-)$")

RFC1918_NETWORKS = [
    ipaddress.IPv4Network("10.0.0.0/8"),
    ipaddress.IPv4Network("172.16.0.0/12"),
    ipaddress.IPv4Network("192.168.0.0/16"),
]

def validate_rfc1918_ip(ip_str: str) -> ipaddress.IPv4Address:
    try:
        ip = ipaddress.IPv4Address(ip_str.strip())
    except Exception:
        raise ValueError(f"'{ip_str}' is not a valid IPv4 address.")

    if not any(ip in net for net in RFC1918_NETWORKS):
        raise ValueError(
            f"IP {ip_str} is not a valid RFC 1918 private address (10.x, 172.16-31.x, or 192.168.x)."
        )
    return ip

class Subnet(SQLModel, table=True):
    id: str = Field(primary_key=True)
    name: str
    cidr: str
    vlan: int
    gateway: str

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        clean = v.strip()
        if not clean or len(clean) < 2:
            raise ValueError("Subnet name must be at least 2 characters.")
        return clean

    @field_validator("vlan")
    @classmethod
    def validate_vlan(cls, v: int) -> int:
        if not (1 <= v <= 4094):
            raise ValueError("VLAN tag must be an integer between 1 and 4094.")
        return v

    @field_validator("cidr")
    @classmethod
    def validate_cidr(cls, v: str) -> str:
        clean = v.strip()
        try:
            subnet_net = ipaddress.IPv4Network(clean, strict=True)
        except Exception:
            raise ValueError(f"Invalid IPv4 CIDR range: '{clean}'.")

        if not any(subnet_net.subnet_of(net) for net in RFC1918_NETWORKS):
            raise ValueError(
                f"Subnet '{clean}' must fall within 10.0.0.0/8, 172.16.0.0/12, or 192.168.0.0/16."
            )
        return clean

    @field_validator("gateway")
    @classmethod
    def validate_gateway(cls, v: str, info) -> str:
        clean = v.strip()
        gw_ip = validate_rfc1918_ip(clean)

        cidr = info.data.get("cidr")
        if cidr:
            try:
                network = ipaddress.IPv4Network(cidr.strip(), strict=True)
                if gw_ip not in network:
                    raise ValueError(f"Gateway {clean} does not belong to subnet {cidr}.")
                if gw_ip == network.network_address:
                    raise ValueError(f"Gateway cannot be the network address ({network.network_address}).")
                if gw_ip == network.broadcast_address:
                    raise ValueError(f"Gateway cannot be the broadcast address ({network.broadcast_address}).")
            except Exception:
                pass
        return clean

class Host(SQLModel, table=True):
    id: str = Field(primary_key=True)
    hostname: str
    ip: str
    mac: Optional[str] = ""
    os: str = "Linux"
    status: str = "active"
    device_type: str = "server"
    subnet_id: str = Field(foreign_key="subnet.id")
    parent_id: Optional[str] = None
    notes: Optional[str] = ""

    @field_validator("hostname")
    @classmethod
    def validate_hostname(cls, v: str) -> str:
        clean = v.strip().lower()
        if not HOSTNAME_REGEX.match(clean):
            raise ValueError("Hostname must follow RFC 1123 (alphanumeric and hyphens only).")
        return clean

    @field_validator("ip")
    @classmethod
    def validate_ip(cls, v: str) -> str:
        validate_rfc1918_ip(v.strip())
        return v.strip()

    @field_validator("mac")
    @classmethod
    def validate_mac(cls, v: Optional[str]) -> Optional[str]:
        if not v or not v.strip():
            return ""
        clean = v.strip().lower()
        if not MAC_REGEX.match(clean):
            raise ValueError("Invalid MAC address format (must be 6 hex pairs, e.g., bc:24:11:92:aa:01).")
        return clean

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        valid_statuses = {"active", "offline", "maintenance", "decommissioned"}
        clean = v.strip().lower()
        if clean not in valid_statuses:
            raise ValueError(f"Status must be one of: {', '.join(valid_statuses)}")
        return clean

class Service(SQLModel, table=True):
    id: str = Field(primary_key=True)
    host_id: str = Field(foreign_key="host.id")
    name: str
    port: int
    protocol: str = "TCP"
    url: Optional[str] = None

    @field_validator("port")
    @classmethod
    def validate_port(cls, v: int) -> int:
        if not (1 <= v <= 65535):
            raise ValueError("Port must be between 1 and 65535.")
        return v
