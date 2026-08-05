-- Unified billing catalog foundation.
-- Additive only: legacy pricing and VPN columns remain for compatibility.

-- 1. Add enums and nullable/defaulted columns.
ALTER TYPE "BillingPeriod" ADD VALUE IF NOT EXISTS 'QUARTERLY';
ALTER TYPE "BillingPeriod" ADD VALUE IF NOT EXISTS 'SEMI_ANNUAL';
ALTER TYPE "BillingPeriod" ADD VALUE IF NOT EXISTS 'ANNUAL';

CREATE TYPE "BillingChargeUnit" AS ENUM ('SUBSCRIPTION', 'DEVICE');
CREATE TYPE "BillingOrderStatus" AS ENUM ('PENDING', 'CHARGED', 'FULFILLED', 'FAILED', 'CANCELLED');

DROP INDEX IF EXISTS "Pricing_planId_regionId_type_billingMode_key";
ALTER TABLE "Pricing" DROP CONSTRAINT IF EXISTS "Pricing_planId_regionId_type_billingMode_key";
ALTER TABLE "Pricing"
    ADD COLUMN "billingPeriod" "BillingPeriod",
    ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'IDR',
    ADD COLUMN "periodPrice" DECIMAL(18,2),
    ADD COLUMN "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN "effectiveTo" TIMESTAMP(3),
    ADD COLUMN "chargeUnit" "BillingChargeUnit" NOT NULL DEFAULT 'SUBSCRIPTION';

ALTER TABLE "Subscription"
    ADD COLUMN "billingPeriod" "BillingPeriod",
    ADD COLUMN "priceLocked" DECIMAL(18,2),
    ADD COLUMN "currency" TEXT,
    ADD COLUMN "quantity" DECIMAL(18,6);

ALTER TABLE "VpnPackage"
    ADD COLUMN "servicePlanId" TEXT,
    ALTER COLUMN "price" DROP NOT NULL,
    ALTER COLUMN "currency" DROP NOT NULL;

ALTER TABLE "VpnSubscription"
    ADD COLUMN "serviceSubscriptionId" TEXT;

-- 2. Preserve historical effective starts and snapshot recurring prices.
UPDATE "Pricing"
SET "effectiveFrom" = "createdAt",
    "currency" = COALESCE("currency", 'IDR'),
    "chargeUnit" = 'SUBSCRIPTION'
WHERE "effectiveFrom" IS NOT NULL;

UPDATE "Pricing"
SET "billingPeriod" = 'MONTHLY',
    "periodPrice" = "basePriceIdr"
WHERE "type" = 'BUNDLE'
  AND "billingMode" = 'PACKAGE'
  AND "billingPeriod" IS NULL;

UPDATE "Pricing"
SET "isActive" = false
WHERE "type" = 'BUNDLE'
  AND "billingMode" = 'PACKAGE'
  AND "periodPrice" <= 0;

-- 3. Backfill immutable subscription snapshots from their selected pricing row.
UPDATE "Subscription" s
SET "priceLocked" = COALESCE(p."periodPrice", p."basePriceIdr"),
    "currency" = COALESCE(p."currency", 'IDR'),
    "billingPeriod" = COALESCE(p."billingPeriod", 'MONTHLY'),
    "quantity" = 1
FROM "Pricing" p
WHERE p."id" = s."pricingId";

