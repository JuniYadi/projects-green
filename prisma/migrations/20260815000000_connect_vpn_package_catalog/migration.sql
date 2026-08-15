-- Connect VPN package composition to the global VPN catalog.
--
-- Invariant:
--   * ServicePackage(code = 'VPN') is the only VPN catalog parent.
--   * Every active VpnPackage points to exactly one ServicePlan under that
--     parent; the ServicePlan owns all recurring ServicePricing rows.
--   * VpnPackage.price/currency are legacy compatibility fields and are not
--     authoritative for new writes.
--   * ServiceSubscription, VpnSubscription, BillingOrder, and fulfillment
--     references keep their existing IDs and locked prices.
--
-- A malformed legacy package is quarantined (made inactive) instead of being
-- rewired. This preserves historical subscription and fulfillment references
-- while making the record visible to an administrator for remediation.

INSERT INTO "Package" (
    "id", "code", "name", "description", "isActive", "createdAt", "updatedAt"
)
VALUES (
    'billing-vpn-package', 'VPN', 'VPN', 'VPN service catalog package', true,
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "Region" (
    "id", "code", "name", "country", "flag", "isActive", "createdAt", "updatedAt"
)
VALUES (
    'billing-region-indonesia', 'INDONESIA', 'Indonesia', 'Indonesia', NULL, true,
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
)
ON CONFLICT ("code") DO NOTHING;

-- YEARLY is a legacy spelling. Reuse the existing row when an equivalent
-- ANNUAL offer already exists; otherwise normalize it in place. Conflicts are
-- deactivated by identity so historical pricing IDs remain stable.
UPDATE "Pricing" legacy
SET "billingPeriod" = 'ANNUAL'
WHERE legacy."type" = 'BUNDLE'
  AND legacy."billingMode" = 'PACKAGE'
  AND legacy."billingPeriod" = 'YEARLY'
  AND EXISTS (
    SELECT 1
    FROM "ServicePlan" plan
    JOIN "Package" package ON package."id" = plan."packageId"
    WHERE plan."id" = legacy."planId"
      AND package."code" = 'VPN'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM "Pricing" annual
    WHERE annual."planId" = legacy."planId"
      AND annual."regionId" = legacy."regionId"
      AND annual."type" = legacy."type"
      AND annual."billingMode" = legacy."billingMode"
      AND annual."billingPeriod" = 'ANNUAL'
      AND annual."currency" = legacy."currency"
      AND annual."effectiveFrom" = legacy."effectiveFrom"
  );

UPDATE "Pricing" legacy
SET "isActive" = false
WHERE legacy."type" = 'BUNDLE'
  AND legacy."billingMode" = 'PACKAGE'
  AND legacy."billingPeriod" = 'YEARLY'
  AND EXISTS (
    SELECT 1
    FROM "ServicePlan" plan
    JOIN "Package" package ON package."id" = plan."packageId"
    WHERE plan."id" = legacy."planId"
      AND package."code" = 'VPN'
  )
  AND EXISTS (
    SELECT 1
    FROM "Pricing" annual
    WHERE annual."planId" = legacy."planId"
      AND annual."regionId" = legacy."regionId"
      AND annual."type" = legacy."type"
      AND annual."billingMode" = legacy."billingMode"
      AND annual."billingPeriod" = 'ANNUAL'
      AND annual."currency" = legacy."currency"
      AND annual."effectiveFrom" = legacy."effectiveFrom"
  );

-- CUSTOM VPN offers cannot be consumed by the recurring VPN catalog. Keep
-- their rows for audit/history but make them unavailable for new purchases.
UPDATE "Pricing" pricing
SET "isActive" = false
WHERE pricing."type" = 'BUNDLE'
  AND pricing."billingMode" = 'PACKAGE'
  AND pricing."billingPeriod" = 'CUSTOM'
  AND EXISTS (
    SELECT 1
    FROM "ServicePlan" plan
    JOIN "Package" package ON package."id" = plan."packageId"
    WHERE plan."id" = pricing."planId"
      AND package."code" = 'VPN'
  );

-- Reconcile a legacy package price only when no catalog offer exists at all.
-- Existing offers remain authoritative, including their effective windows.
INSERT INTO "Pricing" (
    "id", "planId", "regionId", "type", "billingMode", "billingPeriod",
    "currency", "periodPrice", "effectiveFrom", "effectiveTo", "chargeUnit",
    "basePriceIdr", "monthlyCapIdr", "unitRateCpu", "unitRateMem",
    "unitRateMessage", "isActive", "createdAt", "updatedAt"
)
SELECT
    'billing-vpn-pricing-legacy-' || vp."id",
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
WHERE vp."price" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "Pricing" p
    WHERE p."planId" = vp."servicePlanId"
      AND p."type" = 'BUNDLE'
      AND p."billingMode" = 'PACKAGE'
      AND p."periodPrice" IS NOT NULL
  )
ON CONFLICT ("id") DO NOTHING;

-- Quarantine active packages whose linked plan belongs to another product.
-- Do not update plan, pricing, subscription, or fulfillment IDs: those rows
-- may be referenced by historical orders and locked-price subscriptions.
DO $$
DECLARE
  malformed RECORD;
BEGIN
  FOR malformed IN
    SELECT vp."id", vp."servicePlanId", package."code" AS "packageCode"
    FROM "VpnPackage" vp
    JOIN "ServicePlan" plan ON plan."id" = vp."servicePlanId"
    JOIN "Package" package ON package."id" = plan."packageId"
    WHERE vp."isActive" = true
      AND package."code" <> 'VPN'
  LOOP
    UPDATE "VpnPackage"
    SET "isActive" = false, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = malformed."id";

    RAISE NOTICE
      'TASK2_QUARANTINED_MALFORMED_VPN_PACKAGE id=% servicePlanId=% packageCode=% reason=preserve historical references',
      malformed."id", malformed."servicePlanId", malformed."packageCode";
  END LOOP;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "VpnPackage" vp
    JOIN "ServicePlan" plan ON plan."id" = vp."servicePlanId"
    JOIN "Package" package ON package."id" = plan."packageId"
    WHERE vp."isActive" = true
      AND package."code" <> 'VPN'
  ) THEN
    RAISE EXCEPTION
      'VPN package catalog invariant failed: an active package is linked outside ServicePackage VPN';
  END IF;
END $$;
