# Billing & Payment Sellable MVP — Brainstorming QnA

> **Purpose:** Single-page decision sheet to consolidate the scattered billing/payment docs into one `_mvp/billing/` package, mirroring the 4-component model (API, Logic, UI `/console`, UI admin `/portal`) used by App Hosting and WhatsApp — before any planning docs / task files are written.
>
> **Created:** 2026-06-07
> **Topic:** Billing & Payment sellable MVP, the foundation every other product charges against
> **Codebase:** `/Users/juniyadi/github-yadi/projects-green` (verified read-only)
> **Planning repo:** `JuniYadi/ide-projects` → `projects-green/`
>
> **How to use:** Answer each question inline under **Answer:**. Recommendations are pre-filled as `→ Recommended:`. Where you agree, write "OK". Where you disagree, overwrite it.

---

## 0. What I Verified in the Codebase

So decisions are grounded in actual state, not stale docs. I read routes, services, and UI directories directly.

### Billing module — actual (`modules/billing/`)

| Component | Location | State |
|-----------|----------|-------|
| Account info | `api/account.route.ts` | ✅ real |
| Top-up (simulated) | `api/topup.route.ts` | ⚠️ **returns HTTP 410 in production** — directs to `/api/payments/topup`. This is a dev-only simulated credit, not the real money path. |
| Subscriptions | `api/subscriptions.route.ts` | ✅ real |
| Invoices (list/detail/PDF) | `api/invoices.route.ts` | ✅ real |
| Usage + costing | `api/usage.route.ts`, `costing.service.ts` | ✅ real |
| Admin adjust / adjustments | `api/admin/adjust.route.ts`, `adjustments.route.ts` | ✅ real |
| Admin invoice / members / subscriptions | `api/admin/*.route.ts` | ✅ real |
| Balance Gate | `balance-gate.service.ts` (+ test) | ✅ real, 4 UCs covered |
| Quota Gate | `quota-gate.service.ts` (+ test) | ✅ real |
| Usage ledger | `usage-ledger.service.ts` (+ test) | ✅ real |
| Billing cycle (auto-invoice) | `billing-cycle.service.ts` (+ test) | ✅ real `BillingCycleService` class |
| Invoice status manager | `invoice-status.service.ts` (+ test) | ✅ real DRAFT→ISSUED→OVERDUE, 14-day grace |
| Billing transaction | `billing-transaction.service.ts` (+ test) | ✅ real |
| Message cost | `message-cost.service.ts` (+ test) | ✅ real |

### Payment module — actual (`modules/payment/`)

| Component | Location | State |
|-----------|----------|-------|
| Real top-up (money path) | `api/topup.route.ts` | ✅ `POST /api/payments/topup` — creates invoice, calls `duitkuService.createPayment()`, returns `paymentUrl` |
| Duitku service | `services/duitku.service.ts` | ✅ real `createPayment()` + signature gen |
| Webhook callback | `api/webhook.route.ts` | ✅ HMAC verify + idempotency |
| Manual confirmation | `api/confirm.route.ts`, `services/confirmation.service.ts` | ✅ real |
| Invoice payment (pay-with-balance / topup-and-pay) | `api/invoice-payment.route.ts` | ✅ real |
| User bank account | `api/user-bank-account.route.ts` | ✅ real |
| Admin bank / gateway / settings / confirmation | `api/admin-*.route.ts` | ✅ real (mounted under `/portal/payments`) |
| Gateway encryption | `services/gateway.service.ts`, `encryption.service.ts` | ✅ real AES |
| Invoice expiration | `services/invoice-expiration.service.ts` | ✅ real |

### Cron / workers — actual (`scripts/` + `lib/queue/`)

| Worker | Location | State |
|--------|----------|-------|
| Billing cron (monthly cycle + invoice status) | `scripts/billing-cron.ts` | ✅ wires `BillingCycleService` + `InvoiceStatusManager` |
| App Hosting hourly billing | `scripts/app-hosting-billing-worker.ts` | ✅ exists |
| WhatsApp monthly billing | `scripts/whatsapp-monthly-billing-worker.ts` | ✅ exists |
| Queue defs | `lib/queue/billing-cron.ts` | ✅ `billing-invoice-status` queue + job |

### Product billing wiring — actual

| Product | Wiring | State |
|---------|--------|-------|
| WhatsApp | `messages.service.ts` imports `BalanceGateService`, checks allowance → overage → balance before Meta call | ✅ real, tested |
| VPN | `modules/vpn/billing/vpn-billing.service.ts` + `vpn-renewal.service.ts`; route debits balance upfront; route mounted in `lib/api.ts` | ✅ real (backend), **no `/console` or `/portal` VPN UI found** |
| App Hosting | PAYG buffer/grace foundation + hourly worker | ⚠️ partial (per FEATURES.md §3.1) |
| Currency lock | `billing-account.service.ts` references "clean account is the only state where currency can be changed" | ✅ logic present |

