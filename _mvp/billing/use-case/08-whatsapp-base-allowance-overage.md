# WhatsApp Base + Allowance + Overage

## Codebase Status

✅ **Real.** `messages.service.ts` checks allowance → charges overage → checks balance before Meta call; `scripts/whatsapp-monthly-billing-worker.ts` charges base + resets allowance. Tested.

## Entry Point

WhatsApp send (`/console/whatsapp/messages`) + monthly worker.

## Actor

Customer / User (send), System Worker (monthly base + reset)

## Goal

Charge a monthly base price (upfront) that includes a message allowance, then charge per-message overage from balance once allowance is exhausted. No grace.

## Preconditions

- WhatsApp service/device active or being activated.
- Monthly base price + allowance (e.g. 1000 messages) configured.

## Happy Path — monthly base

1. Monthly worker (or activation) charges base price upfront → debit balance → ledger debit → monthly invoice line.
2. Allowance quota reset.

## Happy Path — send

1. Customer sends a message.
2. If allowance remains → decrement allowance, message proceeds (no balance charge).
3. If allowance exhausted → compute overage/message → check balance → debit immediately → ledger + invoice line → message proceeds.
4. If balance insufficient → message rejected, no Meta send, top-up prompt.

## Important Rule

WhatsApp has **no grace period**. If allowance is exhausted and balance can't cover overage, the message must not be sent.

## Edge / Error Paths

- **Base charge fails:** activation/renewal fails (MVP: no unpaid base activation).
- **Daily limit hit:** `dailyLimitMessage` enforced per device per day.
- **Meta API fails after overage charged:** do not restore balance (per test); allowance not restored for overage.

## Backend / API Surfaces

- `modules/whatsapp/messages/messages.service.ts` — allowance/overage + balance gate.
- `modules/billing/balance-gate.service.ts`, `quota-gate.service.ts`, `message-cost.service.ts`.
- `scripts/whatsapp-monthly-billing-worker.ts` — base + reset.

## Console Surface

- `/console/whatsapp/messages` — send; quota/balance view (WhatsApp MVP UC-11).

## Portal Surface

- `/portal/whatsapp/devices` — admin device quota config.

## Done Criteria

- Base charged upfront; allowance enforced; overage charged from balance; insufficient blocks send; no grace.

## Client-Facing Notes

Show remaining allowance + balance. After allowance, each message costs overage from balance.
