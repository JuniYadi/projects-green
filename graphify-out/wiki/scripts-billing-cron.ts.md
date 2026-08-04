# scripts/billing-cron.ts

> 51 nodes · cohesion 0.06

## Key Concepts

- **scripts/billing-cron.ts** (26 connections) — `scripts/billing-cron.ts`
- **InvoiceStatusManager** (14 connections) — `modules/billing/invoice-status.service.ts`
- **billing-cycle.service.ts** (13 connections) — `modules/billing/billing-cycle.service.ts`
- **BillingCycleService** (12 connections) — `modules/billing/billing-cycle.service.ts`
- **invoice-status.service.test.ts** (10 connections) — `modules/billing/invoice-status.service.test.ts`
- **.finalizeServiceInvoices()** (7 connections) — `modules/billing/billing-cycle.service.ts`
- **.processSubscription()** (7 connections) — `modules/billing/billing-cycle.service.ts`
- **.processMonthlyBilling()** (6 connections) — `modules/billing/billing-cycle.service.ts`
- **.getPeriodEnd()** (5 connections) — `modules/billing/billing-cycle.service.ts`
- **.getPeriodStart()** (5 connections) — `modules/billing/billing-cycle.service.ts`
- **.resolveInvoiceRecipients()** (5 connections) — `modules/billing/invoice-status.service.ts`
- **.runDailyTransitions()** (5 connections) — `modules/billing/invoice-status.service.ts`
- **.resolveInvoiceRecipients()** (4 connections) — `modules/billing/billing-cycle.service.ts`
- **billing-cycle.types.ts** (4 connections) — `modules/billing/billing-cycle.types.ts`
- **.sendInvoiceCreatedEmail()** (4 connections) — `modules/billing/invoice-status.service.ts`
- **.sendInvoiceOverdueEmail()** (4 connections) — `modules/billing/invoice-status.service.ts`
- **.sendPaymentReminderEmail()** (4 connections) — `modules/billing/invoice-status.service.ts`
- **.sendPaymentReminders()** (4 connections) — `modules/billing/invoice-status.service.ts`
- **toInvoiceListItem()** (4 connections) — `modules/billing/invoice-status.service.ts`
- **queue/billing-cron.ts** (3 connections) — `lib/queue/billing-cron.ts`
- **BillingCronJobData** (3 connections) — `lib/queue/billing-cron.ts`
- **BillingRunResult** (3 connections) — `modules/billing/billing-cycle.types.ts`
- **SubscriptionBillingResult** (3 connections) — `modules/billing/billing-cycle.types.ts`
- **.issueDraftInvoices()** (3 connections) — `modules/billing/invoice-status.service.ts`
- **.markOverdueInvoices()** (3 connections) — `modules/billing/invoice-status.service.ts`
- *... and 26 more nodes in this community*

## Relationships

- [workers.ts](workers.ts.md) (12 shared connections)
- [payment/api/topup.route.ts](payment-api-topup.route.ts.md) (5 shared connections)
- [fieldErrorMapFromIssues](fieldErrorMapFromIssues.md) (4 shared connections)
- [UsageLedgerService](UsageLedgerService.md) (4 shared connections)
- [invoices/api/invoices.route.ts](invoices-api-invoices.route.ts.md) (4 shared connections)
- [invoices/email.service.tsx](invoices-email.service.tsx.md) (3 shared connections)
- [prisma.ts](prisma.ts.md) (1 shared connections)

## Source Files

- `lib/queue/billing-cron.ts`
- `modules/billing/billing-cycle.service.ts`
- `modules/billing/billing-cycle.types.ts`
- `modules/billing/invoice-status.service.test.ts`
- `modules/billing/invoice-status.service.ts`
- `scripts/billing-cron.ts`
- `scripts/workers.ts`

## Audit Trail

- EXTRACTED: 197 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*