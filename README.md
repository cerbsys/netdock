# NetDock

A lightweight, self-hosted network documentation tool.

- **Host Inventory:** Track bare-metal servers, VMs, containers, and network switches.
- **Automated Docker Sync:** Connects directly to `/var/run/docker.sock` to detect local containers, inspect IP/MAC assignments, and import them automatically.
- **Network Map:** Visualize hierarchical relationships between parent hosts and child instances.
- **Runbooks:** Document device credentials, open ports, and procedures inline.
- **Portability:** Fast JSON-based database export and disaster recovery restore.

## Quick Start (Docker Compose)

Save the following `docker-compose.yml`:

```yaml
services:
  netdock:
    image: ghcr.io/cerbsys/netdock:latest
    container_name: netdock2
    restart: unless-stopped
    ports:
      - "8685:8000"
    user: "0:983"
    dns:
      - 1.1.1.1
      - 8.8.8.8
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
