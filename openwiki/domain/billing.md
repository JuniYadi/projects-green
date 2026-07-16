# Billing Module

The billing subsystem handles all financial operations: account balances, quota management, usage tracking, invoicing, billing cycles, currency, and payment integrations. It is consumed by both WhatsApp (message costing, addon quotas) and VPN (subscription billing).

## Architecture

The billing module is shared across product domains:

```
modules/billing/
├── api/           → User-facing billing routes
├── api/admin/     → Admin billing CRUD (15 route files)
├── audit/         → Billing audit logging
├── *.service.ts   → Core billing services (16 files)
├── *.service.test.ts → Co-located tests
```

Client-side API wrapper: `/lib/billing-client.ts` (20 KB)

## Core Services

### Balance Gating (`balance-gate.service.ts`)
- Prevents spending when balance is insufficient
- Checked before every billable operation (WhatsApp message send)
- Subject to unit tests at `balance-gate.service.test.ts`

### Quota Gating (`quota-gate.service.ts`)
- Enforces per-organization and per-device message quotas
- Checks subscription-based quota limits
- Returns pass/fail with context for user-facing error messages
- Key source: `modules/billing/quota-gate.service.ts`

### Usage Ledger (`usage-ledger.service.ts`)
- Records usage entries for every billable action
- Tracks usage by organization, category, and device
- Used by WhatsApp message service to record outbound messages
- Key source: `modules/billing/usage-ledger.service.ts`

### Message Costing (`message-cost.service.ts`)
- Estimates per-message cost based on message type, device, and organization
- Returns unit price for billing decision
- Key source: `modules/billing/message-cost.service.ts`

### Billing Cycles (`billing-cycle.service.ts`)
- Manages billing periods (daily, monthly resets)
- Handles pro-rating, period transitions
- Daily reset queue → `QUOTA_RECONCILIATION_QUEUE` pattern
- Key source: `modules/billing/billing-cycle.service.ts`, `billing-cycle.test.ts`

### Invoice Status (`invoice-status.service.ts`)
- State machine for invoice lifecycle: DRAFT → OPEN → PAID / OVERDUE / CANCELLED / VOID / REFUNDED
- Automated status transitions based on due dates and payment events
- Key source: `modules/billing/invoice-status.service.ts`, `invoice-status.service.test.ts`

### Currency (`currency.service.ts`)
- Multi-currency support
- Exchange rate management
- Currency-aware pricing

### Billing Transactions (`billing-transaction.service.ts`)
- Records and manages financial transactions
- Links to invoices, adjustments, and payment events

### Billing Account (`billing-account.service.ts`)
- Organization billing account management
- Top-up and balance adjustment operations

## Admin Billing CRUD (`modules/billing/api/admin/`)

The admin section provides full CRUD for:

| Route | Description |
|-------|-------------|
| `invoice.route.ts` | Invoice creation, updates, transitions |
| `subscriptions.route.ts` | Subscription management |
| `adjust.route.ts` | Balance adjustments |
| `topup.route.ts` | Top-up operations |
| `transactions.route.ts` | Transaction listing |
| `audit-log.route.ts` | Billing audit log |

## Background Workers

| Worker | File | Schedule | Purpose |
|--------|------|----------|---------|
| Billing Cron | `scripts/billing-cron.ts` | Daily + Monthly | Reset quotas, generate invoices, payment reminders |
| App Hosting Billing | `scripts/app-hosting-billing-worker.ts` | Hourly | App hosting usage billing |
| WhatsApp Monthly Billing | `scripts/whatsapp-monthly-billing-worker.ts` | Hourly | WhatsApp monthly billing |
| Quota Reconciliation | `lib/queue/quota-reconciliation.ts` | Event-driven | Reconcile quota after message send |

## Key Constants

```typescript
// File: modules/billing/constants.ts
USAGE_CATEGORY_WHATSAPP_OUT  // WhatsApp outbound message category
USAGE_CATEGORY_...           // Other usage categories
```

## Billing Integration With WhatsApp

The WhatsApp message sending flow integrates with billing at multiple points:

1. **MessageCostService** — estimate per-message cost
2. **WhatsappBillingService** — consume allowance from addon quotas or charge overage
3. **QuotaGateService** — enforce subscription-based quota
4. **UsageLedgerService** — record usage after successful send
5. **QuotaAlertService** — low-balance warnings (PGREEN-143)
6. **QuotaReconciliation queue** — post-send quota recheck

Key source: `modules/whatsapp/messages/messages.service.ts` (lines ~119-180)

## Portal Pages (`app/[lang]/portal/billing/`)

The portal has an extensive billing UI (added in `312482e`):

| Page | Route |
|------|-------|
| Subscription | `/portal/billing/subscription` |
| Create Subscription | `/portal/billing/subscription/create` |
| Top Up | `/portal/billing/topup` |
| Invoices | `/portal/billing/invoices` |
| Invoice Detail | `/portal/billing/invoices/[id]` |
| Transactions | `/portal/billing/transactions` |
| Usage | `/portal/billing/usage` |
| Payment Methods | `/portal/billing/payment-methods` |
| Payments | `/portal/billing/payments` |
| Billing Alerts | `/portal/billing/alerts` |
| Audit Logs | `/portal/billing/audit-logs` |
| Contacts | `/portal/billing/contacts` |
| Settings | `/portal/billing/settings` |

## Email Integration

- **Email queue** (`lib/queue/email.ts`) — single queue for ALL transactional billing emails
- **Invoice emails** — React Email templates (`modules/invoices/email.service.tsx`)
- **Email logging** — `EmailLog` table tracks delivery status (PGREEN-153)
- **Email recipients** (`modules/billing/email-recipients.ts`) — resolved from billing contacts
