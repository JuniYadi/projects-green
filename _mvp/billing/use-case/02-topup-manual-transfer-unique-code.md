# Top-up via Manual Transfer + Unique Code

## Codebase Status

✅ **Real.** Manual method on topup route + `confirm.route.ts` + `confirmation.service.ts`; admin reviews under `/portal/payments` confirmations tab.

## Entry Point

`/console/billing/topup` (Manual Bank Transfer) → `/console/billing/payments/confirm`

## Actor

Customer / User (submits), Billing Admin (approves)

## Goal

Top up balance by bank transfer, with an optional unique-code amount to make verification deterministic.

## Preconditions

- Manual bank transfer is enabled.
- At least one active destination bank account exists.
- Optional unique-code setting may be enabled by admin.

## Happy Path

1. Customer opens `/console/billing/topup`, chooses **Manual Bank Transfer**.
2. System creates a top-up invoice.
3. If unique code is enabled, system adds a 3-digit code to the amount (e.g. Rp100.000 → Rp100.123).
4. Invoice page shows destination bank account, exact amount (incl. unique code), and a confirmation form.
5. Customer transfers the exact invoice amount.
6. Customer submits confirmation: sender name/bank/account, destination bank, transfer datetime, amount, proof file, optional notes.
7. Billing admin reviews in Portal Payments → Confirmations.
8. Admin approves → balance credited by exact invoice amount → ledger credit → invoice PAID.

## Unique Code Rule

The unique-code amount is part of the credited balance. No deduction. Transfer Rp100.123 → credit Rp100.123.

## Edge / Error Paths

- **Rejection:** balance unchanged; rejection reason stored; customer can resubmit or contact support.
- **Wrong amount transferred:** admin discretion; MVP credits the exact confirmed invoice amount on approval.
- **No active bank account:** manual method unavailable; customer told to use Duitku.

## Backend / API Surfaces

- `modules/payment/api/topup.route.ts` — manual method creates invoice.
- `modules/payment/api/confirm.route.ts` — confirmation submission.
- `modules/payment/services/confirmation.service.ts` — review/approve/reject.
- `modules/payment/api/admin-confirmation.route.ts` — admin approve/reject.

## Console Surface

- `/console/billing/topup` (manual) + `/console/billing/payments/confirm`.

## Portal Surface

- `/portal/payments` → Confirmations tab.

## Done Criteria

- Approval credits exact invoice amount once; ledger + audit recorded.
- Rejection leaves balance unchanged with a stored reason.

## Client-Facing Notes

Tell customer to transfer the exact amount including the unique code. The unique code is not a fee.
