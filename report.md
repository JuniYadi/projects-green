# Multi-Tenant SaaS Repository — Structural Inventory Report

**Repository:** `/home/juniyadi/github/JuniYadi/projects-green`  
**Stack:** Next.js (App Router) + TypeScript + Prisma + WorkOS Auth + Elysia (edge routes)  
**Last updated (approx):** Jul 2025

---

## 1. Top-Level Directory Overview

```
projects-green/
├── app/                    # Next.js App Router pages
├── components/             # Shared React components (shadcn/ui)
├── e2e/                    # Playwright end-to-end tests
├── hooks/                  # Shared React hooks
├── lib/                    # Shared library code (i18n, platform-role, etc.)
├── modules/                # Domain modules (the core of the business logic)
├── prisma/                 # Prisma schema + migrations
├── public/                 # Static assets
├── scripts/                # Build/dev scripts
├── storage/                # Local file storage
├── test/                   # Unit/integration tests (Vitest)
├── types/                  # Shared TypeScript type definitions
├── goals/                  # Agent/goal tracking (AGENTS.md / CLAUDE.md)
├── openwiki/               # OpenWiki connector metadata
│
├── proxy.ts                # Next.js middleware (WorkOS auth, locale routing)
├── next.config.mjs         # Next.js configuration
├── playwright.config.ts    # Playwright E2E config
├── prisma.config.ts        # Prisma config helper
├── package.json / bun.lock # Dependencies
├── docker-compose*.yml     # Docker Compose files
└── Dockerfile.*            # Docker images
```

---

## 2. WhatsApp Module — `modules/whatsapp/`

**Root files:**
| File | Notes |
|------|-------|
| `whatsapp.module.ts` | Module entry / barrel file |
| `whatsapp-client.ts` | WhatsApp Cloud API client (~31 KB, the largest file in the module) |

**Subdirectories (21 total):**

| Subdirectory | Key contents | Purpose |
|---|---|---|
| `analytics/` | `analytics.service.ts`, `analytics.service.test.ts`, `analytics.schemas.ts`, `analytics.types.ts`, `api/analytics.route.ts` | WhatsApp usage analytics & metrics |
| `audit/` | `whatsapp-audit.service.ts`, `.test.ts`, `api/whatsapp-audit.route.ts`, `ui/whatsapp-audit-table.tsx`, `ui/whatsapp-audit-details.ts` | Audit logging for WhatsApp operations |
| `billing/` | `whatsapp-billing.service.ts`, `.test.ts` | WhatsApp-specific billing (quota-based) |
| `broadcasts/` | `broadcasts.dto.ts`, `api/broadcasts.route.ts` | Broadcast/mass-messaging feature |
| `catalogs/` | `catalogs.service.ts`, `.test.ts`, `catalogs.dto.ts`, `api/catalogs.route.ts` | Product catalog management |
| `contacts/` | `contacts.service.ts`, `contacts.dto.ts`, `api/contacts.route.ts` | Contact management |
| `conversations/` | `api/conversations.route.ts` | Conversation tracking |
| `devices/` | `devices.service.ts`, `devices.dto.ts`, `devices.schemas.ts`, `business-profile.service.ts`, `api/devices.route.ts`, `api/admin-devices.route.ts` | WhatsApp Business device management |
| `emails/` | `device-disconnected.tsx` | Email templates for WhatsApp events |
| `groups/` | `api/groups.route.ts` | WhatsApp group management |
| `media/` | `media.service.ts`, `media.dto.ts`, `whatsapp-media.validator.ts`, `api/media.route.ts` | Media upload/retrieval |
| `messages/` | `messages.service.ts` (23 KB), `messages.dto.ts`, `phone-number.ts`, `quota.service.ts`, `quota-alert.service.ts`, `quota-credit.service.ts`, `api/messages.route.ts`, `ui/interactive-composer.tsx` | Core messaging engine, interactive messages, quota management |
| `quota-alerts/` | `quota-alert.service.ts` | Usage quota alert thresholds |
| `rate-limit/` | `rate-limit.service.ts`, `api/rate-limit.route.ts` | Rate limiting logic |
| `templates/` | `templates.schemas.ts`, `templates.dto.ts`, `api/templates.route.ts`, `api/templates.hooks.ts`, `ui/template-form.tsx`, `ui/template-list.tsx`, `ui/template-preview.tsx`, `ui/template-detail.tsx`, `ui/template-delete-dialog.tsx` | Message template management (approval, localization) |
| `tokens/` | `api/tokens.route.ts` | WhatsApp access token management |
| `ui/` | `access-restricted.tsx`, `device-health-badge.tsx` | Shared WhatsApp UI components |
| `usage/` | `usage.service.ts`, `usage.dto.ts`, `api/usage.route.ts` | Usage tracking and reporting |
| `users/` | `users.service.ts`, `api/users.route.ts` | WhatsApp user management |
| `webhooks/` | `webhooks.service.ts` (18 KB), `webhook-dispatcher.service.ts`, `webhooks.dto.ts`, `api/webhooks.route.ts`, `api/admin-webhooks.route.ts`, `api/webhook-dead-letter.route.ts`, `jobs/webhook-retry.job.ts`, `services/webhook-dead-letter.service.ts`, `services/webhook-hmac.service.ts`, `ui/*` (10 UI files) | Webhook ingress, dispatch, retry, HMAC verification, dead-letter queue |

