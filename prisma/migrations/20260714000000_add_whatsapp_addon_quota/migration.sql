-- Add addon quota fields to WhatsappDevice
ALTER TABLE "WhatsappDevice" ADD COLUMN "addonQuota" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "WhatsappDevice" ADD COLUMN "addonQuotaTotal" DECIMAL(12,2) NOT NULL DEFAULT 0;
