## Summary

Phase 2 coverage boost: raised coverage threshold from 85% to 90%. 25 commits adding tests across 4 module clusters (support-tickets, tenants, billing, invoices) plus admin guards.

## What changed

- **Threshold**: `scripts/check-coverage-threshold.ts` — 85 → 90
- **Support tickets**: added `getTicketThread` null edge case test
- **Tenants**: added auth-failure path tests to 6 route files (authorization, organizations, organization, memberships, invitations, bootstrap)
- **Billing**: added unknown status fallback + no-admin email path tests; fixed false-positive test in subscriptions route
- **Invoices**: added loading/error state tests for invoice-detail-screen and invoice-download-pdf-action
- **Admin**: covered `getAdminActorContext` and `requireSuperAdmin` in admin.guards

## Coverage

| Metric | Before | After |
|--------|--------|-------|
| Function coverage | 89.82% | 90.09% |
| Line coverage | 92.18% | 92.52% |
| Threshold | 85% | 90% |

## Notes

- Pre-existing lint errors (6 `no-explicit-any` elsewhere) and mock.module cache conflicts between test files are not introduced by this branch