---

## 3. VPN Module — `modules/vpn/`

**Root files:**
| File | Notes |
|------|-------|
| `vpn-client.service.ts` (+ test) | VPN client management |
| `vpn-crypto.ts` (+ test) | Cryptographic utilities (certificates, keys) |
| `email.service.ts` (+ test, .tsx) | Email notifications for VPN |

**Subdirectories (11 total):**

| Subdirectory | Key contents | Purpose |
|---|---|---|
| `_components/` | `vpn-pairing-qr-modal.tsx`, `.test.tsx` | QR pairing modal for mobile app |
| `admin/` | `vpn-server.service.ts`, `vpn-server.schema.ts`, `vpn-server.dto.ts`, `vpn-server-connection.ts`, `vpn-package.service.ts`, `vpn-package.dto.ts`, `vpn-package.schema.ts`, `vpn-region.service.ts`, `vpn-region.dto.ts`, `vpn-region.schema.ts`, `vpn-ssh-key.service.ts`, `vpn-ssh-key.crypto.ts`, `vpn-ssh-key.dto.ts`, `vpn-ssh-key.schema.ts`, `vpn-health.service.ts`, `vpn-connection-scanner.ts`, `vpn-port-checker.ts`, `vpn-ss-parser.ts`, `api/vpn-packages.route.ts`, `api/vpn-regions.route.ts`, `api/vpn-servers.route.ts`, `api/vpn-ssh-keys.route.ts` | Full admin CRUD for servers, packages, regions, SSH keys, health scanning |
| `api/` | `vpn.route.ts` (20 KB, main VPN API), `admin-vpn-audit.route.ts`, `admin-vpn-audit.dto.ts` | Public VPN user-facing API routes |
| `billing/` | `vpn-billing.service.ts`, `vpn-pricing.ts`, `vpn-renewal.service.ts`, `vpn-subscription-refs.ts` | VPN billing, pricing, renewal logic |
| `emails/` | 8 email templates (provisioning success/failure, renewal, subscription created/cancelled/suspended/expired) | Transactional emails |
| `integration/` | `openvpn-live.test.ts` | Integration test with live OpenVPN server |
| `mobile/` | `vpn-mobile-device.service.ts`, `vpn-pairing-token.service.ts`, `vpn-mobile-device.dto.ts`, `vpn-pairing-token.dto.ts`, `vpn-mobile.errors.ts`, `lib/vpn-session.lib.ts`, `api/mobile-auth.route.ts`, `api/mobile-device.route.ts`, `api/mobile-pairing.route.ts`, `api/mobile-profiles.route.ts`, `api/admin-devices.route.ts`, `mobile-auth.middleware.ts`, `index.ts` | Mobile app backend: device pairing, auth, profiles, session management |
| `openvpn/` | `openvpn-ssh-adapter.ts`, `.test.ts` | OpenVPN server SSH adapter |
| `provisioning/` | `vpn-provisioning.service.ts`, `vpn-reconciliation.service.ts`, `vpn-server-sync.service.ts`, `vpn-server-ssh-executor.ts`, `wireguard-ssh-adapter.ts`, `proxy-password.ts`, `proxy-ssh-adapter.ts` | Server provisioning, reconciliation, SSH execution |
| `sessions/` | `vpn-mobile-session.service.ts`, `vpn-mobile-session.dto.ts`, `vpn-mobile-session.route.ts`, `stale-cleanup.ts` | Mobile VPN session tracking & stale cleanup |
| `subscriptions/` | `vpn-subscription.service.ts`, `vpn-subscription.dto.ts`, `vpn-package-public.dto.ts`, `api/vpn-subscriptions.route.ts`, `api/vpn-admin-subscriptions.route.ts`, `api/vpn-packages-catalog.route.ts` | VPN subscription management, package catalog |

