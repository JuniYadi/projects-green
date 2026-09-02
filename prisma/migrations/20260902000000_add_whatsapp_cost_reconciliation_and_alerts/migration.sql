-- CreateEnum
CREATE TYPE "AlertVertical" AS ENUM ('WHATSAPP', 'APPHOSTING', 'VPN', 'GLOBAL_BILLING');

-- CreateEnum
CREATE TYPE "AlertEventType" AS ENUM ('QUOTA_LOW', 'PAYG_THRESHOLD', 'RESOURCE_SPIKE', 'EXPIRY_WARNING');

-- CreateTable
CREATE TABLE "WhatsappDailyCostReconciliation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "whatsappDeviceId" TEXT NOT NULL,
    "phoneNumber" VARCHAR(32),
    "category" "WhatsappBillingCategory" NOT NULL DEFAULT 'MARKETING',
    "date" DATE NOT NULL,
    "metaDeliveredCount" INTEGER NOT NULL DEFAULT 0,
    "metaBaseCostIdr" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "metaVatCostIdr" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "metaTotalCostIdr" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "localDeliveredCount" INTEGER NOT NULL DEFAULT 0,
    "quotaCreditsUsed" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "internalRevenueIdr" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "grossProfitIdr" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "grossMarginPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappDailyCostReconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingAlertRule" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "vertical" "AlertVertical" NOT NULL,
    "eventType" "AlertEventType" NOT NULL,
    "targetId" TEXT NOT NULL DEFAULT '*',
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "thresholdValue" DECIMAL(12,2) NOT NULL DEFAULT 80,
    "channels" TEXT[] DEFAULT ARRAY['EMAIL']::TEXT[],
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingAlertRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WhatsappDailyCostReconciliation_organizationId_date_idx" ON "WhatsappDailyCostReconciliation"("organizationId", "date");

-- CreateIndex
CREATE INDEX "WhatsappDailyCostReconciliation_date_idx" ON "WhatsappDailyCostReconciliation"("date");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappDailyCostReconciliation_whatsappDeviceId_category_d_key" ON "WhatsappDailyCostReconciliation"("whatsappDeviceId", "category", "date");

-- CreateIndex
CREATE INDEX "BillingAlertRule_organizationId_vertical_targetId_idx" ON "BillingAlertRule"("organizationId", "vertical", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingAlertRule_organizationId_vertical_eventType_targetId_key" ON "BillingAlertRule"("organizationId", "vertical", "eventType", "targetId");

-- AddForeignKey
ALTER TABLE "WhatsappDailyCostReconciliation" ADD CONSTRAINT "WhatsappDailyCostReconciliation_whatsappDeviceId_fkey" FOREIGN KEY ("whatsappDeviceId") REFERENCES "WhatsappDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
