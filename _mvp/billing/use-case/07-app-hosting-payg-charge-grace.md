# App Hosting PAYG Charge + Grace

## Codebase Status

⚠️ **Partial.** Hourly worker `scripts/app-hosting-billing-worker.ts` + PAYG buffer/grace foundation exist. Deploy-flow billing UX and explicit grace/suspend wiring still need alignment (see FEATURES.md §3.1).

## Entry Point

App Hosting deploy flow (`/console/app/deploy`) + hourly worker.

## Actor

Customer / User (deploy), System Worker (hourly charge)

## Goal

Deploy with a balance buffer, charge actual runtime hourly, warn at low balance, grace 24h, then suspend.

## Preconditions

- Customer selects App Hosting PAYG; hourly cost computable.
- Customer selects runtime buffer (minimum 24 hours).

## Happy Path

1. Customer configures deploy, selects PAYG; UI defaults buffer to 24h (may increase).
2. System computes required balance = hourly cost × buffer hours.
3. If balance sufficient → deploy starts; records PAYG mode, hourly rate, buffer.
4. Hourly worker debits balance, writes ledger debit + monthly invoice line.
5. Worker estimates remaining hours = balance / hourly cost.
6. If remaining ≤ 24h → low-balance email + budget alert.
7. If hourly charge can't be covered → app enters 24h payment grace.
8. Top-up within 24h → back to active billing; no top-up after 24h → suspend.

## Edge / Error Paths

- **Insufficient at deploy:** deploy rejected; no infra cost; top-up prompt.
- **Idle app:** zero runtime → zero charge.
- **Cap reached:** charges capped at monthly package price (`monthlyCap`).

## Important Rule

App Hosting PAYG is the **only** MVP flow with a 24-hour grace period (stopping infra immediately is disruptive).

## Backend / API Surfaces

- `scripts/app-hosting-billing-worker.ts` — hourly charge.
- `modules/billing/balance-gate.service.ts`, `usage-ledger.service.ts`, `costing.service.ts`.
- Deploy config persistence (App Hosting MVP, PGREEN-068).

## Console Surface

- `/console/app/deploy` — PAYG selector + buffer hours + required-balance display.
- `/console/app/*` — suspension/grace status.

## Portal Surface

- Admin oversight of suspended/grace apps (App Hosting portal CRUD).

## Done Criteria

- Deploy gated by buffer balance; hourly charge + ledger + invoice line; warning → grace → suspend enforced.

## Client-Facing Notes

Explain the 24h buffer requirement and the 24h grace before suspension. See cross-ref `_mvp/app-hosting/use-case/16-post-deploy-billing-grace-and-suspension.md`.
