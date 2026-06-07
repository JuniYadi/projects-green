# Currency Selection + Lock

## Codebase Status

⚠️ **Logic present, UI unverified.** `modules/billing/billing-account.service.ts` notes "a clean account is the only state where currency can be changed." Onboarding currency UI + lock enforcement to verify during execution.

## Entry Point

Onboarding / billing account creation.

## Actor

Customer / User (onboarding), Billing Admin (exceptions)

## Goal

Let the customer pick a billing currency safely, then lock it once financial activity exists to prevent mixed-currency accounting.

## Preconditions

- Organization onboarding or billing account creation.

## Happy Path

1. During onboarding, customer sees billing currency option.
2. Default is **IDR**; customer may choose IDR or USD.
3. System creates billing account with selected currency.
4. Currency remains editable only while the account is **clean**.
5. Once any financial record exists, currency is locked.

## Clean Account Definition

Clean only if ALL are true:
- balance is zero,
- no invoice exists,
- no payment confirmation exists,
- no ledger/adjustment exists,
- no subscription charge exists,
- no top-up/payment record exists.

## Edge / Error Paths

- **Attempt to change after activity:** rejected; currency locked.
- **Admin override:** any migration is a controlled manual operation outside MVP.
- **Duitku is IDR:** USD accounts can't use Duitku top-up; document the constraint.

## Backend / API Surfaces

- `modules/billing/billing-account.service.ts` — clean-account check + currency set.

## Console Surface

- Onboarding currency selector (verify); billing settings shows locked currency read-only.

## Portal Surface

- Admin view of account currency + lock state.

## Done Criteria

- Currency settable only while clean; locked after first financial record; default IDR.

## Client-Facing Notes

Explain currency can't change after the first transaction. Default IDR.
