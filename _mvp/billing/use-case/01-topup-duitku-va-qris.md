# Top-up via Duitku VA/QRIS

## Codebase Status

✅ **Real.** `POST /api/payments/topup` creates invoice, calls `duitkuService.createPayment()`, returns `paymentUrl`; webhook verifies HMAC + idempotency and credits balance.

## Entry Point

`/console/billing/topup`

## Actor

Customer / User

## Goal

Add balance to the organization `BillingAccount` using Duitku VA or QRIS, so paid services can run.

## Preconditions

- Organization has a billing account.
- Billing currency is selected (locked if financial records exist) — IDR for Duitku.
- Duitku gateway is configured and active (`gateway.service.getActiveConfig()`).

## Happy Path

1. Customer opens `/console/billing`, sees current balance on the balance card.
2. Customer clicks **Top Up** → `/console/billing/topup`.
3. Customer enters amount (min Rp10.000, max Rp100.000.000) and picks **VA** or **QRIS**.
4. Frontend sends `{ amount, paymentMethod }` to `POST /api/payments/topup`.
5. Backend creates `Invoice` (type `TOP_UP`, status `OPEN`), sets `paymentMethod` + `gatewayId`.
6. Backend calls `duitkuService.createPayment()` → gets `paymentUrl`, saves it to `invoice.metadata`.
7. API returns `{ invoice, paymentUrl }`; frontend redirects to Duitku.
8. Customer pays on Duitku.
9. Duitku sends callback to `POST /api/payments/webhooks/duitku/callback` → HMAC verified → idempotency checked → `creditBalance()` → invoice marked `PAID`.
10. Customer returned to `/console/billing/invoices/{id}?payment=success`.

## Edge / Error Paths

- **No gateway configured:** API returns 400; customer told to use manual transfer or contact support.
- **Invalid callback signature:** callback rejected; balance unchanged.
- **Duplicate callback:** idempotency guard (via `PaymentAuditLog` `DUITKU_CALLBACK_RECEIVED`) returns success without double-crediting.
- **Gateway payment failed:** invoice stays unpaid; balance unchanged.
- **Currency mismatch:** balance mutation rejected.

## Backend / API Surfaces

- `modules/payment/api/topup.route.ts` — `POST /api/payments/topup`.
- `modules/payment/services/duitku.service.ts` — `createPayment()`, signature gen.
- `modules/payment/api/webhook.route.ts` — callback + return redirect.
- `modules/payment/services/payment.service.ts` — `creditBalance()`.

## Console Surface

- `/console/billing/topup` — `TopupFormEnhanced` (amount + method).
- `/console/billing/invoices/[id]` — handles `?payment=success|pending|failed`.

## Portal Surface

- None for the customer top-up itself; admin gateway config is UC-03.

## Done Criteria

- Balance increases by the paid amount exactly once (idempotent).
- Top-up invoice becomes PAID.
- Duplicate callback never double-credits.

## Client-Facing Notes

Customer tops up once; balance is shared across all products. Show balance in green `+` on success.
