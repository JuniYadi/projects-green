# Database Docker Compose

> 7 nodes · cohesion 0.33

## Key Concepts

- **Database Docker Compose** (4 connections) — `docker-compose.db.yml`
- **Application Docker Compose** (3 connections) — `docker-compose.app.yml`
- **Docker Configuration** (2 connections) — `DOCKER.md`
- **Docker Network pfnapp-net** (2 connections) — `docker-compose.app.yml`
- **Redis** (2 connections) — `README.md`
- **PostgreSQL Database** (1 connections) — `docker-compose.db.yml`
- **Docker Publish Workflow** (1 connections) — `.github/workflows/docker-publish.yml`

## Relationships

- [/graphify](-graphify.md) (1 shared connections)

## Source Files

- `.github/workflows/docker-publish.yml`
- `DOCKER.md`
- `README.md`
- `docker-compose.app.yml`
- `docker-compose.db.yml`

## Audit Trail

- EXTRACTED: 15 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*