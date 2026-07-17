# Architecture Overview

## Multi-Tenant SaaS Architecture

projects-green follows a **multi-tenant SaaS** model with two distinct user areas:

- **Console** (`/console`) — tenant members use WhatsApp messaging, VPN subscriptions, billing, and support tickets
- **Portal** (`/portal`) — tenant admins/owners and platform super_admins manage org settings, billing CRUD, VPN servers, WhatsApp admin, support tickets

### Role Model

Authentication is handled by **WorkOS AuthKit**, which provides OAuth, magic codes, password, and email verification. Two layers of authorization:

1. **Platform role** — stored in the `PlatformUserRole` table in PostgreSQL. Values: `NONE` | `SUPER_ADMIN`. Grants cross-tenant access.
2. **Tenant role** — managed via WorkOS organization memberships. Values: `owner` | `admin` | `member`. Scoped to a single tenant.

**Role routing logic** (in `proxy.ts` middleware):

| Role | Routes to | Access |
|------|-----------|--------|
| `super_admin` | Portal (admin dashboard) | Full cross-tenant access |
| Tenant `owner` / `admin` | Portal | Admin features for their org |
| Tenant `member` | Console | Standard user features |

Key source: `/proxy.ts`, `/modules/tenants/tenant-policy.ts`, `/lib/platform-role.ts`

---

## API Layer: Elysia Inside Next.js

All API routes run through **Elysia.js** mounted at the catch-all route `/app/api/[[...slugs]]/route.ts`. Each feature module defines its own routes using `new Elysia()`, composed via `.use()` in `/lib/api.ts`.

```
Request → Next.js Middleware (proxy.ts) → Elysia App Router (/lib/api.ts)
                                           ├── authRoutes
                                           ├── whatsappRoutes (19 sub-routers)
                                           ├── vpnRoutes + mobileVpnRoutes
                                           ├── billingRoutes
                                           ├── deployRoutes
                                           ├── githubRoutes
                                           ├── cloudflareDnsTokenRoutes
                                           ├── supportTicketRoutes
                                           └── ... (25+ route groups total)
```

### Type-Safe Client

The **Eden Treaty** client (`/lib/eden.ts`) provides end-to-end type safety by importing the `App` type from `/lib/api.ts`. The fetcher delegates to `globalThis.fetch` at call time so tests can inject mocks.

### Validation

- **Elysia validation** — TypeBox schemas for route-level validation
- **Zod v4** — for complex shared schemas (in `modules/*/*.schema.ts`)
- Validation errors return: `{ ok: false, error: "VALIDATION_ERROR", message, fieldErrors }`

Key source: `/lib/api.ts`, `/lib/eden.ts`, `/app/api/[[...slugs]]/route.ts`

---

## Auth Flow

```
Browser → proxy.ts middleware
  ├── /api or /callback paths → authkit refresh, then pass through
  ├── protected paths (/console, /portal) → require valid session
  │     ├── session? → resolve role → route to correct area
  │     ├── no session? → redirect to /login
  │     └── API request (sk-xxx / live_xxx)? → Elysia falls through to API-key auth
  └── public paths → pass through
```

Key points:
- `/api` and `/callback` paths skip locale routing but still run authkit for session cookie refresh
- The middleware injects WorkOS session info into request headers for Elysia routes to consume
- Unauthenticated API calls (curl with API keys) return `{ session: null }` from authkit — Elysia plugins handle API-key auth

Key source: `/proxy.ts`

---

## Background Processing: BullMQ + Redis

The platform uses **BullMQ** (backed by Redis 7) for asynchronous job processing. All workers run in a **single unified process** (`/scripts/workers.ts`) for simple deployment.

### BullMQ Queues

