# WhatsApp Module

The WhatsApp module is the **flagship feature** of projects-green, representing ~60-70% of recent development activity. It provides a full WhatsApp Business Cloud API integration covering devices, messaging, templates, webhooks, broadcasts, catalogs, media, analytics, audit, billing, and usage tracking.

## Architecture

All WhatsApp routes are composed in `/modules/whatsapp/whatsapp.module.ts` as a single Elysia plugin registered in `/lib/api.ts`:

```typescript
export const whatsappRoutes = new Elysia({ prefix: "/whatsapp" })
  .use(devicesRoutes)
  .use(businessProfileRoutes)
  .use(catalogsRoutes)
  .use(tokensRoutes)
  .use(templatesRoutes)
  .use(contactsRoutes)
  .use(groupsRoutes)
  .use(broadcastsRoutes)
  .use(conversationsRoutes)
  .use(messagesRoutes)
  .use(webhooksRoutes)
  .use(usersRoutes)
  .use(usageRoutes)
  .use(rateLimitRoutes)
  .use(createWhatsappAuditRoutes())
  .use(mediaRoutes)
  .use(consoleWhatsappAuditRoutes)
  .use(analyticsRoutes)
```

The Meta Cloud API client lives in `/lib/whatsapp/meta-cloud/` (not in the module directory), with the heavy `WhatsAppDeviceClient` (~31 KB) at `/lib/whatsapp/meta-cloud/device-client.ts`. The thick client wrapper at `/modules/whatsapp/whatsapp-client.ts` provides a domain-typed facade.

## Submodules

### Devices (`modules/whatsapp/devices/`)
- WhatsApp device registration, connection status, health monitoring
- Business Profile API (business-profile.route.ts)
- Admin device management (admin-devices.route.ts)
- Device schemas, DTOs, and services
- Key source: `modules/whatsapp/devices/devices.service.ts`, `devices.schemas.ts`

### Messages (`modules/whatsapp/messages/`)
The core messaging subsystem. Message sending follows this flow:

```
sendMessage(options)
  → 1. Lookup/validate device
  → 2. Initialize billing services (BalanceGate, QuotaGate, UsageLedger, MessageCost, WhatsappBilling)
  → 3. Estimate cost & resolve quota credit
  → 4. consumeAllowanceOrChargeOverage() — billing decision
  → 5. checkMessageQuota() — quota gate
  → 6. Record usage in ledger
  → 7. Send via Meta Cloud API (device client)
  → 8. Enqueue quota reconciliation
  → 9. Trigger webhook dispatch
  → 10. Upsert contact from message
```

- Send types: `text`, `image`, `document`, `audio`, `location`, `interactive`
- Template message sending with billing category support
- Quota credit resolution (`quota-credit.service.ts`)
- Quota alerts (`quota-alert.service.ts`)
- Phone number normalization (`phone-number.ts`, `phone-number.test.ts`)
- Key source: `modules/whatsapp/messages/messages.service.ts`

### Templates (`modules/whatsapp/templates/`)
- Template management synced from Meta (WhatsApp Business API)
- Template sync worker (`scripts/whatsapp-template-sync-worker.ts`) — background sync of template catalog
- Template preview + detail components
- Header URL management, date columns
- Approved-template locking
- Key source: `modules/whatsapp/templates/api/templates.route.ts`, `templates.dto.ts`

### Webhooks (`modules/whatsapp/webhooks/`)
- Inbound webhook processing with HMAC signature verification
- Retry mechanism for failed webhook deliveries
- Dead-letter queue for persistently failing webhooks
- Outgoing webhook worker for delivering events to customer endpoints
- Webhook log viewer in console UI
- Key source: `modules/whatsapp/webhooks/webhooks.service.ts`, `scripts/whatsapp-webhook-worker.ts`, `scripts/whatsapp-webhook-outgoing-worker.ts`

