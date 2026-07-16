# projects-green — OpenWiki

Multi-tenant SaaS DevOps orchestration platform built with **Next.js 16 + Elysia + Prisma + Bun**. This wiki documents the architecture, domain logic, operations, and source map for the repository.

## What It Does

projects-green is a platform that offers **WhatsApp Business API messaging**, **VPN subscription management**, **application hosting (deploy)**, and **billing/ invoicing** — all under a multi-tenant role model with **WorkOS AuthKit** authentication.

### Key Capabilities

| Area | Description |
|------|-------------|
| **WhatsApp** | Full WhatsApp Business Cloud API integration: devices, messages, templates, webhooks, broadcasts, catalogs, media, analytics, audit logs, usage & billing |
| **VPN** | VPN subscription management, mobile device pairing (QR + JWT), server admin, provisioning pipeline (OpenVPN/WireGuard), session tracking |
| **Deploy (App Hosting)** | GitHub-integrated deployment pipeline with framework detection, Helm chart generation, Jenkins sync, monitoring, and billing |
| **Billing** | Balance gating, quota gating, usage ledger, message costing, billing cycles, invoices, currency management, payment integrations |
| **Support Tickets** | Encrypted ticket content, status workflow automation, email notifications, admin alerting |
| **Admin & Auth** | WorkOS AuthKit authentication, two-layer role model (platform super_admin + tenant owner/admin/member), API key auth |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 16 (App Router, Turbopack, React 19) |
| **API Layer** | Elysia.js (Bun HTTP framework) via catch-all `/api/[[...slugs]]` |
| **API Client** | Eden Treaty (type-safe, auto-generated from Elysia `App` type) |
| **Runtime** | Bun 1.3.x (package manager, test runner, script runner) |
| **Database** | PostgreSQL 16 (via Prisma ORM with pgvector extension) |
| **Cache / Queue** | Redis 7 (BullMQ background jobs) |
| **Auth** | WorkOS AuthKit (OAuth, magic codes, session management) |
| **UI** | shadcn/ui v4, Tailwind CSS v4, Phosphor Icons, Radix UI |
| **Validation** | Zod v4, TypeBox (Elysia) |
| **Email** | Nodemailer + React Email templates + BullMQ queue |
| **Workers** | Unified BullMQ worker process (scripts/workers.ts) |
| **Search** | OpenSearch (deploy log aggregation) |

## Quick Start

```bash
# 1. Infrastructure (Postgres + Redis)
docker compose -f docker-compose.db.yml up -d

# 2. Install
bun install

# 3. Setup environment
cp .env.example .env

# 4. Database migrations
bun run db:migrate:dev

# 5. Start dev server
bun run dev
# → http://localhost:3300
```

## Key Scripts

| Command | Purpose |
|---------|---------|
| `bun run dev` | Dev server (Turbopack, port 3300) |
| `bun run build` | Production build |
| `bun run test` | Run unit + component tests (excludes e2e) |
| `bun run test:coverage` | Tests with coverage + threshold check |
| `bun run lint` | ESLint (0 errors required) |
| `bun run typecheck` | TypeScript check (0 errors required) |
| `bun run db:migrate:dev` | Apply Prisma migrations |
| `bun run db:studio` | Prisma Studio browser UI |
| `bun run worker:all` | Start all BullMQ workers in one process |
| `bun run tinker` | Interactive Prisma REPL |

## Documentation Structure

| Page | Description |
|------|-------------|
| [/openwiki/architecture/overview.md](/openwiki/architecture/overview.md) | System architecture, auth flow, module conventions, API composition |
| [/openwiki/domain/whatsapp.md](/openwiki/domain/whatsapp.md) | WhatsApp Business API integration, messaging, billing, webhooks |
| [/openwiki/domain/vpn.md](/openwiki/domain/vpn.md) | VPN subscriptions, mobile pairing, provisioning, sessions |
| [/openwiki/domain/billing.md](/openwiki/domain/billing.md) | Balance/quota gating, billing cycles, usage ledger, invoicing |
| [/openwiki/domain/deploy.md](/openwiki/domain/deploy.md) | Deploy pipeline, framework detection, Helm, GitHub integration |
| [/openwiki/operations/runbook.md](/openwiki/operations/runbook.md) | Infrastructure, workers, CI/CD, testing strategy, scripts |
| [/openwiki/source-map.md](/openwiki/source-map.md) | Directory tree, key files table, route-to-module mapping |

## Backlog

- **Support Tickets module** — documented briefly in quickstart but deserves a dedicated domain page (status workflow, encryption, email notifications, PIC tracking). Deferred to keep scope focused on the four main product areas.
- **OpenSearch integration** — used for deploy log aggregation; architecture and query patterns not yet documented in detail.
- **GitHub App integration** — GitHub installation flow, webhook processing, event retention; not yet documented separately.
- **Vouchers module** — voucher code generation and redemption; not yet documented.
- **Knowledge Docs / AI Chat** — embedded knowledge base with AI-powered chat; architecture not yet documented.
