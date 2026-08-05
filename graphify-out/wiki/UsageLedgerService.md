# UsageLedgerService

> 37 nodes · cohesion 0.07

## Key Concepts

- **UsageLedgerService** (18 connections) — `modules/billing/usage-ledger.service.ts`
- **billing/api/usage.route.ts** (13 connections) — `modules/billing/api/usage.route.ts`
- **usage-ledger.service.ts** (12 connections) — `modules/billing/usage-ledger.service.ts`
- **usage-ledger.service.test.ts** (9 connections) — `modules/billing/usage-ledger.service.test.ts`
- **createUsageRoutes()** (7 connections) — `modules/billing/api/usage.route.ts`
- **billing-cycle.test.ts** (6 connections) — `modules/billing/billing-cycle.test.ts`
- **billing/api/usage.route.test.ts** (5 connections) — `modules/billing/api/usage.route.test.ts`
- **UsageLedgerEntry** (3 connections) — `modules/billing/types.ts`
- **isValidDate()** (2 connections) — `modules/billing/api/usage.route.ts`
- **toForbidden()** (2 connections) — `modules/billing/api/usage.route.ts`
- **toUnauthorized()** (2 connections) — `modules/billing/api/usage.route.ts`
- **toValidationError()** (2 connections) — `modules/billing/api/usage.route.ts`
- **.recordUsage()** (2 connections) — `modules/billing/usage-ledger.service.ts`
- **RouteSet** (1 connections) — `modules/billing/api/usage.route.ts`
- **mockAuthenticate** (1 connections) — `modules/billing/api/usage.route.test.ts`
- **mockCostingService** (1 connections) — `modules/billing/api/usage.route.test.ts`
- **mockUsageLedgerService** (1 connections) — `modules/billing/api/usage.route.test.ts`
- **UsageAuthContext** (1 connections) — `modules/billing/api/usage.route.ts`
- **createMockPrisma()** (1 connections) — `modules/billing/billing-cycle.test.ts`
- **mockGetUser** (1 connections) — `modules/billing/billing-cycle.test.ts`
- **mockListOrgMemberships** (1 connections) — `modules/billing/billing-cycle.test.ts`
- **mockUsageLedger** (1 connections) — `modules/billing/billing-cycle.test.ts`
- **RatedUsage** (1 connections) — `modules/billing/usage-ledger.service.ts`
- **createMockPrisma()** (1 connections) — `modules/billing/usage-ledger.service.test.ts`
- **MockedPrisma** (1 connections) — `modules/billing/usage-ledger.service.test.ts`
- *... and 12 more nodes in this community*

## Relationships

- [messages.service.ts](messages.service.ts.md) (6 shared connections)
- [billing/api/index.ts](billing-api-index.ts.md) (4 shared connections)
- [scripts/billing-cron.ts](scripts-billing-cron.ts.md) (4 shared connections)
- [workers.ts](workers.ts.md) (2 shared connections)
- [payment/api/topup.route.ts](payment-api-topup.route.ts.md) (1 shared connections)

## Source Files

- `modules/billing/api/usage.route.test.ts`
- `modules/billing/api/usage.route.ts`
- `modules/billing/billing-cycle.test.ts`
- `modules/billing/types.ts`
- `modules/billing/usage-ledger.service.test.ts`
- `modules/billing/usage-ledger.service.ts`

## Audit Trail

- EXTRACTED: 107 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*