### UI surfaces — actual

- **Console** `/console/billing`: `page.tsx`, `billing-dashboard.tsx`, `topup/`, `invoices/[id]`, `usage/`, `subscription/`, `alerts/`, `transactions/`, `payment-methods/`, `payments/confirm/` — ✅ rich
- **Portal** `/portal/billing`: tabs for overview, topup, usage, invoices, subscriptions, members, adjustments + `invoices/[id]` — ✅ rich
- **Portal** `/portal/payments`: overview, gateways, bank-accounts, confirmations, settings tabs — ✅ rich

---

## 0.1 Key Findings — Doc vs Codebase Mismatches

These are the reasons consolidation is worth doing. Docs are spread and partly stale.

1. **🔴 MISSING design spec.** `FEATURES.md`, `BILLING-and-PAYMENT.md`, `AGENTS.md`, the use-cases doc, and 3 plan files all link to `docs/superpowers/specs/2026-06-04-billing-payment-balance-foundation-design.md`. **This file does not exist.** Only `2026-06-05-app-hosting-private-repo-mvp-design.md` is in the specs dir. Every "MVP Base Design" reference is a dead link.

2. **🔴 MISSING plan file.** The use-cases doc links `docs/superpowers/plans/2026-06-04-billing-balance-foundation-implementation.md`. **Does not exist.** Only the 3 per-product billing plans (app-hosting, whatsapp, vpn) + app-hosting-mvp epic exist.

3. **🟢 STALE "Known Bug" in FEATURES.md §2.4.** Doc claims Duitku callback HMAC order is wrong (`merchantCode + merchantOrderId + amount`). Codebase `duitku.service.ts:84` already uses the **correct** order (`merchantCode + amount + merchantOrderId`) with a comment confirming it. The bug is fixed; the doc is stale.

4. **🟡 Two top-up routes, confusing.** `modules/billing/api/topup.route.ts` is a **simulated** dev-only credit that returns HTTP 410 in production. The real money path is `modules/payment/api/topup.route.ts`. Docs reference "topup.route" without disambiguating — a reader can't tell which is real.

5. **🟡 BILLING-and-PAYMENT.md status table is stale.** It marks Rating Engine, Metering Ingestion, Auto-Invoicing, Subscription Plan UI as "🚧 Pending", but `billing-cycle.service.ts`, `invoice-status.service.ts`, `scripts/billing-cron.ts`, and per-product workers now exist. Status needs re-verification.

6. **🟡 VPN has no UI.** VPN billing backend is real and mounted, but there's no `/console/vpn` or `/portal/vpn` surface. FEATURES.md §3.3 marks VPN UI "❌ Not started" — consistent, but the billing side is further along than the table implies.

7. **🟡 Docs are scattered across 6+ locations.** Billing knowledge lives in: `FEATURES.md` §2.2/2.3/2.4, `BILLING-and-PAYMENT.md` (36KB), `_features/billing-payment-balance-foundation-use-cases.md` (15KB), `integrations/duitku/` (4 files), 3 plan files, 3 prompt files, `PACKAGE.md` (pricing). No single `_mvp/billing/` entry point exists.

---

## 0.2 Proposed `_mvp/billing/` Structure (mirror App Hosting + WhatsApp)

```
_mvp/billing/
  README.md            # epic summary: Goal, Scope In/Out, Actors, Component Mapping, Workstreams, Dependency Order
  qna.md               # this decision sheet
  tasks-map.md         # workstream → use cases → surface → PGREEN task → prompt
  use-case/
    01-topup-duitku-va-qris.md
    02-topup-manual-transfer-unique-code.md
    03-admin-configure-gateway.md
    04-admin-manage-manual-confirmation.md
    05-pay-invoice-balance-or-topup.md
    06-balance-gate-enforcement.md
    07-app-hosting-payg-charge-grace.md
    08-whatsapp-base-allowance-overage.md
    09-vpn-monthly-charge.md
    10-monthly-invoice-finalization.md
    11-currency-selection-lock.md
    12-budget-alerts-low-balance.md
    13-customer-transaction-history-ui.md
    14-admin-billing-adjustments.md
```

Each use-case file uses the fixed App Hosting section format: Entry Point, Actor, Goal, Preconditions, Happy Path, Edge/Error Paths, Backend/API Surfaces, Console Surface, Portal Surface, Done Criteria, Client-Facing Notes — plus a **Codebase Status** line per use case (✅ done / ⚠️ partial / ❌ missing with file refs).

---

## 1. Consolidation Approach

The billing knowledge is spread across 6+ files. What should `_mvp/billing/` actually be?

