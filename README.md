# NetDock

A lightweight, self-hosted network documentation and IPAM rack manager.

## Quick Start (Docker Compose)

Save the following `docker-compose.yml`:

```yaml
services:
  netdock:
    image: ghcr.io/<YOUR-GITHUB-USERNAME>/netdock:latest
    container_name: netdock
    restart: unless-stopped
    ports:
      - "8085:8000"
    volumes:
      - ./data:/data
Run:
docker compose up -d
Access the interface at http://localhost:8085.
