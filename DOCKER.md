# Docker

## Architecture

Docker Compose is split into two files for separation of concerns:

- `docker-compose.db.yml` — Database services (PostgreSQL, Redis)
- `docker-compose.app.yml` — Application services (Web, Workers)

## Quick Start

### Start database services

```bash
docker compose -f docker-compose.db.yml up -d
```

### Start application services

```bash
docker compose -f docker-compose.app.yml up -d
```

### Start everything

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

# Stop everything (including volumes)
docker compose -f docker-compose.db.yml -f docker-compose.app.yml down -v

# Rebuild without cache
docker compose -f docker-compose.app.yml build --no-cache web
```

## Environment Variables

Copy `.env.example` to `.env` and fill in the required values before starting app services.

```bash
cp .env.example .env
```