| Queue | Concurrency | Handler |
|-------|-------------|---------|
| `github-events` | 4 | `/modules/github/jobs/github-event.job.ts` |
| `billing-daily-reset` | 1 | `/lib/queue/billing-cron.ts` |
| `billing-monthly-reset` | 1 | `/lib/queue/billing-cron.ts` |
| `billing-invoice-status` | 1 | `/lib/queue/billing-cron.ts` |
| `billing-payment-reminder` | 1 | `/lib/queue/billing-cron.ts` |
| `opensearch-ingest` | 4 | `/modules/deploy/opensearch/opensearch-log.service.ts` |
| `quota-reconciliation` | 4 | `/lib/queue/quota-reconciliation.ts` |
| `whatsapp-broadcast` | 4 | Broadcast campaign delivery |
| `whatsapp-template-sync` | 2 | Template sync from Meta |
| `email` | 2 | All transactional emails |

### Interval-Based Tasks (Cron)

| Task | Interval | Script |
|------|----------|--------|
| Deploy monitor | 60s | `/scripts/deploy-monitor-worker.ts` |
| App hosting billing | hourly | `/scripts/app-hosting-billing-worker.ts` |
| WhatsApp monthly billing | hourly | `/scripts/whatsapp-monthly-billing-worker.ts` |
| VPN renewal | hourly | `/scripts/vpn-renewal-worker.ts` |

Key source: `/scripts/workers.ts`

---

## Database

**PostgreSQL 16** with **pgvector** extension via Prisma ORM.

- Schema: `/prisma/schema.prisma` (~74 KB)
- Migrations: `/prisma/migrations/` (consolidated — individual migrations squashed into a single `init` migration in #365)
- Config: `/prisma.config.ts`
- Client: `/lib/prisma.ts` (PrismaPg adapter, singleton pattern)

**Redis** is used for:
- BullMQ queue backend
- Cache (WorkOS metadata, generic `getOrFetch` layer)
- Rate limiting (`/lib/rate-limit.ts`)

Key source: `/lib/prisma.ts`, `/lib/redis.ts`, `/prisma/schema.prisma`

---

## Module Convention

Each feature lives in `/modules/<feature>/` with consistent file naming:

| Suffix | Purpose |
|--------|---------|
| `*.service.ts` | Business logic |
| `*.route.ts` | Elysia API routes (in `api/` subdirectory) |
| `*.policy.ts` | Authorization rules |
| `*.types.ts` | TypeScript types |
| `*.schema.ts` | Zod/TypeBox validation schemas |
| `*.dto.ts` | Data transfer objects |
| `*.logic.ts` | Pure logic functions (no side effects) |
| `*.constants.ts` | Constants and enums |
| `ui/*.tsx` | UI components |
| `*.test.ts` / `*.test.tsx` | Co-located tests |

Route factories (e.g., `createAuthRoutes(service)`) enable dependency injection for testing.

Key source: `/AGENTS.md`, `/CLAUDE.md`

---

## Docker Deployment

Two Dockerfiles:
- **`Dockerfile.web`** — Next.js web server (port 3300)
- **`Dockerfile.workers`** — BullMQ worker process

Infrastructure:
- **`docker-compose.db.yml`** — PostgreSQL + Redis (dev)
- **`docker-compose.app.yml`** — web + workers (production, depends on external network)

Key source: `/Dockerfile.web`, `/Dockerfile.workers`, `/docker-compose.app.yml`, `/docker-compose.db.yml`

---

## Key Architectural Decisions (from git history)

1. **Elysia over Next.js API routes** — Chose Elysia for its TypeBox integration, composable plugins, and OpenAPI generation, mounted as a catch-all within Next.js App Router
2. **Single worker process** — Rather than per-queue workers, all BullMQ workers run in one process for simpler deployment
3. **Two-layer roles** — Platform-level `super_admin` in PostgreSQL + tenant-level roles in WorkOS, providing flexibility for cross-tenant admin without complex WorkOS org hierarchy
4. **WorkOS AuthKit in middleware** — Auth session check + refresh runs in the Edge Middleware (`proxy.ts`) so Elysia routes receive fresh session data without re-authenticating
5. **Feature flags via env vars** — `FEATURE_*` prefix env vars checked at runtime via `lib/feature-flags.ts`
6. **Feature-ticket driven development** — All features tracked as "PGREEN-NNN" tickets, branch-named and PR-merged to `main`
