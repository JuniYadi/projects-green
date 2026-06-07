# Billing & Payment MVP

## Goal

Sellable balance-first billing foundation that every paid product (App Hosting, WhatsApp, VPN) charges against. One organization balance is the single source of truth: top-up fills it, services consume it, every charge maps to a ledger entry + invoice line + audit trail.

Sell promise:

> "Isi saldo sekali, semua layanan kamu — App Hosting, WhatsApp, VPN — pakai saldo yang sama. Top up via VA/QRIS/transfer manual, pantau pemakaian dan invoice dari satu dashboard."

## Core MVP Invariant

`BillingAccount.balance` is the single source of truth. Every paid action must have a charge path: **balance ledger → invoice line → audit trail**. No paid service runs without a balance path.

## Scope In

- Top-up: Duitku VA/QRIS + manual bank transfer with unique code
- Admin payment config: gateway (encrypted), bank accounts, manual confirmation review
- Pay invoice from balance / top-up-and-pay
- Balance Gate enforcement (no-balance reject, deduct, warn, stop)
- Per-product charging: App Hosting PAYG + grace, WhatsApp base + allowance + overage, VPN monthly
- Monthly service invoice draft → finalization (paid receipt model)
- Currency selection + lock (clean-account rule)
- Budget alerts / low-balance warning
- Customer transaction history UI (user-friendly +/− language)
- Admin billing adjustments (credit/debit)

## Scope Out (MVP non-goals)

- Mixed-currency wallet in one organization
- Real-time FX conversion
- Postpaid service invoices
- Collection / dunning for unpaid monthly invoices
- WhatsApp grace period
- VPN grace period
- App Hosting renewal grace beyond PAYG runtime grace
- Refund automation
- Tax engine
- Credit notes beyond the explicit admin adjustment flow

## Actors

- Customer / User (`/console/billing`)
- Billing Admin / Super admin (`/portal/billing`, `/portal/payments`)
- System Worker (hourly PAYG, monthly renewal, invoice finalization, quota reset)
- Payment Gateway (Duitku VA/QRIS)
- Support Team

## Component Mapping

Every workstream maps back to the four components, matching the App Hosting and WhatsApp models:

| Component | Where |
|-----------|-------|
| API | `modules/billing/api/*` + `modules/payment/api/*` |
| Logic | `modules/billing/*.service.ts` + `modules/payment/services/*` + `scripts/billing-cron.ts` + product workers |
| UI `/console` | `app/[lang]/console/billing/*` |
| UI admin `/portal` | `app/[lang]/portal/billing/*` + `app/[lang]/portal/payments/*` |

## Workstreams

1. Doc foundation (this `_mvp/billing/` package + recreated design spec)
2. Top-up money path (Duitku VA/QRIS + manual transfer + unique code)
3. Admin payment config + manual confirmation (`/portal/payments`)
4. Invoice payment + balance gate enforcement
5. Per-product charging alignment (App Hosting / WhatsApp / VPN)
6. Invoice lifecycle + finalization + currency lock + alerts
7. Customer billing UI polish (`/console/billing`) + admin adjustments (`/portal/billing`)
8. Verification and rollout

## Dependency Order

1 → 2 → 3 → 4 → 5/6 → 7 → 8

## Task Mapping

See [`tasks-map.md`](./tasks-map.md).

## Codebase Status Snapshot (verified 2026-06-07)

Billing is the most mature area in the project. Most backend is real; gaps are mostly stale docs, missing spec files, and VPN UI. See [`qna.md`](./qna.md) §0 for the full verification table.

| Area | Status |
|------|--------|
| Real top-up money path (`/api/payments/topup` → Duitku) | ✅ real |
| Manual transfer + confirmation | ✅ real |
| Balance Gate / Quota Gate / usage ledger | ✅ real, tested |
| Auto-invoicing (billing-cycle + invoice-status + cron) | ✅ real (docs marked it "Pending" — stale) |
| WhatsApp + VPN balance charging | ✅ real backend |
| VPN customer/admin UI | ❌ missing |
| Foundation design spec | 🔴 was missing — recreated in this MVP |
| Duitku HMAC "Known Bug" | 🟢 already fixed in code — FEATURES.md note is stale |

## Key Links

- MVP index: [`../../MVP.md`](../../MVP.md)
- Decision sheet: [`./qna.md`](./qna.md)
- Use-case library: [`./use-case/`](./use-case/)
- Deep-dive billing spec: [`../../BILLING-and-PAYMENT.md`](../../BILLING-and-PAYMENT.md)
- Deep-dive reference: [`../../BILLING-and-PAYMENT.md`](../../BILLING-and-PAYMENT.md)
- Operating use-cases (team guide): [`../../_features/billing-payment-balance-foundation-use-cases.md`](../../_features/billing-payment-balance-foundation-use-cases.md)
- Duitku integration: [`../../integrations/duitku/`](../../integrations/duitku/)
- Pricing reference: [`../../PACKAGE.md`](../../PACKAGE.md)
- Per-product billing plans:
  - [`../../docs/superpowers/plans/2026-06-04-app-hosting-billing-integration-implementation.md`](../../docs/superpowers/plans/2026-06-04-app-hosting-billing-integration-implementation.md)
  - [`../../docs/superpowers/plans/2026-06-04-whatsapp-billing-integration-implementation.md`](../../docs/superpowers/plans/2026-06-04-whatsapp-billing-integration-implementation.md)
  - [`../../docs/superpowers/plans/2026-06-04-vpn-monthly-billing-integration-implementation.md`](../../docs/superpowers/plans/2026-06-04-vpn-monthly-billing-integration-implementation.md)
