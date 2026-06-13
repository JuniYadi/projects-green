-- AlterTable: add per-currency low-balance warning threshold to Currency.
-- Each currency owns its own warn rule (expressed in that currency's unit),
-- replacing the hardcoded IDR-only MINIMUM_BALANCE_WARN constant.
ALTER TABLE "Currency"
  ADD COLUMN "minBalanceWarn" DECIMAL(18,2) NOT NULL DEFAULT 0;

-- Backfill sensible warn thresholds for the currently seeded currencies.
-- USD base = 10; other currencies scale roughly by their rate-per-base.
UPDATE "Currency" SET "minBalanceWarn" = 10 WHERE "code" = 'USD';
UPDATE "Currency" SET "minBalanceWarn" = 10000 WHERE "code" = 'IDR';
UPDATE "Currency" SET "minBalanceWarn" = 15 WHERE "code" = 'SGD';
UPDATE "Currency" SET "minBalanceWarn" = 45 WHERE "code" = 'MYR';
UPDATE "Currency" SET "minBalanceWarn" = 350 WHERE "code" = 'THB';
UPDATE "Currency" SET "minBalanceWarn" = 15000 WHERE "code" = 'VND';
UPDATE "Currency" SET "minBalanceWarn" = 550 WHERE "code" = 'PHP';
