-- CreateEnum
CREATE TYPE "WhatsappDeviceStatus" AS ENUM ('ACTIVE', 'NON_ACTIVE');

-- CreateEnum
CREATE TYPE "WhatsappContactGroupStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "WhatsappContactGroupType" AS ENUM ('STATIC', 'DYNAMIC');

-- CreateEnum
CREATE TYPE "WhatsappContactStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "WhatsappTemplateSyncStatus" AS ENUM ('SYNCED', 'NOT_SYNCED', 'NOT_IN_META');

-- CreateEnum
CREATE TYPE "WhatsappTemplateMetaStatus" AS ENUM ('APPROVED', 'PENDING', 'REJECTED');

-- CreateEnum
CREATE TYPE "WhatsappBroadcastStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'COMPLETED_WITH_ERRORS');

-- CreateEnum
CREATE TYPE "WhatsappBroadcastRecipientStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "WhatsappMessageDirection" AS ENUM ('INBOX', 'OUTBOX');

-- CreateEnum
CREATE TYPE "WhatsappMessageDeliveryStatus" AS ENUM ('SENT', 'DELIVERED', 'READ', 'FAILED');

-- CreateEnum
CREATE TYPE "WhatsappBillingCategory" AS ENUM ('MARKETING', 'UTILITY', 'AUTHENTICATION', 'SERVICE');

-- CreateEnum
CREATE TYPE "WhatsappBillingStatus" AS ENUM ('CHARGED_PENDING_VERIFY', 'CONFIRMED', 'REVERTED_FAILED');

-- CreateEnum
CREATE TYPE "WhatsappLogType" AS ENUM ('INFO', 'ERROR', 'INBOX', 'AUDIT');

-- CreateEnum
CREATE TYPE "WhatsappApiKeyEnvironment" AS ENUM ('SANDBOX', 'LIVE');

-- DropIndex
DROP INDEX "SupportTicket_priority_idx";

-- DropIndex
DROP INDEX "SupportTicket_service_idx";

-- AlterTable
ALTER TABLE "KnowledgeDocument" ADD COLUMN     "embedding" DOUBLE PRECISION[] DEFAULT ARRAY[]::DOUBLE PRECISION[];

-- AlterTable
ALTER TABLE "SupportTicket" ALTER COLUMN "priority" DROP DEFAULT;

