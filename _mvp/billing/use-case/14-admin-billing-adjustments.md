# Admin Billing Adjustments

## Codebase Status

✅ **API + list UI real; create form ⚠️.** `admin/adjust.route.ts` (create) + `admin/adjustments.route.ts` (list); `/portal/billing/tabs/adjustments-tab.tsx` lists. FEATURES.md notes create is "API only, list UI ✅" — the create form is the gap.

## Entry Point

`/portal/billing` → Adjustments tab

## Actor

Billing Admin / Super admin

## Goal

Apply manual credit or debit corrections to an organization's balance with a full audit trail.

## Preconditions

- Admin resolves to `super_admin`.
- Target organization billing account exists.

## Happy Path

1. Admin opens `/portal/billing` → Adjustments tab; sees existing adjustments.
2. Admin clicks **Add Adjustment** (the form to build).
3. Selects type (CREDIT/DEBIT), amount, reason/notes.
4. `POST` to `admin/adjust.route` → creates `BillingAdjustment` → updates balance → audit log.
5. New adjustment appears in the list.

## Edge / Error Paths

- **Debit exceeding balance:** decide policy — allow negative or block (verify; recommend block in MVP).
- **Missing reason:** require a reason for audit.
- **Non-admin actor:** guard rejects.
- **Adjustment on FINAL invoice:** allowed (adjustments are the only post-finalization correction).

## Backend / API Surfaces

- `modules/billing/api/admin/adjust.route.ts` — create.
- `modules/billing/api/admin/adjustments.route.ts` — list.
- Writes `BillingAdjustment` + audit.

## Console Surface

- None (admin-only). Customer sees the result as a friendly +/− entry (UC-13).

## Portal Surface

- `/portal/billing` → Adjustments tab (list ✅; **create form to build**).

## Done Criteria

- Admin can create CREDIT/DEBIT adjustments from the UI with required reason; balance + audit updated; list reflects it.

## Client-Facing Notes

Adjustments are the controlled correction mechanism (no automated refunds/credit notes in MVP). Customer sees "Balance adjustment added/deducted".