-- 4. Give every legacy VPN package a deterministic common plan identity.
INSERT INTO "Package" ("id", "code", "name", "description", "isActive", "createdAt", "updatedAt")
VALUES ('billing-vpn-package', 'VPN', 'VPN', 'VPN service catalog package', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "Region" ("id", "code", "name", "country", "flag", "isActive", "createdAt", "updatedAt")
VALUES ('billing-region-indonesia', 'INDONESIA', 'Indonesia', 'Indonesia', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "ServicePlan" ("id", "packageId", "code", "name", "resources", "isActive", "createdAt", "updatedAt")
SELECT 'billing-vpn-plan-' || vp."id",
       (SELECT id FROM "Package" WHERE code = 'VPN'),
       'VPN_LEGACY_' || vp."id",
       vp."name",
       '{}'::jsonb,
       vp."isActive",
       vp."createdAt",
       vp."updatedAt"
FROM "VpnPackage" vp
WHERE vp."servicePlanId" IS NULL;

UPDATE "VpnPackage" vp
SET "servicePlanId" = 'billing-vpn-plan-' || vp."id"
WHERE vp."servicePlanId" IS NULL
  AND EXISTS (
    SELECT 1 FROM "ServicePlan" sp
    WHERE sp."id" = 'billing-vpn-plan-' || vp."id"
  );

-- Null legacy prices are reported and remain unavailable for new recurring orders.
DO $$
DECLARE
  unmapped RECORD;
BEGIN
  FOR unmapped IN
    SELECT "id", "name" FROM "VpnPackage" WHERE "price" IS NULL
  LOOP
    RAISE NOTICE 'TASK1_UNMAPPED_VPN_PACKAGE id=% name=% reason=missing legacy price; legacy renewal path retained', unmapped."id", unmapped."name";
  END LOOP;
END $$;

INSERT INTO "Pricing" (
    "id", "planId", "regionId", "type", "billingMode", "billingPeriod",
    "currency", "periodPrice", "effectiveFrom", "effectiveTo", "chargeUnit",
    "basePriceIdr", "monthlyCapIdr", "unitRateCpu", "unitRateMem", "unitRateMessage",
    "isActive", "createdAt", "updatedAt"
)
SELECT 'billing-vpn-pricing-' || vp."id",
       vp."servicePlanId",
       (SELECT id FROM "Region" WHERE code = 'INDONESIA'),
       'BUNDLE',
       'PACKAGE',
       'MONTHLY',
       COALESCE(vp."currency", 'IDR'),
       vp."price",
       vp."createdAt",
       NULL,
       'SUBSCRIPTION',
       vp."price",
       NULL,
       NULL,
       NULL,
       NULL,
       (vp."price" > 0),
       vp."createdAt",
       vp."updatedAt"
FROM "VpnPackage" vp
WHERE vp."servicePlanId" IS NOT NULL
  AND vp."price" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "Pricing" p WHERE p."id" = 'billing-vpn-pricing-' || vp."id"
  );

-- 5. Bridge active VPN fulfillment rows to immutable service subscriptions.
-- Canonicalize one VPN row per shared business key so pre-existing service
-- subscriptions are reused instead of colliding on the composite unique key.
CREATE TEMP TABLE "_task1_vpn_bridge" ON COMMIT DROP AS
SELECT DISTINCT ON (v."organizationId", vp."servicePlanId")
       v."id" AS "vpnSubscriptionId",
       v."organizationId",
       vp."servicePlanId",
       'billing-vpn-pricing-' || vp."id" AS "pricingId",
       v."priceLocked",
       COALESCE(v."currency", 'IDR') AS "currency",
       v."currentPeriodStart",
       v."currentPeriodEnd",
       v."createdAt",
       v."updatedAt",
       NULL::TEXT AS "serviceSubscriptionId"
FROM "VpnSubscription" v
JOIN "VpnPackage" vp ON vp."id" = v."packageId"
WHERE v."status" = 'ACTIVE'
  AND v."serviceSubscriptionId" IS NULL
  AND vp."servicePlanId" IS NOT NULL
  AND vp."price" IS NOT NULL
ORDER BY v."organizationId", vp."servicePlanId", v."createdAt", v."id";

UPDATE "_task1_vpn_bridge" b
SET "serviceSubscriptionId" = s."id"
FROM "Subscription" s
WHERE s."tenantId" = b."organizationId"
  AND s."packageId" = (SELECT id FROM "Package" WHERE code = 'VPN')
  AND s."planId" = b."servicePlanId";

UPDATE "Subscription" s
SET "pricingId" = b."pricingId",
    "type" = 'BUNDLE',
    "billingMode" = 'PACKAGE',
    "billingPeriod" = 'MONTHLY',
    "priceLocked" = b."priceLocked",
    "currency" = b."currency",
    "quantity" = 1,
    "status" = 'ACTIVE',
    "currentPeriodStart" = b."currentPeriodStart",
    "currentPeriodEnd" = b."currentPeriodEnd",
    "updatedAt" = CURRENT_TIMESTAMP
FROM "_task1_vpn_bridge" b
WHERE b."serviceSubscriptionId" = s."id";

INSERT INTO "Subscription" (
    "id", "tenantId", "packageId", "planId", "pricingId", "type", "billingMode",
    "billingPeriod", "priceLocked", "currency", "quantity", "status",
    "currentPeriodStart", "currentPeriodEnd", "allocatedConfig", "metadata",
    "createdAt", "updatedAt"
)
SELECT 'billing-vpn-subscription-' || b."vpnSubscriptionId",
       b."organizationId",
       (SELECT id FROM "Package" WHERE code = 'VPN'),
       b."servicePlanId",
       b."pricingId",
       'BUNDLE',
       'PACKAGE',
       'MONTHLY',
       b."priceLocked",
       b."currency",
       1,
       'ACTIVE',
       b."currentPeriodStart",
       b."currentPeriodEnd",
       NULL,
       jsonb_build_object('migration', '20260805000000_unified_billing_catalog', 'vpnSubscriptionId', b."vpnSubscriptionId"),
       b."createdAt",
       b."updatedAt"
FROM "_task1_vpn_bridge" b
WHERE b."serviceSubscriptionId" IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "Subscription" s
    WHERE s."tenantId" = b."organizationId"
      AND s."packageId" = (SELECT id FROM "Package" WHERE code = 'VPN')
      AND s."planId" = b."servicePlanId"
  )
  AND NOT EXISTS (
    SELECT 1 FROM "Subscription" s WHERE s."id" = 'billing-vpn-subscription-' || b."vpnSubscriptionId"
  );

