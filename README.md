# NetDock

A lightweight, self-hosted network documentation tool.

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
