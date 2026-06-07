# Customer Transaction History UI

## Codebase Status

✅ **Page exists.** `/console/billing/transactions/page.tsx`. Verify it uses user-friendly +/− language (not raw CREDIT/DEBIT) per the UI language rules.

## Entry Point

`/console/billing/transactions`

## Actor

Customer / User

## Goal

Let the customer see balance-in and charges in plain language, without exposing internal billing terms.

## Preconditions

- Billing account exists with ledger/adjustment history.

## Happy Path

1. Customer opens `/console/billing/transactions`.
2. Sees a list of balance movements with user-friendly labels, symbol, and color.

## UI Language Rules

| Internal event | User label | Symbol | Color |
|----------------|-----------|--------|-------|
| Top-up credit | Top-up successful / Saldo masuk | `+` | Green |
| App Hosting PAYG debit | App Hosting usage charge | `−` | Red |
| Monthly package debit | Monthly package payment | `−` | Red |
| WhatsApp overage debit | WhatsApp overage charge | `−` | Red |
| VPN debit | VPN monthly payment | `−` | Red |
| Credit adjustment | Balance adjustment added | `+` | Green |
| Debit adjustment | Balance adjustment deducted | `−` | Red |

## Do NOT Show to Normal Users

- `CREDIT` / `DEBIT` raw terms
- raw idempotency key
- raw balanceBefore / balanceAfter
- raw internal invoice state names

(Admin audit screens may show raw technical fields in detail drawers.)

## Edge / Error Paths

- **Empty history:** friendly empty state.
- **Unknown event type:** map to a safe generic label, never raw enum.

## Backend / API Surfaces

- `modules/payment/api/topup.route.ts` — `createPaymentHistoryRoutes()` serves `/payments/history`.
- `modules/billing/user-labels.ts` — user-facing label mapping (+ test).

## Console Surface

- `/console/billing/transactions`.

## Portal Surface

- Admin audit view may expose raw fields.

## Done Criteria

- All movements show friendly label + `+`/`−` + color; no raw internal terms leak to users.

## Client-Facing Notes

This is the customer's plain-language money trail. Keep it simple and reassuring.
