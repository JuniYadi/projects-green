# Admin Manage Manual Confirmation

## Codebase Status

✅ **Real.** `admin-confirmation.route.ts` + `confirmation.service.ts`; UI at `/portal/payments` Confirmations tab. All actions audited via `PaymentAuditLog`.

## Entry Point

`/portal/payments` → Confirmations tab

## Actor

Billing Admin / Super admin

## Goal

Verify customer manual bank transfers and credit balance accurately.

## Preconditions

- Customer submitted a manual transfer confirmation (UC-02).
- Admin resolves to `super_admin`.

## Happy Path

1. Admin opens `/portal/payments` → Confirmations tab; sees pending confirmations.
2. Admin reviews uploaded proof + sender info against the destination account.
3. Admin clicks **Approve** → credits balance by exact invoice amount → marks invoice PAID → ledger credit.
4. Or clicks **Reject** with a reason → balance unchanged.
5. `PaymentAuditLog` records the action.

## Edge / Error Paths

- **Double approval:** idempotency must prevent double-credit; approving an already-PAID invoice is a no-op.
- **Amount mismatch:** MVP credits the confirmed invoice amount; large discrepancies handled by support.
- **Rejected then resubmitted:** new confirmation supersedes; old one stays rejected with reason.

## Backend / API Surfaces

- `modules/payment/api/admin-confirmation.route.ts`
- `modules/payment/services/confirmation.service.ts`
- `modules/payment/services/payment.service.ts` — `creditBalance()`

## Console Surface

- None (admin-only). Customer sees confirmation status on their invoice.

## Portal Surface

- `/portal/payments` → Confirmations tab.

## Done Criteria

- Approve credits exactly once with ledger + audit; reject stores reason; no double-credit.

## Client-Facing Notes

Approve the exact transferred/invoice amount including unique code. Do not subtract the unique code.
