# Docker

## Architecture

Docker Compose is split into two files for separation of concerns:

- `docker-compose.db.yml` — Database services (PostgreSQL, Redis) on the shared `pfnapp-net` network
- `docker-compose.app.yml` — Application services (Web, Workers) on the same external `pfnapp-net` network

The supported production topology has exactly two application images:
`projects-green-web` and `projects-green-workers`. The unified worker owns the
BullMQ consumers and interval-based work; there is no billing-only image or
Kubernetes CronJob for the current scheduler.

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

## Published Images

The main-branch workflow publishes one immutable commit tag for each image:

- `ghcr.io/juniyadi/projects-green-web:sha-<commit>`
- `ghcr.io/juniyadi/projects-green-workers:sha-<commit>`

It does not publish a mutable `latest` tag or a billing-only image. GitOps
values must reference the full `sha-<commit>` tag.

## Individual Image Builds

```bash
# Web
docker build -f Dockerfile.web -t projects-green-web:local .

# Workers
docker build -f Dockerfile.workers -t projects-green-workers:local .
```

## Kubernetes Operations Note

The ArgoCD repository is the Kubernetes source of truth. It must render:

| Workload | Image | Network exposure | Scaling |
| --- | --- | --- | --- |
| `projects-green-web` | `projects-green-web:sha-<commit>` | Service and ingress | Deployment defaults |
| `projects-green-workers` | `projects-green-workers:sha-<commit>` | None | Exactly one replica; no HPA |

The web Deployment should use `/api/healthz/live` for liveness and
`/api/healthz/ready` for readiness. The worker has no HTTP listener; use an
exec liveness probe of `kill -0 1`. Configure the worker with a
`terminationGracePeriodSeconds` of at least `120`, resource requests of
`250m` CPU and `512Mi` memory, and limits of `1` CPU and `1Gi` memory. The
worker handles `SIGTERM` by stopping interval scheduling, closing BullMQ
workers after active jobs finish, closing producer queues, and disconnecting
Prisma.

Do not add a Service, ingress, HPA, or Kubernetes CronJob for the worker. Its
repeatable billing schedules and in-memory intervals are singleton work. Do
not scale it beyond one replica until leader election exists or every interval
task has been moved to an independent, finite, idempotent job. A rollout is
healthy when both Deployments report available replicas, web health checks
pass, and worker logs show one repeatable-job registration followed by a
completed scheduled job.

## Useful Commands

```bash
# View logs
docker compose -f docker-compose.db.yml logs -f postgres
docker compose -f docker-compose.app.yml logs -f web
docker compose -f docker-compose.app.yml logs -f workers

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