---

## 4. Billing Module — `modules/billing/`

**Root files (many service files):**
| File | Notes |
|------|-------|
| `billing-account.service.ts` (+ test) | Billing account CRUD |
| `billing-cycle.service.ts` (+ test, types) | Billing cycle orchestration |
| `billing-transaction.service.ts` (+ test) | Transaction ledger |
| `balance-gate.service.ts` (+ test) | Balance checks & gating |
| `quota-gate.service.ts` (+ test) | Quota enforcement |
| `usage-ledger.service.ts` (+ test) | Usage recording & aggregation |
| `costing.service.ts` (+ test) | Cost calculation engine |
| `currency.service.ts` (+ test) | Multi-currency support |
| `message-cost.service.ts` (+ test) | Per-message cost |
| `invoice-status.service.ts` (+ test) | Invoice lifecycle |
| `billing-contact.service.ts` (+ test) | Billing contacts |
| `types.ts` (+ test) | Shared billing types & enums |
| `constants.ts` | Billing constants |
| `plans.ts` | Plan definitions |
| `user-labels.ts` (+ test) | User labelling for billing |
| `email-recipients.ts` | Billing email recipient logic |

**Subdirectories:**

| Subdirectory | Key contents | Purpose |
|---|---|---|
| `api/` | `billing.route.ts`, `account.route.ts`, `invoices.route.ts`, `subscriptions.route.ts`, `topup.route.ts`, `usage.route.ts`, `billing.schemas.ts`, `index.ts` + tests | Core billing API routes |
| `api/admin/` | `adjust.route.ts`, `adjustments.route.ts`, `audit-log.route.ts`, `contacts.route.ts`, `invoice.route.ts`, `invoices-list.route.ts`, `members.route.ts`, `org-detail.route.ts`, `orgs.route.ts`, `stats.route.ts`, `subscriptions.route.ts`, `topup.route.ts`, `usage.route.ts` + tests | Admin billing panel routes |
| `audit/` | `audit.service.ts` | Billing audit trail |

---

## 5. Deploy Module — `modules/deploy/`

**Root files:**
| File | Notes |
|------|-------|
| `deploy.helm.ts` | Helm chart generation for deployments |
| `deploy.schema.ts` (+ test) | Deployment schema/validation |
| `deploy.types.ts` | Type definitions |
| `deploy.constants.ts` (+ test) | Constants & defaults |
| `deploy.logic.ts` (+ test) | Core deployment orchestration |
| `deploy-builder.service.ts` | Build service |
| `deploy-pipeline.service.ts` (+ test) | Pipeline execution |
| `deploy-detection.service.ts` (+ test) | Framework detection |
| `deploy-recommendation.ts` | Deployment recommendations |
| `deploy-config.ts` (+ test) | Configuration management |
| `deploy-event.service.ts` (+ test) | Event handling |
| `deploy-monitor.service.ts` (+ test, dto) | Deployment monitoring |
| `deploy-rollback.service.ts` (+ test) | Rollback support |
| `deploy-pricing.ts` (+ test) | Pricing for deployments |
| `deploy.mock.ts` | Mock data for tests |
| `deploy.store.tsx` (+ test) | Zustand store for deploy state |
| `environment-vars.ts` (+ test) | Environment variable handling |
| `operate.constants.ts` / `operate.types.ts` / `operate.mock.ts` | Operate (runtime management) types & constants |