UPDATE "_task1_vpn_bridge" b
SET "serviceSubscriptionId" = s."id"
FROM "Subscription" s
WHERE s."tenantId" = b."organizationId"
  AND s."packageId" = (SELECT id FROM "Package" WHERE code = 'VPN')
  AND s."planId" = b."servicePlanId";

-- Duplicate active VPN subscriptions retain the legacy path rather than
-- violating the one-to-one bridge unique index.
DO $$
DECLARE
  duplicate RECORD;
BEGIN
  FOR duplicate IN
    SELECT v."id", v."organizationId", v."packageId", b."vpnSubscriptionId"
    FROM "VpnSubscription" v
    JOIN "VpnPackage" vp ON vp."id" = v."packageId"
    JOIN "_task1_vpn_bridge" b
      ON b."organizationId" = v."organizationId"
     AND b."servicePlanId" = vp."servicePlanId"
    WHERE v."status" = 'ACTIVE'
      AND v."serviceSubscriptionId" IS NULL
      AND v."id" <> b."vpnSubscriptionId"
    ORDER BY v."organizationId", v."packageId", v."id"
  LOOP
    RAISE NOTICE 'TASK1_UNMAPPED_DUPLICATE_VPN_SUBSCRIPTION id=% organizationId=% packageId=% canonicalId=% reason=one-to-one bridge; legacy renewal path retained', duplicate."id", duplicate."organizationId", duplicate."packageId", duplicate."vpnSubscriptionId";
  END LOOP;
END $$;

UPDATE "VpnSubscription" v
SET "serviceSubscriptionId" = s."id"
FROM "_task1_vpn_bridge" b
JOIN "Subscription" s ON s."id" = b."serviceSubscriptionId"
WHERE v."id" = b."vpnSubscriptionId"
  AND v."status" = 'ACTIVE'
  AND v."serviceSubscriptionId" IS NULL;

-- New recurring rows require complete-period fields; PAYG rows require both
-- recurring snapshot fields to remain NULL.
ALTER TABLE "Pricing"
    ADD CONSTRAINT "Pricing_recurring_fields_check"
    CHECK (
      ("type" = 'BUNDLE' AND "billingMode" = 'PACKAGE'
       AND "billingPeriod" IS NOT NULL AND "periodPrice" IS NOT NULL)
      OR
      (("type" <> 'BUNDLE' OR "billingMode" <> 'PACKAGE')
       AND "billingPeriod" IS NULL AND "periodPrice" IS NULL)
    );
ALTER TABLE "Pricing"
    ADD CONSTRAINT "Pricing_effective_window_check"
    CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom");
ALTER TABLE "Pricing"
    ADD CONSTRAINT "Pricing_period_price_nonnegative_check"
    CHECK ("periodPrice" IS NULL OR "periodPrice" >= 0);

