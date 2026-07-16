-- Add hourly message count tracking for broadcast device-limit scheduling
CREATE TABLE "WhatsappHourlyCount" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "hour" TIMESTAMP(0) NOT NULL,
    "messageOutboxCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "whatsappDeviceId" TEXT,

    CONSTRAINT "WhatsappHourlyCount_pkey" PRIMARY KEY ("id")
);

-- Change default on dailyLimitMessage from 0 to 1000
ALTER TABLE "WhatsappDevice" ALTER COLUMN "dailyLimitMessage" SET DEFAULT 1000;

-- Backfill existing devices with dailyLimitMessage = 0 to the new default
UPDATE "WhatsappDevice" SET "dailyLimitMessage" = 1000 WHERE "dailyLimitMessage" = 0;

-- Unique index: one row per organization + device + hour
CREATE UNIQUE INDEX "WhatsappHourlyCount_organizationId_whatsappDeviceId_hour_key" ON "WhatsappHourlyCount"("organizationId", "whatsappDeviceId", "hour");

-- Add foreign key
ALTER TABLE "WhatsappHourlyCount" ADD CONSTRAINT "WhatsappHourlyCount_whatsappDeviceId_fkey" FOREIGN KEY ("whatsappDeviceId") REFERENCES "WhatsappDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