**Subdirectories:**

| Subdirectory | Key contents | Purpose |
|---|---|---|
| `api/` | `deploy.route.ts`, `environment-variables.client.ts`, `environment-variables.contract.ts`, `environment-variables.stub.ts` + tests | Core deploy API |
| `api/routes/` | `app-stacks.route.ts`, `billing-gate.route.ts`, `deploy-pipeline.route.ts`, `deploy-submit.route.ts`, `deploy-trigger.route.ts`, `environment-variables.route.ts`, `jenkins-webhook.route.ts`, `monitoring.route.ts`, `opensearch-logs.route.ts` + tests | Individual deploy API route handlers |
| `billing/` | `app-hosting-billing.service.ts`, `app-hosting-alerts.service.ts` + tests | Hosting billing & alerts |
| `opensearch/` | `opensearch-log.service.ts`, `opensearch-index.service.ts`, `opensearch.types.ts` | OpenSearch log shipping |
| `ui/` | `deploy-wizard.tsx` (29 KB), `deploy-stepper.tsx`, `step-build.tsx`, `step-environment.tsx`, `env-vars-editor.tsx`, `logs-panel.tsx`, `deploy-timeline.tsx`, `result-panel.tsx`, `resource-plan-selector.tsx`, `pay-as-you-go-selector.tsx`, `confidence-badge.tsx`, `repository-summary-bar.tsx`, `lifecycle-page-shell.tsx` + tests | Deployment wizard UI |
| `ui/operate/` | `tab-overview.tsx`, `tab-domains.tsx`, `tab-env.tsx`, `tab-events.tsx`, `tab-logs.tsx`, `tab-metrics.tsx`, `tab-mounts.tsx`, `tab-scaling.tsx`, `app-monitor.tsx`, `traffic-flow-canvas.tsx` (33 KB), `operate-troubleshooter.tsx` + tests | App runtime operate/troubleshoot UI |

---

## 6. App Pages — `app/[lang]/console/` & `app/[lang]/portal/`

### `app/[lang]/console/` (User Console)

```
console/
├── page.tsx (+ test)              # Console home / dashboard
├── layout.tsx (+ test)            # Console layout wrapper
├── console.css                    # Console-specific styles
│
├── app/                           # Deploy/App management
│   ├── page.tsx (+ test)          # Apps listing
│   ├── layout.tsx (+ test)        # App layout
│   ├── deploy/page.tsx            # Deploy an app
│   └── manage/page.tsx (+ test)   # Manage app settings
│
├── billing/                       # Billing pages
│   ├── page.tsx                   # Billing dashboard
│   ├── layout.tsx                 # Billing layout
│   ├── billing-dashboard.tsx      # Dashboard component
│   ├── alerts/page.tsx            # Billing alerts
│   ├── contacts/page.tsx          # Billing contacts
│   ├── invoices/page.tsx          # Invoices list
│   ├── invoices/[id]/page.tsx     # Invoice detail
│   ├── payment-methods/page.tsx   # Payment methods
│   ├── payments/confirm/page.tsx  # Payment confirmation
│   ├── settings/page.tsx          # Billing settings
│   ├── subscription/page.tsx      # Subscription management
│   ├── topup/page.tsx             # Top-up credit
│   ├── transactions/page.tsx      # Transaction history
│   ├── usage/page.tsx             # Usage details
│   └── vouchers/page.tsx          # Vouchers
│
├── docs/                          # Documentation
│   ├── page.tsx                   # Docs index
│   └── [...slug]/page.tsx         # Dynamic doc pages
│
├── invoices/                      # Invoices (separate from billing)
│   ├── page.tsx (+ test)          # Invoice list
│   └── [invoiceId]/page.tsx       # Invoice detail
│
├── organization/                  # Organization management
│   ├── page.tsx                   # Org overview
│   ├── invitations/page.tsx       # Manage invitations
│   ├── members/page.tsx           # Manage members
│   └── ownership/page.tsx         # Transfer ownership
│
├── support-tickets/               # Support tickets
│   ├── page.tsx (+ test)          # Ticket list
│   ├── [ticketId]/page.tsx        # Ticket detail
│   └── new/page.tsx               # Create ticket
│
├── vpn/                           # VPN user pages
│   ├── page.tsx (+ test)          # VPN overview
│   ├── dashboard/page.tsx         # VPN dashboard
│   ├── devices/page.tsx           # My VPN devices
│   ├── order/page.tsx             # Order VPN
│   ├── subscriptions/page.tsx     # My subscriptions
│   ├── subscriptions/[id]/page.tsx
│   ├── _components/               # VPN UI components
│   └── layout.tsx                 # VPN layout
│
└── whatsapp/                      # WhatsApp user pages
    ├── page.tsx                   # WhatsApp home
    ├── analytics/page.tsx         # Analytics dashboard
    ├── audit-logs/page.tsx        # Audit logs
    ├── broadcasts/page.tsx        # Broadcasts list
    ├── broadcasts/[id]/page.tsx   # Broadcast detail
    ├── broadcasts/new/page.tsx    # New broadcast
    ├── catalogs/page.tsx          # Catalogs list
    ├── catalogs/[catalogId]/page.tsx
    ├── contacts/page.tsx          # Contacts
    ├── dashboard/page.tsx         # Dashboard
    ├── devices/page.tsx           # Devices list
    ├── devices/[deviceId]/page.tsx
    ├── events/page.tsx            # Events log
    ├── media/page.tsx             # Media library
    ├── messages/page.tsx          # Messages (largest page, 48 KB)
    ├── templates/page.tsx         # Templates list
    ├── templates/[id]/page.tsx    # Template detail
    ├── templates/new/page.tsx     # New template
    ├── usage/page.tsx             # Usage stats
    ├── webhook-logs/page.tsx      # Webhook logs
    └── layout.tsx                 # WhatsApp layout
```

