# Billing & Payment MVP Task Map

| Workstream | Use Cases | Primary Surface | Prompt |
|------------|-----------|-----------------|--------|
| Doc foundation | Planning artifacts + design spec | Docs | [`01-doc-foundation.md`](../../docs/superpowers/prompts/billing-mvp/01-doc-foundation.md) |
| Top-up money path | 01, 02 | BE/API + Logic + `/console` | [`02-topup-money-path.md`](../../docs/superpowers/prompts/billing-mvp/02-topup-money-path.md) |
| Admin payment config | 03, 04 | `/portal` + BE/API | [`03-admin-payment-config.md`](../../docs/superpowers/prompts/billing-mvp/03-admin-payment-config.md) |
| Invoice payment + balance gate | 05, 06 | BE/API + Logic + `/console` | [`04-invoice-payment-balance-gate.md`](../../docs/superpowers/prompts/billing-mvp/04-invoice-payment-balance-gate.md) |
| Per-product charging | 07, 08, 09 | BE/API + Logic | [`05-per-product-charging.md`](../../docs/superpowers/prompts/billing-mvp/05-per-product-charging.md) |
| Invoice lifecycle + currency + alerts | 10, 11, 12 | BE/API + Logic + `/console` | [`06-invoice-lifecycle-currency-alerts.md`](../../docs/superpowers/prompts/billing-mvp/06-invoice-lifecycle-currency-alerts.md) |
| Customer UI + admin adjustments | 13, 14 | `/console` + `/portal` + BE/API | [`07-customer-ui-admin-adjustments.md`](../../docs/superpowers/prompts/billing-mvp/07-customer-ui-admin-adjustments.md) |
| Verification and rollout | Cross-cutting | Docs + integration | [`08-verification-and-rollout.md`](../../docs/superpowers/prompts/billing-mvp/08-verification-and-rollout.md) |

## Use Case Index

| # | Use Case | Components | Codebase Status | File |
|---|----------|------------|-----------------|------|
| 01 | Top-up via Duitku VA/QRIS | `/console`, API, Logic | ✅ real | [`use-case/01-topup-duitku-va-qris.md`](./use-case/01-topup-duitku-va-qris.md) |
| 02 | Top-up via manual transfer + unique code | `/console`, API, Logic | ✅ real | [`use-case/02-topup-manual-transfer-unique-code.md`](./use-case/02-topup-manual-transfer-unique-code.md) |
| 03 | Admin configure payment gateway | `/portal`, API, Logic | ✅ real | [`use-case/03-admin-configure-gateway.md`](./use-case/03-admin-configure-gateway.md) |
| 04 | Admin manage manual confirmation | `/portal`, API, Logic | ✅ real | [`use-case/04-admin-manage-manual-confirmation.md`](./use-case/04-admin-manage-manual-confirmation.md) |
| 05 | Pay invoice via balance / top-up + pay | `/console`, API, Logic | ✅ real | [`use-case/05-pay-invoice-balance-or-topup.md`](./use-case/05-pay-invoice-balance-or-topup.md) |
| 06 | Balance Gate enforcement | API, Logic | ✅ real | [`use-case/06-balance-gate-enforcement.md`](./use-case/06-balance-gate-enforcement.md) |
| 07 | App Hosting PAYG charge + grace | API, Logic | ⚠️ partial | [`use-case/07-app-hosting-payg-charge-grace.md`](./use-case/07-app-hosting-payg-charge-grace.md) |
| 08 | WhatsApp base + allowance + overage | API, Logic | ✅ real | [`use-case/08-whatsapp-base-allowance-overage.md`](./use-case/08-whatsapp-base-allowance-overage.md) |
| 09 | VPN monthly charge | API, Logic | ⚠️ backend only, no UI | [`use-case/09-vpn-monthly-charge.md`](./use-case/09-vpn-monthly-charge.md) |
| 10 | Monthly invoice finalization | API, Logic | ✅ real | [`use-case/10-monthly-invoice-finalization.md`](./use-case/10-monthly-invoice-finalization.md) |
| 11 | Currency selection + lock | API, Logic, `/console` | ⚠️ logic present, UI unverified | [`use-case/11-currency-selection-lock.md`](./use-case/11-currency-selection-lock.md) |
| 12 | Budget alerts / low-balance warning | API, Logic, `/console` | ✅ alerts UI exists | [`use-case/12-budget-alerts-low-balance.md`](./use-case/12-budget-alerts-low-balance.md) |
| 13 | Customer transaction history UI | `/console`, API | ✅ transactions page exists | [`use-case/13-customer-transaction-history-ui.md`](./use-case/13-customer-transaction-history-ui.md) |
| 14 | Admin billing adjustments | `/portal`, API, Logic | ✅ API + list UI; create form ⚠️ | [`use-case/14-admin-billing-adjustments.md`](./use-case/14-admin-billing-adjustments.md) |

## Notes

- Codebase Status reflects verification on 2026-06-07 against `/Users/juniyadi/github-yadi/projects-green`. Re-verify per use case during execution (workstream 8).
- Because billing backend is largely real, most workstreams are **alignment / wiring / UI polish + verification**, not greenfield build. The largest true gaps: VPN UI (UC-09), App Hosting deploy-flow billing UX (UC-07), and admin adjustment create form (UC-14).
