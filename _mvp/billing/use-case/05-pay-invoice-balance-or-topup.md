# Pay Invoice via Balance / Top-up + Pay

## Codebase Status

✅ **Real.** `invoice-payment.route.ts` exposes pay-with-balance and topup-and-pay; console invoice detail wires both buttons.

## Entry Point

`/console/billing/invoices/{id}`

## Actor

Customer / User

## Goal

Pay a service invoice from balance, or top up the gap then pay, without leaving the invoice page.

## Preconditions

- Invoice is `OPEN` and belongs to the user's org.
- Customer has a billing account.

## Happy Path — Path 1 (sufficient balance)

1. Customer opens `/console/billing/invoices/{id}`, sees invoice + current balance.
2. Clicks **Pay with Balance** → `POST /api/payments/invoice/pay-with-balance`.
3. Backend validates invoice OPEN + ownership, checks balance ≥ total, creates `BillingAdjustment` (DEBIT), decrements balance, marks invoice PAID.
4. Frontend shows success.

## Happy Path — Path 2 (insufficient balance)

1. Same steps 1.
2. Clicks **Top Up + Pay** → `POST /api/payments/invoice/topup-and-pay`.
3. Backend computes gap (total − balance), creates topup invoice via `createTopupInvoiceForGap()`.
4. Returns `{ topupRequired: true, gapAmount, topupInvoiceId }`.
5. Frontend shows dialog → "Go to Top-Up" → `/console/billing/topup`.
6. Customer completes UC-01, returns to pay the invoice.

## Edge / Error Paths

- **Invoice not OPEN:** rejected (already paid / draft).
- **Cross-org access:** ownership guard rejects.
- **Balance changed mid-flow:** re-check at charge time; reject if no longer sufficient.

## Backend / API Surfaces

- `modules/payment/api/invoice-payment.route.ts` — `pay-with-balance`, `topup-and-pay`.
- `createTopupInvoiceForGap()` helper.

## Console Surface

- `/console/billing/invoices/[id]` — Pay with Balance + Top Up & Pay buttons.

## Portal Surface

- `/portal/billing/invoices/[id]` — admin view of invoice.

## Done Criteria

- Sufficient balance → invoice PAID + DEBIT adjustment.
- Insufficient → gap topup invoice created; no partial charge.

## Client-Facing Notes

Most service invoices are already paid from balance during the month (receipt model). This path covers explicit/standalone invoices.
