# Balance Gate Enforcement

## Codebase Status

✅ **Real.** `modules/billing/balance-gate.service.ts` + test cover all 4 use cases; integrated into WhatsApp `messages.service.ts`; route returns HTTP 402.

## Entry Point

Service layer — invoked before any paid action runs.

## Actor

System Worker / API (on behalf of customer)

## Goal

Enforce the four balance rules: no free usage, deduct when sufficient, warn before stop, stop when exhausted.

## Happy Path (the 4 rules)

- **UC-01 No balance → reject:** `checkAndCharge()` throws `InsufficientBalanceError` when balance ≤ 0 or no account → HTTP 402.
- **UC-02 Sufficient → deduct:** updates balance atomically in `$transaction`, writes `BillingAdjustment` (DEBIT) with balanceBefore/After, proceeds.
- **UC-03 Warning → warn:** if post-charge balance ≤ `warningThreshold` (default 1.00), throws `BalanceWarningThresholdError`, logged + notification TODO; **service continues**.
- **UC-04 Exhausted → stop:** when `newBalance < 0`, throws `InsufficientBalanceError` with `remaining`/`required` → HTTP 402.

## Edge / Error Paths

- **No billing account:** treated as zero balance → reject.
- **Concurrent charges:** atomic `$transaction` prevents oversell.
- **Warning vs stop:** warning never blocks; only insufficient blocks.

## HTTP Response Matrix

| Scenario | Status | Error code |
|----------|--------|-----------|
| No balance / account missing | 402 | `INSUFFICIENT_BALANCE` |
| Balance OK | 200 | — |
| Low balance warning | 200 | — (warning logged) |
| Insufficient for charge | 402 | `INSUFFICIENT_BALANCE` |
| Quota exceeded | 422 | `INSUFFICIENT_QUOTA` |

## Backend / API Surfaces

- `modules/billing/balance-gate.service.ts` — `checkAndCharge()`.
- `modules/billing/quota-gate.service.ts` — quota check.
- `modules/whatsapp/messages/messages.service.ts` — integration example.

## Console Surface

- Indirect: 402 surfaces as "top up" prompt; low-balance shows budget alert (UC-12).

## Portal Surface

- None directly.

## Done Criteria

- All 4 rules enforced with audit trail; tests green.

## Client-Facing Notes

Never show raw `DEBIT`/balanceBefore/After to users. Show "Insufficient balance — top up to continue".
