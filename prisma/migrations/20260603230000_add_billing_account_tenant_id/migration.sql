-- Migration: add_billing_account_tenant_id
-- Adds tenantId to BillingAccount, renames Subscription.organizationId column

-- AlterTable: Add tenantId to BillingAccount (nullable, optional)
ALTER TABLE "BillingAccount" ADD COLUMN "tenantId" TEXT;

-- AlterTable: Rename organizationId to tenantId in Subscription to match @map
-- Drop dependent index and constraint first, rename column, then recreate
DROP INDEX IF EXISTS "Subscription_organizationId_status_idx";
ALTER TABLE "Subscription" DROP CONSTRAINT "Subscription_organizationId_packageId_planId_key";
ALTER TABLE "Subscription" RENAME COLUMN "organizationId" TO "tenantId";
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_tenantId_packageId_planId_key" UNIQUE ("tenantId", "packageId", "planId");
CREATE INDEX "Subscription_tenantId_status_idx" ON "Subscription"("tenantId", "status");
