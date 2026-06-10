-- Migration: add_currency_and_gateway_currency
-- Additive only: new Currency table, supportedCurrencies on PaymentGateway,
-- currency on BankAccount. Safe to apply on a live database.

-- PaymentGateway: list of ISO currency codes the gateway can settle.
ALTER TABLE "PaymentGateway"
  ADD COLUMN IF NOT EXISTS "supportedCurrencies" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- BankAccount: ISO currency code the account receives.
ALTER TABLE "BankAccount"
  ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'IDR';

CREATE INDEX IF NOT EXISTS "BankAccount_currency_isActive_idx"
  ON "BankAccount" ("currency", "isActive");

-- Currency: supported billing currencies + exchange rate against base (USD).
CREATE TABLE IF NOT EXISTS "Currency" (
  "id"          TEXT NOT NULL,
  "code"        TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "symbol"      TEXT NOT NULL,
  "isBase"      BOOLEAN NOT NULL DEFAULT false,
  "ratePerBase" DECIMAL(18,6) NOT NULL DEFAULT 1,
  "minTopup"    DECIMAL(18,2) NOT NULL,
  "maxTopup"    DECIMAL(18,2) NOT NULL,
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "sortOrder"   INTEGER NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Currency_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Currency_code_key" ON "Currency" ("code");
CREATE INDEX IF NOT EXISTS "Currency_isActive_idx" ON "Currency" ("isActive");
