# Monthly Invoice Finalization

## Codebase Status

✅ **Real.** `billing-cycle.service.ts` (`BillingCycleService`) + `invoice-status.service.ts` (`InvoiceStatusManager`) wired via `scripts/billing-cron.ts`. (FEATURES.md / BILLING-and-PAYMENT.md status table marking this "Pending" is stale.)

## Entry Point

End-of-month billing cron.

## Actor

System Worker

## Goal

Turn the live current-month service summary into a final, locked, already-paid monthly receipt.

## Preconditions

- Service charges accrued during the month as ledger debits + invoice lines.

## Happy Path

1. During the month, service charges write to the current-month service invoice (DRAFT/current summary).
2. User sees it as "Current month summary".
3. End-of-month worker finalizes the invoice → FINAL/paid.
4. Invoice number + lines locked.
5. Email sent to customer.
6. New month starts a new current-month summary.

## Invoice States

| Status | When | Description |
|--------|------|-------------|
| DRAFT / current | During month | Live running total, inspectable, not enforceable |
| FINAL | Month boundary | Locked authoritative receipt; replaces prior DRAFT |

`InvoiceStatusManager` also handles ISSUED → OVERDUE with a 14-day grace for non-balance invoice types.

## Important Rule

The final monthly service invoice is **already paid by balance**. It must not ask the customer to pay again (receipt, not debt).

## Edge / Error Paths

- **No usage:** no invoice until at least one charge exists.
- **Adjustments after FINAL:** only `BillingAdjustment` entries allowed post-finalization.
- **Cron missed run:** idempotent finalization; rerun must not double-finalize.

## Backend / API Surfaces

- `modules/billing/billing-cycle.service.ts` — `BillingCycleService`.
- `modules/billing/invoice-status.service.ts` — `InvoiceStatusManager`.
- `scripts/billing-cron.ts` + `lib/queue/billing-cron.ts`.

## Console Surface

- `/console/billing/invoices` + `/console/billing/invoices/[id]` — current summary + finalized receipt.

## Portal Surface

- `/portal/billing/invoices/[id]` — admin invoice view.

## Done Criteria

- DRAFT → FINAL once at month boundary; invoice number assigned; email sent; locked.

## Client-Facing Notes

Explain services are prepaid from balance; the monthly invoice is a receipt/summary.
