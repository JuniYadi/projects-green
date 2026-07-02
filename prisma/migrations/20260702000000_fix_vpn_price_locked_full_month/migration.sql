-- Recompute priceLocked as the full monthly amount from the original package
-- price and the purchase-time exchange rate. This preserves grandfathering
-- because originalPrice is the package price at subscription creation time.
UPDATE "VpnSubscription"
SET "priceLocked" = "originalPrice" * COALESCE("exchangeRate", 1)
WHERE "originalPrice" IS NOT NULL;