-- CreateTable
CREATE TABLE "WhatsappDevice" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "quotaBase" DECIMAL(12,2) NOT NULL DEFAULT 1000,
    "quotaBaseIn" INTEGER NOT NULL DEFAULT 0,
    "quotaBaseOut" INTEGER NOT NULL DEFAULT 0,
    "dailyLimitMessage" INTEGER NOT NULL DEFAULT 0,
    "rates" TEXT,
    "status" "WhatsappDeviceStatus" NOT NULL DEFAULT 'ACTIVE',
    "token" TEXT,
    "tokenEncrypted" TEXT,
    "tokenIv" TEXT,
    "s3Path" TEXT,
    "whatsappBusinessAccountId" TEXT,
    "whatsappPhoneId" TEXT,
    "whatsappApplicationId" TEXT,
    "whatsappVersion" TEXT NOT NULL DEFAULT 'v24.0',
    "whatsappProfile" JSONB,
    "features" JSONB,
    "callbackUrl" TEXT,
    "callbackHeaderName" TEXT,
    "callbackHeaderValue" TEXT,
    "expiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsappContactGroup" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "type" "WhatsappContactGroupType" NOT NULL DEFAULT 'STATIC',
    "status" "WhatsappContactGroupStatus" NOT NULL DEFAULT 'ACTIVE',
    "throttleMaxMessages" INTEGER,
    "throttlePerMinutes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "whatsappDeviceId" TEXT,
    "whatsappBroadcastRateStateId" TEXT,

    CONSTRAINT "WhatsappContactGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsappContact" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "phoneNumber" VARCHAR(20) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "status" "WhatsappContactStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastContactedAt" TIMESTAMP(3),
    "waId" TEXT,
    "isWhatsapp" BOOLEAN NOT NULL DEFAULT false,
    "lastCheckedAt" TIMESTAMP(3),
    "dynamicValues" JSONB,
    "dynamicRaw" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "contactGroupId" TEXT NOT NULL,
    "whatsappDeviceId" TEXT,

    CONSTRAINT "WhatsappContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsappTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "syncStatus" "WhatsappTemplateSyncStatus" NOT NULL DEFAULT 'NOT_SYNCED',
    "metaStatus" "WhatsappTemplateMetaStatus",
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "whatsappDeviceId" TEXT,

    CONSTRAINT "WhatsappTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsappTemplateLanguage" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "lang" TEXT NOT NULL,
    "headerType" TEXT,
    "headerUrl" TEXT,
    "headerText" TEXT,
    "body" TEXT,
    "parameters" JSONB,
    "footer" TEXT,
    "buttons" JSONB,
    "authConfig" JSONB,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "metaStatus" "WhatsappTemplateMetaStatus",
    "rejectReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappTemplateLanguage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsappBroadcastCampaign" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "templateLanguage" TEXT NOT NULL,
    "templateParams" JSONB,
    "throttleMaxMessages" INTEGER,
    "throttlePerMinutes" INTEGER,
    "status" "WhatsappBroadcastStatus" NOT NULL DEFAULT 'QUEUED',
    "total" INTEGER NOT NULL DEFAULT 0,
    "queued" INTEGER NOT NULL DEFAULT 0,
    "sent" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "whatsappDeviceId" TEXT,
    "whatsappContactGroupId" TEXT,

    CONSTRAINT "WhatsappBroadcastCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsappBroadcastRecipient" (
    "id" TEXT NOT NULL,
    "broadcastId" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "name" TEXT,
    "dynamicValues" JSONB,
    "status" "WhatsappBroadcastRecipientStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "waMessageId" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappBroadcastRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsappConversation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "lastMessageAt" TIMESTAMP(3),
    "lastDirection" "WhatsappMessageDirection",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "whatsappDeviceId" TEXT,

    CONSTRAINT "WhatsappConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsappMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "direction" "WhatsappMessageDirection" NOT NULL,
    "messageType" TEXT NOT NULL,
    "body" TEXT,
    "mediaUrl" TEXT,
    "waMessageId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsappMessageStatus" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "status" "WhatsappMessageDeliveryStatus" NOT NULL,
    "timestamp" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsappMessageStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsappDailyCount" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "sessionCount" INTEGER NOT NULL DEFAULT 0,
    "messageInboxCount" INTEGER NOT NULL DEFAULT 0,
    "messageOutboxCount" INTEGER NOT NULL DEFAULT 0,
    "messageFailedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "whatsappDeviceId" TEXT,

    CONSTRAINT "WhatsappDailyCount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsappMonthlyCount" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "sessionCount" INTEGER NOT NULL DEFAULT 0,
    "messageInboxCount" INTEGER NOT NULL DEFAULT 0,
    "messageOutboxCount" INTEGER NOT NULL DEFAULT 0,
    "messageFailedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "whatsappDeviceId" TEXT,

    CONSTRAINT "WhatsappMonthlyCount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsappQuotaSession" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "expiredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "whatsappDeviceId" TEXT,

    CONSTRAINT "WhatsappQuotaSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsappBillingLedger" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "waMessageId" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "category" "WhatsappBillingCategory" NOT NULL,
    "quotaKey" TEXT NOT NULL,
    "quotaValue" DECIMAL(12,2) NOT NULL,
    "status" "WhatsappBillingStatus" NOT NULL DEFAULT 'CHARGED_PENDING_VERIFY',
    "isReverted" BOOLEAN NOT NULL DEFAULT false,
    "revertReason" TEXT,
    "revertedAt" TIMESTAMP(3),
    "lastStatus" TEXT,
    "pricingBillable" BOOLEAN,
    "pricingCategory" TEXT,
    "errorCode" TEXT,
    "errorTitle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "whatsappDeviceId" TEXT,

    CONSTRAINT "WhatsappBillingLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsappLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "WhatsappLogType" NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "whatsappDeviceId" TEXT,

    CONSTRAINT "WhatsappLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsappAttachment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "s3Path" TEXT NOT NULL,
    "publicUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "whatsappDeviceId" TEXT,

    CONSTRAINT "WhatsappAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsappBroadcastRateState" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "whatsappContactGroupId" TEXT NOT NULL,
    "lastMessageSentAt" TIMESTAMP(3),
    "messagesSentInWindow" INTEGER NOT NULL DEFAULT 0,
    "windowStartAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "whatsappDeviceId" TEXT,

    CONSTRAINT "WhatsappBroadcastRateState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsappApiKey" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "environment" "WhatsappApiKeyEnvironment" NOT NULL DEFAULT 'SANDBOX',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappDevice_phoneNumber_key" ON "WhatsappDevice"("phoneNumber");

-- CreateIndex
CREATE INDEX "WhatsappDevice_organizationId_idx" ON "WhatsappDevice"("organizationId");

-- CreateIndex
CREATE INDEX "WhatsappDevice_whatsappBusinessAccountId_idx" ON "WhatsappDevice"("whatsappBusinessAccountId");

-- CreateIndex
CREATE INDEX "WhatsappContactGroup_organizationId_status_idx" ON "WhatsappContactGroup"("organizationId", "status");

-- CreateIndex
CREATE INDEX "WhatsappContact_organizationId_contactGroupId_status_idx" ON "WhatsappContact"("organizationId", "contactGroupId", "status");

-- CreateIndex
CREATE INDEX "WhatsappContact_organizationId_createdAt_idx" ON "WhatsappContact"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappContact_organizationId_phoneNumber_key" ON "WhatsappContact"("organizationId", "phoneNumber");

-- CreateIndex
CREATE INDEX "WhatsappTemplate_organizationId_metaStatus_idx" ON "WhatsappTemplate"("organizationId", "metaStatus");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappTemplateLanguage_templateId_lang_key" ON "WhatsappTemplateLanguage"("templateId", "lang");

-- CreateIndex
CREATE INDEX "WhatsappBroadcastCampaign_organizationId_status_idx" ON "WhatsappBroadcastCampaign"("organizationId", "status");

-- CreateIndex
CREATE INDEX "WhatsappBroadcastRecipient_broadcastId_status_idx" ON "WhatsappBroadcastRecipient"("broadcastId", "status");

-- CreateIndex
CREATE INDEX "WhatsappConversation_organizationId_lastMessageAt_idx" ON "WhatsappConversation"("organizationId", "lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappConversation_organizationId_contactPhone_key" ON "WhatsappConversation"("organizationId", "contactPhone");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappMessage_waMessageId_key" ON "WhatsappMessage"("waMessageId");

-- CreateIndex
CREATE INDEX "WhatsappMessage_conversationId_createdAt_idx" ON "WhatsappMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "WhatsappMessageStatus_messageId_createdAt_idx" ON "WhatsappMessageStatus"("messageId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappDailyCount_organizationId_date_whatsappDeviceId_key" ON "WhatsappDailyCount"("organizationId", "date", "whatsappDeviceId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappMonthlyCount_organizationId_year_month_whatsappDevi_key" ON "WhatsappMonthlyCount"("organizationId", "year", "month", "whatsappDeviceId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappQuotaSession_organizationId_phoneNumber_category_key" ON "WhatsappQuotaSession"("organizationId", "phoneNumber", "category");

-- CreateIndex
CREATE INDEX "WhatsappBillingLedger_organizationId_createdAt_idx" ON "WhatsappBillingLedger"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "WhatsappBillingLedger_waMessageId_idx" ON "WhatsappBillingLedger"("waMessageId");

-- CreateIndex
CREATE INDEX "WhatsappLog_organizationId_type_createdAt_idx" ON "WhatsappLog"("organizationId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "WhatsappAttachment_organizationId_createdAt_idx" ON "WhatsappAttachment"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappBroadcastRateState_whatsappContactGroupId_key" ON "WhatsappBroadcastRateState"("whatsappContactGroupId");

-- CreateIndex
CREATE INDEX "WhatsappBroadcastRateState_organizationId_idx" ON "WhatsappBroadcastRateState"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappApiKey_key_key" ON "WhatsappApiKey"("key");

-- CreateIndex
CREATE INDEX "WhatsappApiKey_organizationId_key_idx" ON "WhatsappApiKey"("organizationId", "key");

-- AddForeignKey
ALTER TABLE "WhatsappContactGroup" ADD CONSTRAINT "WhatsappContactGroup_whatsappDeviceId_fkey" FOREIGN KEY ("whatsappDeviceId") REFERENCES "WhatsappDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappContact" ADD CONSTRAINT "WhatsappContact_contactGroupId_fkey" FOREIGN KEY ("contactGroupId") REFERENCES "WhatsappContactGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappContact" ADD CONSTRAINT "WhatsappContact_whatsappDeviceId_fkey" FOREIGN KEY ("whatsappDeviceId") REFERENCES "WhatsappDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappTemplate" ADD CONSTRAINT "WhatsappTemplate_whatsappDeviceId_fkey" FOREIGN KEY ("whatsappDeviceId") REFERENCES "WhatsappDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappTemplateLanguage" ADD CONSTRAINT "WhatsappTemplateLanguage_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WhatsappTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappBroadcastCampaign" ADD CONSTRAINT "WhatsappBroadcastCampaign_whatsappDeviceId_fkey" FOREIGN KEY ("whatsappDeviceId") REFERENCES "WhatsappDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappBroadcastCampaign" ADD CONSTRAINT "WhatsappBroadcastCampaign_whatsappContactGroupId_fkey" FOREIGN KEY ("whatsappContactGroupId") REFERENCES "WhatsappContactGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappBroadcastRecipient" ADD CONSTRAINT "WhatsappBroadcastRecipient_broadcastId_fkey" FOREIGN KEY ("broadcastId") REFERENCES "WhatsappBroadcastCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappConversation" ADD CONSTRAINT "WhatsappConversation_whatsappDeviceId_fkey" FOREIGN KEY ("whatsappDeviceId") REFERENCES "WhatsappDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappMessage" ADD CONSTRAINT "WhatsappMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "WhatsappConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappMessageStatus" ADD CONSTRAINT "WhatsappMessageStatus_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "WhatsappMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappDailyCount" ADD CONSTRAINT "WhatsappDailyCount_whatsappDeviceId_fkey" FOREIGN KEY ("whatsappDeviceId") REFERENCES "WhatsappDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappMonthlyCount" ADD CONSTRAINT "WhatsappMonthlyCount_whatsappDeviceId_fkey" FOREIGN KEY ("whatsappDeviceId") REFERENCES "WhatsappDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappQuotaSession" ADD CONSTRAINT "WhatsappQuotaSession_whatsappDeviceId_fkey" FOREIGN KEY ("whatsappDeviceId") REFERENCES "WhatsappDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappBillingLedger" ADD CONSTRAINT "WhatsappBillingLedger_whatsappDeviceId_fkey" FOREIGN KEY ("whatsappDeviceId") REFERENCES "WhatsappDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappLog" ADD CONSTRAINT "WhatsappLog_whatsappDeviceId_fkey" FOREIGN KEY ("whatsappDeviceId") REFERENCES "WhatsappDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappAttachment" ADD CONSTRAINT "WhatsappAttachment_whatsappDeviceId_fkey" FOREIGN KEY ("whatsappDeviceId") REFERENCES "WhatsappDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappBroadcastRateState" ADD CONSTRAINT "WhatsappBroadcastRateState_whatsappContactGroupId_fkey" FOREIGN KEY ("whatsappContactGroupId") REFERENCES "WhatsappContactGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappBroadcastRateState" ADD CONSTRAINT "WhatsappBroadcastRateState_whatsappDeviceId_fkey" FOREIGN KEY ("whatsappDeviceId") REFERENCES "WhatsappDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "SupportTicketAttachmentUploadSession_organizationId_uploaderW_i" RENAME TO "SupportTicketAttachmentUploadSession_organizationId_uploade_idx";
