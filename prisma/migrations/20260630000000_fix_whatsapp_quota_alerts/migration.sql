-- Fix WhatsApp quota alert tracking and add a running cost counter.
DROP TABLE IF EXISTS "WhatsappQuotaAlert";

ALTER TABLE "WhatsappDevice"
  ADD COLUMN IF NOT EXISTS "currentQuotaUsed" DECIMAL(12,2) NOT NULL DEFAULT 0;

CREATE TABLE "WhatsappQuotaAlert" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "whatsappDeviceId" TEXT NOT NULL,
  "threshold" INTEGER NOT NULL,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WhatsappQuotaAlert_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WhatsappQuotaAlert_organizationId_whatsappDeviceId_threshold_key"
  ON "WhatsappQuotaAlert"("organizationId", "whatsappDeviceId", "threshold");

CREATE INDEX "WhatsappQuotaAlert_organizationId_idx"
  ON "WhatsappQuotaAlert"("organizationId");
