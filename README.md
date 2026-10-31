# NetDock

A lightweight, self-hosted network documentation tool.

- **Host Inventory:** Track bare-metal servers, VMs, containers, and network switches.
- **Network Map:** Visualize hierarchical relationships between parent hosts and child instances.
- **Runbooks:** Document device credentials, open ports, and procedures inline.
- **Portability:** Fast JSON-based database export and disaster recovery restore.

## Quick Start (Docker Compose)

Save the following `docker-compose.yml`:

```yaml
services:
  netdock:
    image: ghcr.io/cerbsys/netdock:latest
    container_name: netdock
    restart: unless-stopped
    ports:
      - "8085:8000"
    volumes:
      - ./data:/data

```
Run:
docker compose up -d


Access the interface at http://localhost:8085.

**REMEMBER** This tool is intended for personal network use, this should not be externally facing!
