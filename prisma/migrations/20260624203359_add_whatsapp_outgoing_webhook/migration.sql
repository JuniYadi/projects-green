/*
  Warnings:

  - You are about to drop the `WhatsappLog` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `WhatsappWebhookDeadLetter` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'DEAD_LETTERED');

-- DropForeignKey
ALTER TABLE "WhatsappLog" DROP CONSTRAINT "WhatsappLog_whatsappDeviceId_fkey";

-- AlterTable
ALTER TABLE "WhatsappWebhook" ADD COLUMN     "authHeaderName" TEXT,
ADD COLUMN     "authType" TEXT DEFAULT 'none',
ADD COLUMN     "authValue" TEXT,
ADD COLUMN     "retryIntervalMs" INTEGER NOT NULL DEFAULT 5000,
ADD COLUMN     "retryMaxAttempts" INTEGER NOT NULL DEFAULT 3;

-- DropTable
DROP TABLE "WhatsappLog";

-- DropTable
DROP TABLE "WhatsappWebhookDeadLetter";

-- DropEnum
DROP TYPE "WhatsappLogType";

-- CreateTable
CREATE TABLE "WhatsappWebhookDeliveryLog" (
    "id" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "whatsappDeviceId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "triggerEventId" TEXT,
    "status" "WebhookDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "requestUrl" TEXT NOT NULL,
    "requestHeaders" JSONB,
    "requestBody" JSONB NOT NULL,
    "responseStatus" INTEGER,
    "responseBody" TEXT,
    "errorMessage" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "nextRetryAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappWebhookDeliveryLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WhatsappWebhookDeliveryLog_organizationId_createdAt_idx" ON "WhatsappWebhookDeliveryLog"("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "WhatsappWebhookDeliveryLog_webhookId_createdAt_idx" ON "WhatsappWebhookDeliveryLog"("webhookId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "WhatsappWebhookDeliveryLog_status_nextRetryAt_idx" ON "WhatsappWebhookDeliveryLog"("status", "nextRetryAt");

-- AddForeignKey
ALTER TABLE "WhatsappWebhookDeliveryLog" ADD CONSTRAINT "WhatsappWebhookDeliveryLog_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "WhatsappWebhook"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
