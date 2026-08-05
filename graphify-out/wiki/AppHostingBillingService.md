# AppHostingBillingService

> 31 nodes · cohesion 0.09

## Key Concepts

- **AppHostingBillingService** (16 connections) — `modules/deploy/billing/app-hosting-billing.service.ts`
- **app-hosting-billing.service.ts** (15 connections) — `modules/deploy/billing/app-hosting-billing.service.ts`
- **app-hosting-billing-worker.ts** (10 connections) — `scripts/app-hosting-billing-worker.ts`
- **billing-gate.route.ts** (7 connections) — `modules/deploy/api/routes/billing-gate.route.ts`
- **app-hosting-billing.service.test.ts** (7 connections) — `modules/deploy/billing/app-hosting-billing.service.test.ts`
- **main()** (5 connections) — `scripts/app-hosting-billing-worker.ts`
- **.chargePaygRuntimeHour()** (4 connections) — `modules/deploy/billing/app-hosting-billing.service.ts`
- **.quotePayg()** (3 connections) — `modules/deploy/billing/app-hosting-billing.service.ts`
- **decimal()** (3 connections) — `modules/deploy/billing/app-hosting-billing.service.test.ts`
- **chargeActivePaygStacks()** (3 connections) — `scripts/app-hosting-billing-worker.ts`
- **checkGraceSuspension()** (3 connections) — `scripts/app-hosting-billing-worker.ts`
- **billingGateRoutes** (2 connections) — `modules/deploy/api/routes/billing-gate.route.ts`
- **.assertCanStartPayg()** (2 connections) — `modules/deploy/billing/app-hosting-billing.service.ts`
- **.chargeMonthlyPackage()** (2 connections) — `modules/deploy/billing/app-hosting-billing.service.ts`
- **.checkGraceAndSuspend()** (2 connections) — `modules/deploy/billing/app-hosting-billing.service.ts`
- **.constructor()** (2 connections) — `modules/deploy/billing/app-hosting-billing.service.ts`
- **.enterGrace()** (2 connections) — `modules/deploy/billing/app-hosting-billing.service.ts`
- **.normalizeBufferHours()** (2 connections) — `modules/deploy/billing/app-hosting-billing.service.ts`
- **applicationStack()** (2 connections) — `modules/deploy/billing/app-hosting-billing.service.test.ts`
- **billingAccount()** (2 connections) — `modules/deploy/billing/app-hosting-billing.service.test.ts`
- **acquireLock()** (2 connections) — `scripts/app-hosting-billing-worker.ts`
- **releaseLock()** (2 connections) — `scripts/app-hosting-billing-worker.ts`
- **AppHostingBillingMode** (1 connections) — `modules/deploy/billing/app-hosting-billing.service.ts`
- **.clearGraceIfFunded()** (1 connections) — `modules/deploy/billing/app-hosting-billing.service.ts`
- **AppHostingChargeQuote** (1 connections) — `modules/deploy/billing/app-hosting-billing.service.ts`
- *... and 6 more nodes in this community*

## Relationships

- [BillingTransactionService](BillingTransactionService.md) (9 shared connections)
- [prisma.ts](prisma.ts.md) (8 shared connections)
- [workers.ts](workers.ts.md) (2 shared connections)

## Source Files

- `modules/deploy/api/routes/billing-gate.route.ts`
- `modules/deploy/billing/app-hosting-billing.service.test.ts`
- `modules/deploy/billing/app-hosting-billing.service.ts`
- `scripts/app-hosting-billing-worker.ts`

## Audit Trail

- EXTRACTED: 107 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*