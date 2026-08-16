/*
  Warnings:

  - A unique constraint covering the columns `[stackId]` on the table `AiDeploymentSession` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[deploymentId]` on the table `AiDeploymentSession` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "AiDeploymentSession" ADD COLUMN     "deploymentId" TEXT,
ADD COLUMN     "stackId" TEXT;

-- AlterTable
ALTER TABLE "AppManagedServiceCredential" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Subscription" ALTER COLUMN "billingPeriod" SET DEFAULT 'MONTHLY',
ALTER COLUMN "currency" SET DEFAULT 'IDR',
ALTER COLUMN "quantity" SET DEFAULT 1;

-- AlterTable
ALTER TABLE "VpnPackage" ALTER COLUMN "currency" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "AiDeploymentSession_stackId_key" ON "AiDeploymentSession"("stackId");

-- CreateIndex
CREATE UNIQUE INDEX "AiDeploymentSession_deploymentId_key" ON "AiDeploymentSession"("deploymentId");

-- CreateIndex
CREATE INDEX "AiDeploymentSession_organizationId_stackId_idx" ON "AiDeploymentSession"("organizationId", "stackId");

-- RenameIndex
ALTER INDEX "Pricing_planId_regionId_type_billingMode_billingPeriod_currency" RENAME TO "Pricing_planId_regionId_type_billingMode_billingPeriod_curr_key";
