-- Data migration: consolidate to BillingAccount.currency as the single source
-- of truth. Existing accounts were displayed using `preferredCurrency`, so set
-- `currency` to match what users already saw (decision #2 in CURRENCY-FIX-STRATEGY).
-- `preferredCurrency` is a BillingCurrency enum (USD | IDR); `currency` is text.
UPDATE "BillingAccount"
SET "currency" = "preferredCurrency"::text
WHERE "currency" <> "preferredCurrency"::text;