ALTER TABLE "Subscription"
    ALTER COLUMN "billingPeriod" SET NOT NULL,
    ALTER COLUMN "priceLocked" SET NOT NULL,
    ALTER COLUMN "currency" SET NOT NULL,
    ALTER COLUMN "quantity" SET NOT NULL;
ALTER TABLE "VpnPackage" ALTER COLUMN "servicePlanId" SET NOT NULL;

-- 6. Persist order and line snapshots without replacing invoice/payment primitives.
CREATE TABLE "BillingOrder" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "billingAccountId" TEXT NOT NULL,
    "serviceSubscriptionId" TEXT,
    "billingInvoiceId" TEXT,
    "status" "BillingOrderStatus" NOT NULL DEFAULT 'PENDING',
    "currency" TEXT NOT NULL,
    "subtotalAmount" DECIMAL(18,2) NOT NULL,
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "chargedAt" TIMESTAMP(3),
    "fulfilledAt" TIMESTAMP(3),
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BillingOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BillingOrderLine" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "pricingId" TEXT,
    "packageCode" "ServiceType" NOT NULL,
    "planCode" TEXT NOT NULL,
    "regionCode" TEXT NOT NULL,
    "billingPeriod" "BillingPeriod" NOT NULL,
    "chargeUnit" "BillingChargeUnit" NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "unitPrice" DECIMAL(18,2) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "metadataJson" JSONB,
    CONSTRAINT "BillingOrderLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BillingOrder_idempotencyKey_key" ON "BillingOrder"("idempotencyKey");
CREATE INDEX "BillingOrder_organizationId_createdAt_idx" ON "BillingOrder"("organizationId", "createdAt" DESC);
CREATE INDEX "BillingOrder_billingAccountId_status_idx" ON "BillingOrder"("billingAccountId", "status");
CREATE INDEX "BillingOrder_billingInvoiceId_idx" ON "BillingOrder"("billingInvoiceId");
CREATE INDEX "BillingOrder_serviceSubscriptionId_idx" ON "BillingOrder"("serviceSubscriptionId");
CREATE INDEX "BillingOrderLine_orderId_idx" ON "BillingOrderLine"("orderId");
CREATE INDEX "BillingOrderLine_pricingId_idx" ON "BillingOrderLine"("pricingId");
CREATE UNIQUE INDEX "VpnPackage_servicePlanId_key" ON "VpnPackage"("servicePlanId");
CREATE UNIQUE INDEX "VpnSubscription_serviceSubscriptionId_key" ON "VpnSubscription"("serviceSubscriptionId");
CREATE UNIQUE INDEX "Pricing_payg_identity_key"
    ON "Pricing"("planId", "regionId", "type", "billingMode", "currency")
    WHERE "billingPeriod" IS NULL;
CREATE UNIQUE INDEX "Pricing_planId_regionId_type_billingMode_billingPeriod_currency_effectiveFrom_key"
    ON "Pricing"("planId", "regionId", "type", "billingMode", "billingPeriod", "currency", "effectiveFrom");

ALTER TABLE "BillingOrder" ADD CONSTRAINT "BillingOrder_billingAccountId_fkey"
    FOREIGN KEY ("billingAccountId") REFERENCES "BillingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BillingOrder" ADD CONSTRAINT "BillingOrder_serviceSubscriptionId_fkey"
    FOREIGN KEY ("serviceSubscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BillingOrder" ADD CONSTRAINT "BillingOrder_billingInvoiceId_fkey"
    FOREIGN KEY ("billingInvoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BillingOrderLine" ADD CONSTRAINT "BillingOrderLine_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "BillingOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BillingOrderLine" ADD CONSTRAINT "BillingOrderLine_pricingId_fkey"
    FOREIGN KEY ("pricingId") REFERENCES "Pricing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VpnPackage" ADD CONSTRAINT "VpnPackage_servicePlanId_fkey"
    FOREIGN KEY ("servicePlanId") REFERENCES "ServicePlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VpnSubscription" ADD CONSTRAINT "VpnSubscription_serviceSubscriptionId_fkey"
    FOREIGN KEY ("serviceSubscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
