/*
  Warnings:

  - The `status` column on the `Invoice` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `type` on the `DeployEvent` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `lineType` on the `InvoiceLine` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `sourceType` on the `InvoiceLineSource` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "ApplicationDeployEventType" AS ENUM ('QUEUED', 'BUILD_STARTED', 'MANIFEST_PUSHED', 'ARGOCD_SYNC_STARTED', 'ARGOCD_SYNCED', 'DEPLOY_COMPLETED', 'DEPLOY_FAILED', 'ROLLBACK_STARTED', 'ROLLBACK_COMPLETED');

-- CreateEnum
CREATE TYPE "BillingInvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'OPEN', 'PAID', 'OVERDUE', 'CANCELLED', 'VOID', 'UNCOLLECTIBLE');

-- CreateEnum
CREATE TYPE "BillingInvoiceLineType" AS ENUM ('SUBSCRIPTION', 'METERED', 'ADJUSTMENT', 'TAX', 'CREDIT');

-- CreateEnum
CREATE TYPE "BillingInvoiceLineSourceType" AS ENUM ('RATED_USAGE', 'ADJUSTMENT', 'MANUAL');

-- AlterTable
ALTER TABLE "DeployEvent" DROP COLUMN "type",
ADD COLUMN     "type" "ApplicationDeployEventType" NOT NULL;

-- AlterTable
ALTER TABLE "InspectionLog" RENAME CONSTRAINT "InspectionLog_pkey" TO "DetectorInspectionLog_pkey";

-- AlterTable
ALTER TABLE "Invoice" DROP COLUMN "status",
ADD COLUMN     "status" "BillingInvoiceStatus" NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "InvoiceLine" DROP COLUMN "lineType",
ADD COLUMN     "lineType" "BillingInvoiceLineType" NOT NULL;

-- AlterTable
ALTER TABLE "InvoiceLineSource" DROP COLUMN "sourceType",
ADD COLUMN     "sourceType" "BillingInvoiceLineSourceType" NOT NULL;

-- AlterTable
ALTER TABLE "RuntimeMapping" RENAME CONSTRAINT "RuntimeMapping_pkey" TO "DRM_pkey";

-- AlterTable
ALTER TABLE "Subscription" RENAME CONSTRAINT "Subscription_pkey" TO "ServiceSubscription_pkey";

-- AlterTable
ALTER TABLE "SubscriptionVersion" RENAME CONSTRAINT "SubscriptionVersion_pkey" TO "ServiceSubscriptionVersion_pkey";

-- DropEnum
DROP TYPE "DeployEventType";

-- DropEnum
DROP TYPE "InvoiceLineSourceType";

-- DropEnum
DROP TYPE "InvoiceLineType";

-- DropEnum
DROP TYPE "InvoiceStatus";

-- CreateIndex
CREATE INDEX "DeployEvent_type_idx" ON "DeployEvent"("type");

-- CreateIndex
CREATE INDEX "Invoice_billingAccountId_status_idx" ON "Invoice"("billingAccountId", "status");

-- CreateIndex
CREATE INDEX "InvoiceLine_lineType_idx" ON "InvoiceLine"("lineType");

-- CreateIndex
CREATE INDEX "InvoiceLineSource_sourceType_sourceId_idx" ON "InvoiceLineSource"("sourceType", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceLineSource_invoiceLineId_sourceType_sourceId_key" ON "InvoiceLineSource"("invoiceLineId", "sourceType", "sourceId");

-- RenameIndex
ALTER INDEX "InspectionLog_createdAt_idx" RENAME TO "DetectorInspectionLog_createdAt_idx";

-- RenameIndex
ALTER INDEX "InspectionLog_detectedFramework_idx" RENAME TO "DetectorInspectionLog_detectedFramework_idx";

-- RenameIndex
ALTER INDEX "InspectionLog_repoUrl_idx" RENAME TO "DetectorInspectionLog_repoUrl_idx";

-- RenameIndex
ALTER INDEX "InspectionLog_status_idx" RENAME TO "DetectorInspectionLog_status_idx";

-- RenameIndex
ALTER INDEX "RuntimeMapping_frameworkId_frameworkVersion_runtimeId_key" RENAME TO "DRM_frameworkId_frameworkVersion_runtimeId_key";

-- RenameIndex
ALTER INDEX "RuntimeMapping_frameworkId_isActive_idx" RENAME TO "DRM_frameworkId_isActive_idx";

-- RenameIndex
ALTER INDEX "Subscription_packageId_idx" RENAME TO "ServiceSubscription_packageId_idx";

-- RenameIndex
ALTER INDEX "Subscription_tenantId_packageId_planId_key" RENAME TO "ServiceSubscription_tenantId_packageId_planId_key";

-- RenameIndex
ALTER INDEX "Subscription_tenantId_status_idx" RENAME TO "ServiceSubscription_tenantId_status_idx";

-- RenameIndex
ALTER INDEX "SubscriptionVersion_planVersionId_idx" RENAME TO "ServiceSubscriptionVersion_planVersionId_idx";

-- RenameIndex
ALTER INDEX "SubscriptionVersion_subscriptionId_effectiveFrom_idx" RENAME TO "ServiceSubscriptionVersion_subscriptionId_effectiveFrom_idx";

-- RenameIndex
ALTER INDEX "SubscriptionVersion_subscriptionId_version_key" RENAME TO "ServiceSubscriptionVersion_subscriptionId_version_key";
