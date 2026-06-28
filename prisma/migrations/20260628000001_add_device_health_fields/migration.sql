-- AlterEnum
-- This migration adds DISCONNECTED and UNKNOWN to WhatsappDeviceStatus
ALTER TYPE "WhatsappDeviceStatus" ADD VALUE IF NOT EXISTS 'DISCONNECTED';
ALTER TYPE "WhatsappDeviceStatus" ADD VALUE IF NOT EXISTS 'UNKNOWN';

-- AlterTable: Add heartbeat tracking fields to WhatsappDevice
ALTER TABLE "WhatsappDevice" ADD COLUMN IF NOT EXISTS "lastHeartbeatAt" TIMESTAMP(3);
ALTER TABLE "WhatsappDevice" ADD COLUMN IF NOT EXISTS "lastDisconnectedAt" TIMESTAMP(3);
