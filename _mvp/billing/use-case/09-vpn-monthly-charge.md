# VPN Monthly Charge

## Codebase Status

⚠️ **Backend real, no UI.** `modules/vpn/billing/vpn-billing.service.ts` + `vpn-renewal.service.ts`; route debits balance upfront and is mounted in `lib/api.ts`. **No `/console/vpn` or `/portal/vpn` surface exists** — the main MVP gap for VPN.

## Entry Point

VPN provision/renew flow (UI to be built) + monthly renewal worker.

## Actor

Customer / User (provision), System Worker (renewal)

## Goal

Provision or renew VPN on monthly billing, charging the monthly fee upfront from balance before provisioning.

## Preconditions

- VPN region + monthly price selected.
- Customer has billing account balance.

## Happy Path

1. Customer chooses VPN plan/region.
2. System checks balance against monthly price.
3. If sufficient → debit balance upfront → ledger debit → monthly invoice line → provision/renew VPN.
4. If insufficient → provision/renewal rejected → top-up prompt.

## Important Rules

- VPN is **monthly-only**. No PAYG, no grace period in MVP.
- VPN never mutates `BillingAccount.balance` directly — it goes through `VpnBillingService` (per code comment).

## Cross-sell Rules

- Standalone VPN Indonesia = separate monthly SKU.
- App Hosting VPN add-on = separate monthly invoice line from the same balance.
- Future Global Bundle only for regions with verified servers.
- Keep invoice lines explicit (e.g. `VPN Indonesia Add-on — June 2026`).

## Edge / Error Paths

- **Insufficient at provision/renewal:** rejected with 422, no debit.
- **Renewal fails:** subscription not extended; customer notified.

## Backend / API Surfaces

- `modules/vpn/api/vpn.route.ts` — provision/charge.
- `modules/vpn/billing/vpn-billing.service.ts` — `chargeMonthly`.
- `modules/vpn/billing/vpn-renewal.service.ts` — renewal.
- `modules/vpn/billing/vpn-pricing.ts` — pricing.

## Console Surface

- ❌ **Missing — to build:** `/console/vpn` — pick region/plan, see active access, download `.ovpn`.

## Portal Surface

- ❌ **Missing — to build:** `/portal/vpn` — admin create/revoke client, server health.

## Done Criteria

- Monthly fee debited upfront via `VpnBillingService`; invoice line written; provisioning gated by balance.
- Customer + admin UI exist (largest gap).

## Client-Facing Notes

VPN is billed monthly upfront. See `_features/vpn-use-cases.md` + `integrations/openvpn/` for the SSH-adapter MVP path.
