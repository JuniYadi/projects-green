# Budget Alerts / Low-balance Warning

## Codebase Status

✅ **Alerts UI exists.** `/console/billing/alerts` page + `billing-alerts-form.tsx` (+ test). Balance Gate emits warning (UC-03); notification delivery (email/Slack) is the wiring to verify.

## Entry Point

`/console/billing/alerts` + Balance Gate warning path.

## Actor

Customer / User (configures thresholds), System Worker (emits alerts)

## Goal

Warn the customer before balance runs out so service isn't unexpectedly stopped.

## Preconditions

- Billing account exists.
- Customer set alert thresholds + preferences (or defaults).

## Happy Path

1. Customer opens `/console/billing/alerts`, sets thresholds + notification preferences.
2. Balance Gate computes `isWarning = newBalance > 0 && newBalance <= threshold` after a charge.
3. On warning → log + (target) emit notification; service continues.
4. App Hosting PAYG: when remaining hours ≤ 24, low-balance email + budget alert (UC-07).

## Edge / Error Paths

- **Threshold = 0:** warnings effectively disabled; document behavior.
- **Notification channel unconfigured:** warning still logged; no delivery.
- **Repeated warnings:** debounce/throttle to avoid spam (verify).

## Backend / API Surfaces

- `modules/billing/balance-gate.service.ts` — `BalanceWarningThresholdError`, `warningThreshold` (default 1.00).
- Alerts persistence (verify route).

## Console Surface

- `/console/billing/alerts` — thresholds + preferences form.
- Budget alert banner on billing dashboard.

## Portal Surface

- None directly.

## Done Criteria

- Threshold configurable; warning emitted below threshold without blocking service; PAYG ≤24h warning works.

## Client-Facing Notes

Warning is informational; service keeps running. Stop only happens when balance can't cover a charge (UC-06).