### `app/[lang]/portal/` (Admin Portal)

```
portal/
├── page.tsx                       # Portal home (admin landing)
├── layout.tsx (+ test)            # Portal layout
│
├── admin/
│   ├── page.tsx                   # Admin home
│   └── organizations/             # Admin org management
│       ├── page.tsx
│       └── [id]/page.tsx          # Org detail + members
│
├── app/                           # App management (admin view)
│   ├── page.tsx                   # Apps list
│   ├── deploy/page.tsx            # Trigger deploy
│   ├── detector/page.tsx          # Framework detector
│   ├── detector/_components/      # Detector UI components
│   ├── events/github/page.tsx     # GitHub events
│   └── manage/page.tsx            # Manage apps
│
├── billing/                       # Billing (admin view)
│   ├── page.tsx                   # Billing home
│   ├── alerts/page.tsx            # Billing alerts
│   ├── audit-logs/page.tsx        # Audit logs
│   ├── contacts/page.tsx          # Billing contacts
│   ├── invoices/page.tsx          # Invoices list
│   ├── invoices/[id]/page.tsx     # Invoice detail
│   ├── org/[orgId]/page.tsx       # Org billing dashboard
│   ├── org/[orgId]/tabs/          # Org billing tabs
│   ├── overview/page.tsx          # Billing overview
│   ├── payment-methods/page.tsx   # Payment methods
│   ├── payments/page.tsx          # Payments
│   ├── settings/page.tsx          # Settings
│   ├── subscription/page.tsx      # Subscriptions
│   ├── subscription/create/page.tsx
│   ├── topup/page.tsx             # Top-up
│   ├── transactions/page.tsx      # Transactions
│   ├── usage/page.tsx             # Usage
│   └── voucher/page.tsx           # Voucher management
│       ├── page.tsx
│       └── [id]/page.tsx          # Voucher detail
│
├── documentations/page.tsx        # Admin documentation
│
├── invoices/                      # Invoices (admin)
│   ├── page.tsx
│   └── [id]/page.tsx
│
├── payments/                      # Payment configuration (admin)
│   ├── page.tsx
│   ├── bank-accounts/page.tsx     # Bank accounts
│   ├── confirmations/page.tsx     # Payment confirmations
│   ├── currencies/page.tsx        # Currency config
│   ├── gateways/page.tsx          # Payment gateways
│   └── overview/page.tsx          # Payment overview
│
├── settings/                      # Organization settings (admin)
│   ├── emails/page.tsx            # Email settings
│   ├── invitations/page.tsx       # Manage invitations
│   ├── members/page.tsx           # Manage members
│   └── ownership/page.tsx         # Transfer ownership
│
├── support-tickets/               # Support tickets (admin)
│   ├── page.tsx                   # Ticket list
│   ├── [ticketId]/page.tsx        # Ticket detail
│   └── new/page.tsx               # Create ticket
│
├── vpn/                           # VPN admin pages
│   ├── page.tsx                   # VPN admin home
│   ├── audit-logs/page.tsx        # Audit logs
│   ├── devices/page.tsx           # VPN devices
│   ├── packages/page.tsx          # Packages management
│   ├── regions/page.tsx           # Regions
│   ├── servers/page.tsx           # Servers list
│   ├── servers/[id]/page.tsx      # Server detail
│   ├── ssh-keys/page.tsx          # SSH keys
│   ├── subscriptions/page.tsx     # Subscriptions
│   ├── subscriptions/[id]/page.tsx
│   ├── wireguard/page.tsx         # WireGuard config
│   └── _components/               # Shared admin VPN components
│
└── whatsapp/                      # WhatsApp admin pages
    ├── page.tsx                   # WhatsApp admin home
    ├── audit-logs/page.tsx        # Audit logs
    ├── broadcasts/page.tsx        # Broadcasts list
    ├── broadcasts/new/page.tsx    # New broadcast
    ├── catalogs/page.tsx          # Catalogs
    ├── catalogs/[catalogId]/page.tsx
    ├── contacts/page.tsx          # Contacts
    ├── devices/page.tsx           # Devices list
    ├── devices/[deviceId]/page.tsx
    │   ├── edit/page.tsx          # Edit device
    ├── devices/new/page.tsx       # Create device (wizard)
    ├── devices/_components/       # Device UI components
    ├── events/page.tsx            # Events
    ├── messages/page.tsx          # Messages
    ├── templates/page.tsx         # Templates
    ├── templates/[id]/page.tsx    # Template detail
    ├── templates/new/page.tsx     # New template
    ├── usage/page.tsx             # Usage stats
    ├── webhook-dead-letter/page.tsx # Dead-letter queue
    ├── webhook-logs/page.tsx      # Webhook logs
    └── webhooks/page.tsx          # Webhooks list
        └── [webhookId]/page.tsx   # Webhook detail
```

