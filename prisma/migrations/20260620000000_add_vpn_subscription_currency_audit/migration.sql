-- AlterTable
ALTER TABLE "VpnSubscription" ADD COLUMN "originalPrice" DECIMAL(12,2),
ADD COLUMN "originalCurrency" TEXT,
ADD COLUMN "exchangeRate" DECIMAL(18,6);

-- Backfill existing subscriptions: original = locked (same currency, no conversion)
UPDATE "VpnSubscription"
SET
  "originalPrice" = "priceLocked",
  "originalCurrency" = "currency",
  "exchangeRate" = 1
WHERE "originalPrice" IS NULL;
