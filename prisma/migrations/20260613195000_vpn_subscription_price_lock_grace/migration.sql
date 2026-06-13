-- AlterTable: add price-lock + grace tracking to VpnSubscription
ALTER TABLE "VpnSubscription"
  ADD COLUMN     "priceLocked" DECIMAL(12,2),
  ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'IDR',
  ADD COLUMN     "renewalFailedAt" TIMESTAMP(3),
  ADD COLUMN     "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false;

-- Backfill priceLocked for any existing subscriptions from their package price.
UPDATE "VpnSubscription" vs
SET "priceLocked" = p."price",
    "currency" = p."currency"
FROM "VpnPackage" p
WHERE vs."packageId" = p."id" AND vs."priceLocked" IS NULL;

-- Any rows still null (orphaned package) default to 0 so the NOT NULL holds.
UPDATE "VpnSubscription" SET "priceLocked" = 0 WHERE "priceLocked" IS NULL;

-- Enforce NOT NULL now that all rows are backfilled.
ALTER TABLE "VpnSubscription" ALTER COLUMN "priceLocked" SET NOT NULL;
