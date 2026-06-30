/*
  Warnings:

  - You are about to drop the column `created_at` on the `EmailLog` table. All the data in the column will be lost.
  - You are about to drop the column `error_message` on the `EmailLog` table. All the data in the column will be lost.
  - You are about to drop the column `recipient_email` on the `EmailLog` table. All the data in the column will be lost.
  - You are about to drop the column `sent_at` on the `EmailLog` table. All the data in the column will be lost.
  - You are about to drop the column `ticket_id` on the `EmailLog` table. All the data in the column will be lost.
  - You are about to drop the column `ticket_number` on the `EmailLog` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `EmailLog` table. All the data in the column will be lost.
  - Added the required column `recipientEmail` to the `EmailLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `EmailLog` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "VpnMobileSessionStatus" AS ENUM ('ACTIVE', 'STALE', 'CLOSED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SupportTicketStatus" ADD VALUE 'WAITING_RESPONSE';
ALTER TYPE "SupportTicketStatus" ADD VALUE 'ON_HOLD';

-- DropIndex
DROP INDEX "EmailLog_created_at_idx";

-- DropIndex
DROP INDEX "EmailLog_recipient_email_idx";

-- DropIndex
DROP INDEX "EmailLog_ticket_id_idx";

-- DropIndex
DROP INDEX "EmailLog_ticket_number_idx";

-- AlterTable
ALTER TABLE "EmailLog" DROP COLUMN "created_at",
DROP COLUMN "error_message",
DROP COLUMN "recipient_email",
DROP COLUMN "sent_at",
DROP COLUMN "ticket_id",
DROP COLUMN "ticket_number",
DROP COLUMN "updated_at",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "errorMessage" TEXT,
ADD COLUMN     "recipientEmail" TEXT NOT NULL,
ADD COLUMN     "sentAt" TIMESTAMP(3),
ADD COLUMN     "ticketId" TEXT,
ADD COLUMN     "ticketNumber" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "WhatsappDevice" ADD COLUMN     "appSecret" TEXT;

-- CreateTable
CREATE TABLE "VpnMobileSession" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "serverAccountId" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "status" "VpnMobileSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastPingAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "txBytes" BIGINT NOT NULL DEFAULT 0,
    "rxBytes" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VpnMobileSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsappMedia" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "metaMediaId" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "sha256" TEXT,
    "storePath" TEXT,
    "downloadedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsappWebhookDeadLetter" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "rawPayload" JSONB NOT NULL,
    "errorMessage" TEXT NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "failedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "replayedAt" TIMESTAMP(3),
    "replayStatus" TEXT,
    "organizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappWebhookDeadLetter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VpnMobileSession_deviceId_idx" ON "VpnMobileSession"("deviceId");

-- CreateIndex
CREATE INDEX "VpnMobileSession_subscriptionId_idx" ON "VpnMobileSession"("subscriptionId");

-- CreateIndex
CREATE INDEX "VpnMobileSession_serverId_idx" ON "VpnMobileSession"("serverId");

-- CreateIndex
CREATE INDEX "VpnMobileSession_status_idx" ON "VpnMobileSession"("status");

-- CreateIndex
CREATE INDEX "VpnMobileSession_startedAt_idx" ON "VpnMobileSession"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappMedia_metaMediaId_key" ON "WhatsappMedia"("metaMediaId");

-- CreateIndex
CREATE INDEX "WhatsappMedia_organizationId_idx" ON "WhatsappMedia"("organizationId");

-- CreateIndex
CREATE INDEX "WhatsappMedia_deviceId_idx" ON "WhatsappMedia"("deviceId");

-- CreateIndex
CREATE INDEX "WhatsappMedia_metaMediaId_idx" ON "WhatsappMedia"("metaMediaId");

-- CreateIndex
CREATE INDEX "WhatsappWebhookDeadLetter_deviceId_failedAt_idx" ON "WhatsappWebhookDeadLetter"("deviceId", "failedAt" DESC);

-- CreateIndex
CREATE INDEX "WhatsappWebhookDeadLetter_replayStatus_idx" ON "WhatsappWebhookDeadLetter"("replayStatus");

-- CreateIndex
CREATE INDEX "WhatsappWebhookDeadLetter_organizationId_failedAt_idx" ON "WhatsappWebhookDeadLetter"("organizationId", "failedAt" DESC);

-- CreateIndex
CREATE INDEX "EmailLog_ticketId_idx" ON "EmailLog"("ticketId");

-- CreateIndex
CREATE INDEX "EmailLog_ticketNumber_idx" ON "EmailLog"("ticketNumber");

-- CreateIndex
CREATE INDEX "EmailLog_recipientEmail_idx" ON "EmailLog"("recipientEmail");

-- CreateIndex
CREATE INDEX "EmailLog_createdAt_idx" ON "EmailLog"("createdAt" DESC);

-- AddForeignKey
ALTER TABLE "VpnMobileSession" ADD CONSTRAINT "VpnMobileSession_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "VpnMobileDevice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VpnMobileSession" ADD CONSTRAINT "VpnMobileSession_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "VpnSubscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VpnMobileSession" ADD CONSTRAINT "VpnMobileSession_serverAccountId_fkey" FOREIGN KEY ("serverAccountId") REFERENCES "VpnServerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VpnMobileSession" ADD CONSTRAINT "VpnMobileSession_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "VpnServer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "WhatsappQuotaAlert_organizationId_whatsappDeviceId_threshold_ke" RENAME TO "WhatsappQuotaAlert_organizationId_whatsappDeviceId_threshol_key";