- **Option A — Single source of truth + back-reference existing docs** `→ Recommended`
  `_mvp/billing/` becomes the canonical MVP entry point (README + use-cases + tasks-map). Keep `BILLING-and-PAYMENT.md` and `_features/...use-cases.md` as deep-dive references, but fix their stale parts and link them from the new README. Lowest risk, no content loss.
- **Option B — Full migration, deprecate old docs**
  Move all billing content into `_mvp/billing/`, leave redirect stubs in old locations. Cleaner long-term, but higher churn and risk of breaking inbound links.
- **Option C — Index-only**
  `_mvp/billing/` is just a README linking to existing scattered docs. Smallest effort, but doesn't fix the scatter problem or stale content.

**Answer:**

## 2. Missing Design Spec & Plan Files

Two referenced files don't exist (the design spec + the foundation implementation plan). Every "MVP Base Design" link is dead.

- **Option A — Recreate the design spec from BILLING-and-PAYMENT.md + use-cases doc** `→ Recommended`
  Write `docs/superpowers/specs/2026-06-04-billing-payment-balance-foundation-design.md` by consolidating what already exists in the two big docs. Fixes all dead links.
- **Option B — Repoint all links to existing docs**
  Don't recreate; instead update FEATURES.md / AGENTS.md / use-cases to point at `BILLING-and-PAYMENT.md`. Faster, no new spec authored.
- **Option C — Leave as-is for now, track as a known gap**
  Note the dead links in the README, defer the fix.

**Answer:**

## 3. Use-Case Granularity

Proposed 14 use-case files (see §0.2). Covers top-up (both methods), gateway/manual admin, balance gate, per-product charging (App Hosting/WhatsApp/VPN), invoice finalization, currency lock, alerts, history UI, adjustments.

- **Option A — Adopt the 14 use-case set as-is** `→ Recommended`
  Full coverage mapped to the 4 components, each with a Codebase Status line.
- **Option B — Trim to core billing only (top-up, balance gate, invoice, history) — defer per-product UCs**
  Per-product charging already has its own plan files; reference them instead of duplicating. ~8 use cases.
- **Option C — Expand (split admin gateway/bank/settings, add refund/dunning placeholders)**
  More files, but pulls in MVP non-goals.

**Answer:**

## 4. Stale Content — Fix Now or Track?

Found: stale "Known Bug" (Duitku HMAC already fixed), stale status table in BILLING-and-PAYMENT.md (Rating/Auto-Invoice marked Pending but implemented), confusing dual top-up routes.

- **Option A — Fix stale claims as part of this consolidation** `→ Recommended`
  Correct the HMAC bug note, re-verify and update the status table, document the two top-up routes clearly. Docs match reality after this.
- **Option B — Only document in new `_mvp/billing/`, leave old docs untouched**
  Less edit surface, but old docs stay misleading.
- **Option C — Track each as a separate task, don't touch docs yet**
  Defer; just list them in the README findings section.

**Answer:**

## 5. Verification Depth Before Writing Use Cases

How deeply should I confirm each ✅ before writing the use-case files?

- **Option A — Read each route/service/UI per use case, mark real status with file+line refs** `→ Recommended`
  Slower but produces a trustworthy Codebase Status per use case. Matches the "act skeptical" rule in prompt.md.
- **Option B — Trust this qna's §0 verification, write use cases from it**
  Faster; §0 already covers the main surfaces.
- **Option C — Spot-check only the risky ones (top-up money path, balance gate, finalization)**
  Middle ground.

**Answer:**

## 6. Task Files (PGREEN-###)

WhatsApp MVP used PGREEN-075..080. App Hosting used PGREEN-063..074. Should billing MVP generate execution task files too?

- **Option A — Generate README + use-cases + tasks-map now; defer PGREEN task files until scope is approved** `→ Recommended`
  Plan first, don't create execution units until you approve the workstream breakdown.
- **Option B — Generate everything including PGREEN tasks + prompts in one pass**
  Full mirror of WhatsApp/App Hosting package immediately.
- **Option C — Docs only, no tasks-map or PGREEN**
  Lightest; just the consolidated reference.

**Answer:**

## 7. MVP Scope Boundary (confirm non-goals)

Proposed out-of-scope for billing MVP (from use-cases doc non-goals):
mixed-currency wallet, real-time FX, postpaid invoices, dunning/collection, WhatsApp grace, VPN grace, refund automation, tax engine, credit notes beyond admin adjustment.

- **Option A — Confirm all listed items stay out of MVP** `→ Recommended`
- **Option B — Pull one or more back into scope** (specify which)

**Answer:**

---

## Decision Summary (fill after answering)

| # | Topic | Decision |
|---|-------|----------|
| 1 | Consolidation approach | |
| 2 | Missing spec/plan files | |
| 3 | Use-case granularity | |
| 4 | Stale content fix | |
| 5 | Verification depth | |
| 6 | Task files | |
| 7 | Scope boundary | |

> **Status: ⏳ Awaiting answers.**