### Billing (`modules/whatsapp/billing/`)
- WhatsApp-specific billing logic layered on top of the general billing module
- Addon quota top-ups (consumption order: default → addon → balance)
- Cost derivation from `BillingAdjustment` records
- Category-aware billing (different rates for reply, template, etc.)
- Monthly billing worker (`scripts/whatsapp-monthly-billing-worker.ts`)
- Key source: `modules/whatsapp/billing/whatsapp-billing.service.ts`, `whatsapp-billing.service.test.ts`

### Broadcasts (`modules/whatsapp/broadcasts/`)
- Broadcast campaign creation and delivery
- Broadcast worker (`scripts/whatsapp-broadcast-worker.ts`)
- Queue-based processing with concurrency 4

### Usage & Analytics
- **Usage** — `modules/whatsapp/usage/` — message usage tracking, quota progress bars, usage dashboard
- **Analytics** — `modules/whatsapp/analytics/` — derived analytics from message/conversation data
- Key source: `modules/whatsapp/usage/usage.service.ts`, `usage.dto.ts`

### Other Submodules
- **Audit** — Create and console audit log routes for tracking WhatsApp administrative actions
- **Catalogs** — Multi-product catalog API integration
- **Contacts** — Contact management and upsert-from-message flow
- **Conversations** — Conversation tracking
- **Groups** — Group management API
- **Media** — Media upload/download/delete via Meta API
- **Rate Limit** — Rate limiting for WhatsApp API calls
- **Tokens** — Token management and refresh for WhatsApp access tokens
- **Users** — User management within the WhatsApp context
- **UI** — Shared WhatsApp UI components (console pages)

## Console Pages (`app/[lang]/console/whatsapp/`)

| Page | Route | Key Features |
|------|-------|-------------|
| Dashboard | `/console/whatsapp/dashboard` | Global WhatsApp overview |
| Messages | `/console/whatsapp/messages` | Template-first message composer, message history |
| Templates | `/console/whatsapp/templates` | Paginated template list, detail view, create/edit forms |
| Devices | `/console/whatsapp/devices` | Device list, detail view with health/status |
| Usage | `/console/whatsapp/usage` | Usage breakdown, quota progress, billing cost |
| Broadcasts | `/console/whatsapp/broadcasts` | Broadcast campaign management |
| Contacts | `/console/whatsapp/contacts` | Contact list |
| Audit Logs | `/console/whatsapp/audit-logs` | WhatsApp admin audit trail |
| Webhook Logs | `/console/whatsapp/webhook-logs` | Webhook event viewer |

## Key Background Workers

| Worker | File | Purpose |
|--------|------|---------|
| WhatsApp Broadcast | `scripts/whatsapp-broadcast-worker.ts` | Delivers broadcast campaigns |
| WhatsApp Template Sync | `scripts/whatsapp-template-sync-worker.ts` | Syncs templates from Meta |
| WhatsApp Monthly Billing | `scripts/whatsapp-monthly-billing-worker.ts` | Monthly billing calculation |
| WhatsApp Webhook | `scripts/whatsapp-webhook-worker.ts` | Processes inbound webhooks |
| WhatsApp Webhook Outgoing | `scripts/whatsapp-webhook-outgoing-worker.ts` | Delivers webhooks to customer endpoints |
| WhatsApp Analytics | `scripts/whatsapp-analytics-worker.ts` | Analytics processing |

## Recent Development History

The WhatsApp module has gone through ~4 rounds of iteration (based on recent git history):

1. **#358** — Console UX redesign: template-first messaging, global dashboard, paginated templates
2. **#360** — Feedback enhancements: categories, quota credits, usage fixes, audit+webhook log pages
3. **#361** — Issue continuation: template locking, date columns, phone normalization, usage loading
4. **#363-364** — Polish: dashboard cards, template sync headerUrl fix, addon quota, consumption order

Key source: Recent git history (commits `6e470aa`, `7c43c7a`, `7c4274a`, `639b04f`, `3aadbe8`)
