# Docker

## Architecture

Docker Compose is split into two files for separation of concerns:

- `docker-compose.db.yml` — Database services (PostgreSQL, Redis) on the shared `pfnapp-net` network
- `docker-compose.app.yml` — Application services (Web, Workers) on the same external `pfnapp-net` network

The database and app compose files share a named external network (`pfnapp-net`) so the app services can resolve the `postgres` and `redis` hostnames and wait for them to be healthy via `depends_on`.

> **Important:** Always start `docker-compose.db.yml` before `docker-compose.app.yml` so the shared network exists.

## Quick Start

### Start database services

```bash
docker compose -f docker-compose.db.yml up -d
```

### Start application services

```bash
docker compose -f docker-compose.app.yml up -d
```

### Start everything (merged)

```bash
docker compose -f docker-compose.db.yml -f docker-compose.app.yml up -d
```

## Build Commands

### Build web image

```bash
docker compose -f docker-compose.app.yml build web
```

### Build workers image

```bash
docker compose -f docker-compose.app.yml build workers
```

### Build all app images

```bash
docker compose -f docker-compose.app.yml build
```

## Individual Image Builds

```bash
# Web
docker build -f Dockerfile.web -t pfnapp-web .

# Workers
docker build -f Dockerfile.workers -t pfnapp-workers .

# Billing worker
docker build -f scripts/Dockerfile.billing -t billing-worker .
```

## Useful Commands

```bash
# View logs
docker compose -f docker-compose.db.yml logs -f postgres
docker compose -f docker-compose.app.yml logs -f web

# Stop services
docker compose -f docker-compose.app.yml down
docker compose -f docker-compose.db.yml down

# Stop everything (including volumes and shared network)
docker compose -f docker-compose.db.yml down -v
docker network rm pfnapp-net

# Rebuild without cache
docker compose -f docker-compose.app.yml build --no-cache web
```

## Environment Variables

Copy `.env.example` to `.env` and fill in the required values before starting app services.

```bash
cp .env.example .env
```