---

## 7. Prisma Schema — `prisma/schema.prisma` (First 200 lines)

**Provider:** PostgreSQL via `prisma-client-js`

**Key models observed (first 200 lines):**

| Model | Table (`@@map`) | Description |
|---|---|---|
| `User` | `User` | Core user (name, email, timestamps) |
| `AuthPlatformUserRole` | `PlatformUserRole` | WorkOS user roles (`NONE`, `SUPER_ADMIN`) |
| `AuthApiKey` | `ApiKey` | API key management (scopes, environments SANDBOX/LIVE, expiry) |
| `AuthApiKeyEnvironment` | `ApiKeyEnvironment` | Enum for key env |
| `AuthPlatformRole` | `PlatformRole` | Enum for platform roles |
| `DocsKnowledgeDocument` | `KnowledgeDocument` | Knowledge base (embeddings, search text) |
| `GithubInstallStateNonce` | (custom) | GitHub OAuth install state nonces |
| `GithubInstallation` | (custom) | GitHub app installations |
| `GithubRepositoryConnection` | (custom) | Connected repos (branch filters, build config) |
| `StackStatus` | (custom) | Enum: IDLE, QUEUED, BUILDING, DEPLOYING, RUNNING, FAILED |
| `DeploySource` | (custom) | Enum: GITHUB, TEMPLATE, MANUAL |
| `DetectorRule` | (custom) | AI framework detection rules |
| `DetectorRuntimeMapping` | `RuntimeMapping` | Framework→runtime mappings |
| `DetectorInspectionLog` | `DetectorInspectionLog` | AI inspection logs |

The file is **74 KB** total (very large), containing many more models for billing, WhatsApp, VPN, deployment, organizations, support tickets, etc.

