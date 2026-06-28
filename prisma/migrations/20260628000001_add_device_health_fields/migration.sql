-- Add device health fields and status enum values
ALTER TYPE "WhatsappDeviceStatus" ADD VALUE IF NOT EXISTS 'DISCONNECTED';
ALTER TYPE "WhatsappDeviceStatus" ADD VALUE IF NOT EXISTS 'UNKNOWN';

ALTER TABLE "WhatsappDevice"
  ADD COLUMN IF NOT EXISTS "lastHeartbeatAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastDisconnectedAt" TIMESTAMP(3);
