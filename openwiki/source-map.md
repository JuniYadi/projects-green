# Source Map

A high-level navigation guide across the major directories and their purposes.

## Directory Layout

```
/ (project root)
├── app/                    → Next.js App Router pages and API routes
├── components/             → Shared UI components
├── lib/                    → Utilities, API clients, queue infrastructure
├── modules/                → Feature domain modules (Elysia plugins)
├── prisma/                 → Database schema + migrations
├── scripts/                → Background workers + operational scripts
├── test/                   → Global test setup + integration tests
├── e2e/                    → Playwright end-to-end tests
├── types/                  → Global TypeScript type declarations
├── .github/workflows/      → CI/CD workflows
├── storage/                → Local file storage
├── public/                 → Static assets
├── hooks/                  → Shared React hooks
└── goals/                  → Development goal tracking docs
```

## `app/` — Next.js App Router

```
app/
├── [lang]/                 → Internationalized routes
│   ├── (home)/             → Landing page
│   ├── admin/              → Super admin pages
│   ├── auth/               → Authentication pages (select-org, etc.)
│   ├── console/            → Customer console (tenant member)
│   │   ├── app/            → App management (credentials page)
│   │   ├── billing/        → Billing pages
│   │   ├── invoices/       → Invoice pages
│   │   ├── organization/   → Org settings
│   │   ├── support-tickets/→ Support ticket system
│   │   ├── vpn/            → VPN console pages
│   │   └── whatsapp/       → WhatsApp console pages
│   ├── invite/             → Invitation pages
│   ├── login/              → Login pages
│   ├── onboarding/         → Onboarding wizard
│   ├── portal/             → Admin portal pages
│   │   ├── admin/          → Admin org/user management
│   │   ├── app/            → App hosting management
│   │   ├── billing/        → Portal billing pages
│   │   ├── documentation/  → Docs viewer
│   │   ├── invoices/       → Invoice management
│   │   ├── payments/       → Payment configuration
│   │   ├── settings/       → Portal settings
│   │   ├── support-tickets/→ Ticket management
│   │   ├── vpn/            → VPN admin pages
│   │   └── whatsapp/       → WhatsApp portal pages
│   └── signup/             → Registration pages
├── api/                    → API route catch-all
│   ├── [[...slugs]]/       → Elysia route handler
│   ├── auth/               → Auth-specific API routes
│   └── integrations/       → Third-party integration callbacks + GitHub accounts listing
├── callback/               → WorkOS OAuth callback
├── globals.css             → Global Tailwind styles
├── layout.tsx              → Root layout
└── favicon.ico
```

## `lib/` — Shared Library

```
lib/
├── api.ts                  → Central Elysia router
├── eden.ts                 → Eden Treaty client (type-safe API calls)
├── prisma.ts               → Prisma client singleton
├── redis.ts                → Redis connection (ioredis)
├── billing-client.ts       → Billing API client
├── vpn-client.ts           → VPN API client
├── vpn-mobile-client.ts    → VPN mobile API client
├── encryption.ts           → Encryption utilities
├── validation.ts           → Zod validation helpers
├── rate-limit.ts           → Rate limiting utilities
├── feature-flags.ts        → Feature flag checks
├── platform-role.ts        → Platform role resolution
├── side-session.ts         → Sidebar session tracking
├── workos-directory.ts     → WorkOS Directory Sync
├── app-config.ts           → Application configuration
├── audit.service.ts        → Audit logging
├── utils.ts                → General utilities
├── api/                    → API client sub-modules
│   └── whatsapp-client.ts  → WhatsApp typed API client
├── auth/                   → Auth helper modules
├── cache/                  → Redis-backed cache layer
├── i18n/                   → Internationalization
│   ├── config.ts           → Locale configuration
│   ├── request-locale.ts   → Locale resolution
│   └── pathname.ts         → Locale pathname helpers
├── queue/                  → BullMQ queue definitions
│   ├── base-job.ts         → Base job class
│   ├── email.ts            → Email queue
│   ├── billing-cron.ts     → Billing cron queues
│   ├── quota-reconciliation.ts
│   ├── whatsapp-broadcast.ts
│   ├── whatsapp-template-sync.ts
│   └── ...
├── seeder/                 → Seed utilities
│   └── dummy/              → Dummy test org seeder
└── whatsapp/               → WhatsApp Meta Cloud client
    └── meta-cloud/
```

## `modules/` — Feature Domains

```
modules/
├── admin/                  → Admin panel routes
├── auth/                   → Authentication logic + WhoAmI
├── billing/                → Billing engine (core)
├── cloudflare/             → Cloudflare DNS credential management (encrypted token storage, CRUD API)
├── deploy/                 → App hosting deployment
├── docs/                   → Documentation + knowledge base
├── email-templates/        → Email template API
├── framework-detection/    → Code analysis for deploy
├── github/                 → GitHub App integration
├── gitops/                 → GitOps utilities
├── health/                 → Health check endpoints
├── invoices/               → Invoice management
├── jenkins/                → Jenkins CI integration
├── opensearch/             → OpenSearch logging
├── payment/                → Payment gateway integration
├── support-tickets/        → Support ticket system
├── tenants/                → Tenant/org management
├── users/                  → User management
├── vouchers/               → Voucher/coupon system
├── vpn/                    → VPN service
├── wireguard/              → WireGuard protocol adapter
└── workos-directory/       → WorkOS Directory Sync
```

## Infrastructure & Config

```
prisma/
├── schema.prisma           → Full database schema
└── migrations/             → Migration files

scripts/                    → Workers + admin scripts (preload.ts, run-tests.ts)
test/                       → Test setup + e2e helpers
e2e/                        → Playwright specs
.github/workflows/          → CI/CD pipelines
```

## Entry Points

| Purpose | File |
|---------|------|
| **Next.js middleware** | `proxy.ts` (auth, locale, role routing) |
| **API router** | `app/api/[[...slugs]]/route.ts` → `lib/api.ts` |
| **Elysia app assembly** | `lib/api.ts` (composes all module routes) |
| **Worker process** | `scripts/workers.ts` (unified worker) |
| **Next.js config** | `next.config.mjs` |
| **Prisma config** | `prisma.config.ts` |
| **Package** | `package.json` |

## Key Cross-Cutting Concerns

| Concern | Location |
|---------|----------|
| **Auth** | `proxy.ts`, `modules/auth/`, WorkOS AuthKit |
| **Authorization** | `modules/tenants/tenant-policy.ts`, `lib/platform-role.ts` |
| **API validation** | Zod schemas in `*.schema.ts`, Elysia validation |
| **Background jobs** | BullMQ queues in `lib/queue/`, workers in `scripts/` |
| **Email** | `lib/queue/email.ts`, React Email templates in modules |
| **File storage** | S3-compatible (support ticket attachments) |
| **Encryption** | `lib/encryption.ts` |
| **Rate limiting** | `lib/rate-limit.ts` |
| **Audit logging** | `lib/audit.service.ts` |
| **Integrations API** | `app/api/integrations/` (GitHub accounts, callbacks) |
| **Credentials UI** | `app/[lang]/console/app/credentials/` (GitHub accounts + Cloudflare DNS tokens) |