---

## 8. `proxy.ts` — Middleware

**Path:** `/home/juniyadi/github/JuniYadi/projects-green/proxy.ts` (251 lines)

**Purpose:** Next.js Edge Middleware for:
- **AuthKit (WorkOS) integration**: validates/refreshes WorkOS session cookies
- **Locale routing**: detects user locale from `accept-language` or cookie, redirects to `/[lang]/...`
- **Protected route gating**: redirects unauthenticated users to login
- **Role-based area routing**:
  - Super admins → `/portal` area
  - Users with `admin` scope → `/portal`
  - Users with `user` scope → `/console`
  - No scoped role → `/console` (with warning)
- **API request handling**: passes auth headers (`x-workos-authed`, `x-workos-user-id`, `x-workos-session-role`, etc.) to Elysia downstream handlers

**Matcher:** Excludes `_next/static`, `_next/image`, `favicon.ico`, static file extensions.

---

## 9. E2E Tests — `e2e/`

```
e2e/
├── README.md
├── use-case.md
├── fixtures/
│   ├── auth.setup.ts            # Playwright auth setup
│   └── admin-auth.setup.ts      # Admin auth setup
├── landing/
│   └── landing.spec.ts          # Landing page E2E
├── billing/
│   ├── admin/
│   │   ├── invoices.spec.ts
│   │   ├── org-billing.spec.ts
│   │   ├── overview.spec.ts
│   │   └── voucher.spec.ts
│   └── console/
│       ├── alerts.spec.ts
│       ├── contacts.spec.ts
│       ├── dashboard.spec.ts
│       ├── invoices.spec.ts
│       ├── payment-confirm.spec.ts
│       ├── settings.spec.ts
│       ├── subscription.spec.ts
│       ├── topup.spec.ts
│       ├── transactions.spec.ts
│       ├── usage.spec.ts
│       └── vouchers.spec.ts
└── whatsapp/
    └── console/
        └── dashboard.spec.ts    # WhatsApp dashboard E2E
```

---

## 10. Test Files — `test/`

```
test/
├── register.ts                  # Test registration/bootstrap
├── setup.ts                     # Global test setup
├── layout-test-mocks.ts         # Mock data for layout tests
├── layout-test-mocks.test.ts    # Tests for layout mocks
├── workos-node-mock.ts          # WorkOS Node mock
│
├── helpers/
│   ├── prisma-mock.ts           # Prisma mock factory
│   └── test-auth.ts             # Auth test helpers
│
├── whatsapp/
│   ├── broadcast-worker.test.ts       # Broadcast worker unit test
│   ├── inbound-worker.test.ts         # Inbound message worker test
│   ├── status-tracking.test.ts        # Message status tracking test
│   ├── template-sync-worker.test.ts   # Template sync worker test
│   └── test-simple.ts                 # Simple smoke test
│
├── whatsapp-devices-create.test.tsx   # Device creation test
├── whatsapp-devices.e2e.test.ts       # Devices E2E test
├── whatsapp-messages.e2e.test.ts      # Messages E2E test
├── whatsapp-webhook.e2e.test.ts       # Webhook E2E test
```

---

## 11. Additional Module Inventory (Quick Reference)

| Module | Description |
|---|---|
| `modules/admin/` | Admin utilities |
| `modules/auth/` | Authentication |
| `modules/docs/` | Documentation/knowledge base |
| `modules/email-templates/` | Email template renderers |
| `modules/framework-detection/` | AI framework detection engine |
| `modules/github/` | GitHub integration (installations, repos) |
| `modules/gitops/` | GitOps workflows |
| `modules/health/` | Health check endpoints |
| `modules/invoices/` | Invoice generation |
| `modules/jenkins/` | Jenkins CI integration |
| `modules/opensearch/` | OpenSearch client/indexing |
| `modules/payment/` | Payment gateway integration |
| `modules/support-tickets/` | Support ticketing system |
| `modules/tenants/` | Multi-tenant management & policy |
| `modules/users/` | User management |
| `modules/vouchers/` | Voucher/promo code system |
| `modules/wireguard/` | WireGuard server adapter |
| `modules/workos-directory/` | WorkOS Directory Sync |
