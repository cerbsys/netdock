# NetDock

A lightweight, self-hosted platform for documenting, organizing, and managing your network infrastructure.

NetDock is built for homelab enthusiasts, self-hosters, and administrators who want a better way to keep track of their infrastructure without relying on scattered spreadsheets or notes.

## Features
### Infrastructure Inventory
- **Host Management** – Keep track of physical servers, virtual machines, and other infrastructure.
- **Docker Integration** – Automatically discover and synchronize local Docker containers.
- **IP & MAC Tracking** – Keep network addressing information organized alongside your devices.

### Network Organization
- **Network Mapping** – Visualize hierarchical relationships between parent hosts and child instances.
- **Centralized Inventory** – Keep your infrastructure information accessible from one interface.
- **Device Relationships** – Organize containers and virtual machines under their respective hosts.

### Documentation
- **Runbooks** – Document credentials, open ports, procedures, and important device information.
- **Operational Notes** – Keep useful information associated with individual infrastructure entries.
- **Backup & Restore** – Export your database to JSON and restore it when needed.

### Self Hosted
- **Docker Deployment** – Deploy using Docker Compose.
- **Persistent Storage** – Keep application data between container updates.
- **Lightweight Architecture** – React frontend with a Python backend and SQLite database.
- **Private Infrastructure** – Designed for use within your own trusted network.

## Installation
NetDock is distributed as a Docker container through GitHub Container Registry.

## Requirements
- Docker Engine
- Docker Compose
- Access to the Docker socket for automatic container discovery



Save the following `docker-compose.yml`:

```yaml
services:
  netdock:
    image: ghcr.io/cerbsys/netdock:latest
    container_name: netdock
    restart: unless-stopped
    ports:
      - "8085:8000"
    user: "0:GID" Replace GID with your host GID
    volumes:
      - ./data:/data
      - /var/run/docker.sock:/var/run/docker.sock:ro
    environment:
      - PYTHONUNBUFFERED=1

```
Run:
docker compose up -d

Access the interface at http://localhost:8085.

**REMEMBER** This tool is intended for personal network use, this should not be externally facing!

If you encounter an issue or have an idea for improving NetDock, please open an issue in the GitHub repository.

## Project
### Developed by Cerbsys
- Repository: https://github.com/cerbsys/netdock
- Container Image: ghcr.io/cerbsys/netdock:latest

***NetDock - Your infrastructure, organized.***
