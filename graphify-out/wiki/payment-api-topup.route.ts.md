# payment/api/topup.route.ts

> 113 nodes · cohesion 0.03

## Key Concepts

- **payment/api/topup.route.ts** (29 connections) — `modules/payment/api/topup.route.ts`
- **payment.types.ts** (24 connections) — `modules/payment/types/payment.types.ts`
- **PaymentService** (20 connections) — `modules/payment/services/payment.service.ts`
- **InvoiceEmailService** (17 connections) — `modules/invoices/email.service.tsx`
- **GatewayService** (17 connections) — `modules/payment/services/gateway.service.ts`
- **BankAccountService** (15 connections) — `modules/payment/services/bank-account.service.ts`
- **payment.service.ts** (15 connections) — `modules/payment/services/payment.service.ts`
- **EncryptionService** (14 connections) — `modules/payment/services/encryption.service.ts`
- **bank-account.service.ts** (11 connections) — `modules/payment/services/bank-account.service.ts`
- **PaymentGatewayResponse** (11 connections) — `modules/payment/types/payment.types.ts`
- **admin-bank.route.ts** (10 connections) — `modules/payment/api/admin-bank.route.ts`
- **webhook.route.ts** (10 connections) — `modules/payment/api/webhook.route.ts`
- **gateway.service.ts** (10 connections) — `modules/payment/services/gateway.service.ts`
- **.toResponse()** (10 connections) — `modules/payment/services/gateway.service.ts`
- **BankAccountResponse** (10 connections) — `modules/payment/types/payment.types.ts`
- **webhook.route.test.ts** (9 connections) — `modules/payment/api/webhook.route.test.ts`
- **.toResponse()** (9 connections) — `modules/payment/services/bank-account.service.ts`
- **duitku.service.ts** (9 connections) — `modules/payment/services/duitku.service.ts`
- **DuitkuService** (9 connections) — `modules/payment/services/duitku.service.ts`
- **confirm.route.ts** (8 connections) — `modules/payment/api/confirm.route.ts`
- **payment/constants.ts** (8 connections) — `modules/payment/constants.ts`
- **.encryptField()** (8 connections) — `modules/payment/services/encryption.service.ts`
- **DuitkuConfig** (7 connections) — `modules/payment/types/payment.types.ts`
- **.update()** (6 connections) — `modules/payment/services/bank-account.service.ts`
- **.decryptField()** (6 connections) — `modules/payment/services/encryption.service.ts`
- *... and 88 more nodes in this community*

## Relationships

- [BillingTransactionService](BillingTransactionService.md) (9 shared connections)
- [invoices/api/invoices.route.ts](invoices-api-invoices.route.ts.md) (9 shared connections)
- [getPlatformRoleForUser](getPlatformRoleForUser.md) (9 shared connections)
- [api.ts](api.ts.md) (9 shared connections)
- [app-credential.service.ts](app-credential.service.ts.md) (9 shared connections)
- [prisma.ts](prisma.ts.md) (7 shared connections)
- [providers/index.ts](providers-index.ts.md) (7 shared connections)
- [scripts/billing-cron.ts](scripts-billing-cron.ts.md) (5 shared connections)
- [fieldErrorMapFromIssues](fieldErrorMapFromIssues.md) (4 shared connections)
- [invoices/email.service.tsx](invoices-email.service.tsx.md) (3 shared connections)
- [CurrencyService](CurrencyService.md) (2 shared connections)
- [UsageLedgerService](UsageLedgerService.md) (1 shared connections)

## Source Files

- `modules/billing/billing-cycle.service.ts`
- `modules/billing/billing-transaction.service.ts`
- `modules/billing/invoice-status.service.ts`
- `modules/invoices/email.service.tsx`
- `modules/payment/api/admin-bank.route.ts`
- `modules/payment/api/confirm.route.ts`
- `modules/payment/api/topup.route.ts`
- `modules/payment/api/webhook.route.test.ts`
- `modules/payment/api/webhook.route.ts`
- `modules/payment/constants.ts`
- `modules/payment/services/bank-account.service.ts`
- `modules/payment/services/duitku.service.ts`
- `modules/payment/services/encryption.service.ts`
- `modules/payment/services/gateway.service.ts`
- `modules/payment/services/invoice-expiration.service.ts`
- `modules/payment/services/payment.service.ts`
- `modules/payment/types/payment.types.ts`

## Audit Trail

- EXTRACTED: 503 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*