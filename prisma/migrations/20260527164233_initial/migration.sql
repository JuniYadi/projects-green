-- CreateEnum
CREATE TYPE "ApiKeyEnvironment" AS ENUM ('SANDBOX', 'LIVE');

-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('NONE', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "SupportTicketDepartment" AS ENUM ('BILLING', 'TECHNICAL', 'ACCOUNT', 'COMPLIANCE');

-- CreateEnum
CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "SupportTicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "SupportTicketService" AS ENUM ('AUTH', 'BILLING', 'DEPLOY', 'DOMAINS', 'INTEGRATIONS', 'DATA', 'OTHER');

-- CreateEnum
CREATE TYPE "SupportTicketAttachmentUploadTarget" AS ENUM ('CREATE', 'REPLY');

-- CreateEnum
CREATE TYPE "BillingAccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "BillingSubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAUSED', 'CANCELED', 'ENDED');

-- CreateEnum
CREATE TYPE "BillingPeriod" AS ENUM ('MONTHLY', 'YEARLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "MeterAggregation" AS ENUM ('SUM', 'MAX', 'LAST', 'COUNT');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'OPEN', 'PAID', 'VOID', 'UNCOLLECTIBLE');

-- CreateEnum
CREATE TYPE "InvoiceLineType" AS ENUM ('SUBSCRIPTION', 'METERED', 'ADJUSTMENT', 'TAX', 'CREDIT');

-- CreateEnum
CREATE TYPE "InvoiceLineSourceType" AS ENUM ('RATED_USAGE', 'ADJUSTMENT', 'MANUAL');

-- CreateEnum
CREATE TYPE "BillingAdjustmentType" AS ENUM ('CREDIT', 'DEBIT', 'WRITEOFF');

-- CreateEnum
CREATE TYPE "BillingRunType" AS ENUM ('RATING', 'INVOICING', 'FINALIZATION', 'RECONCILIATION');

-- CreateEnum
CREATE TYPE "BillingRunStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "BillingAuditAction" AS ENUM ('CREATED', 'UPDATED', 'DELETED', 'RUN_STARTED', 'RUN_FINISHED', 'INVOICE_GENERATED');

-- CreateEnum
CREATE TYPE "BillingActorType" AS ENUM ('SYSTEM', 'USER', 'WORKER');

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

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformUserRole" (
    "id" TEXT NOT NULL,
    "workosUserId" TEXT NOT NULL,
    "email" TEXT,
    "role" "PlatformRole" NOT NULL DEFAULT 'NONE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformUserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "environment" "ApiKeyEnvironment" NOT NULL DEFAULT 'SANDBOX',
    "scopes" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "lastUsedIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeDocument" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "path" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "howTo" TEXT[],
    "notes" TEXT[],
    "searchText" TEXT NOT NULL,
    "embedding" DOUBLE PRECISION[] DEFAULT ARRAY[]::DOUBLE PRECISION[],
    "updatedByWorkosUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GithubInstallStateNonce" (
    "id" TEXT NOT NULL,
    "nonceHash" TEXT NOT NULL,
    "workosUserId" TEXT NOT NULL,
    "organizationId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GithubInstallStateNonce_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GithubInstallation" (
    "id" TEXT NOT NULL,
    "githubInstallationId" BIGINT NOT NULL,
    "accountLogin" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" BIGINT,
    "workosUserId" TEXT NOT NULL,
    "organizationId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "permissionsJson" JSONB,
    "eventsSubscribed" JSONB,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GithubInstallation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GithubRepositoryConnection" (
    "id" TEXT NOT NULL,
    "githubRepositoryId" BIGINT NOT NULL,
    "installationId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "ownerLogin" TEXT NOT NULL,
    "repoName" TEXT NOT NULL,
    "defaultBranch" TEXT,
    "isPrivate" BOOLEAN NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "branchFilters" TEXT[] DEFAULT ARRAY['main']::TEXT[],
    "rootDirectory" TEXT NOT NULL DEFAULT '/',
    "buildConfigJson" JSONB,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GithubRepositoryConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GithubWebhookEvent" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "action" TEXT,
    "githubInstallationId" BIGINT,
    "githubRepositoryId" BIGINT,
    "payloadJson" JSONB NOT NULL,
    "payloadSha256" TEXT NOT NULL,
    "signatureValid" BOOLEAN NOT NULL,
    "enqueueStatus" TEXT NOT NULL DEFAULT 'queued',
    "processStatus" TEXT NOT NULL DEFAULT 'pending',
    "processError" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "GithubWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "requesterWorkosUserId" TEXT NOT NULL,
    "assignedAgentWorkosUserId" TEXT,
    "department" "SupportTicketDepartment" NOT NULL,
    "priority" "SupportTicketPriority" NOT NULL,
    "service" "SupportTicketService",
    "status" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
    "subject" TEXT NOT NULL,
    "description" TEXT,
    "secureForm" TEXT,
    "attachmentsJson" JSONB,
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicketReply" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorWorkosUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "secureForm" TEXT,
    "isInternalNote" BOOLEAN NOT NULL DEFAULT false,
    "attachmentsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTicketReply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicketAttachmentUploadSession" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "uploaderWorkosUserId" TEXT NOT NULL,
    "target" "SupportTicketAttachmentUploadTarget" NOT NULL,
    "ticketId" TEXT,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksumSha256" TEXT,
    "storageKey" TEXT NOT NULL,
    "storageBucket" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "registeredAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "consumedTicketId" TEXT,
    "consumedReplyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTicketAttachmentUploadSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingAccount" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "status" "BillingAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingSubscription" (
    "id" TEXT NOT NULL,
    "billingAccountId" TEXT NOT NULL,
    "externalKey" TEXT,
    "status" "BillingSubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "startedAt" TIMESTAMP(3) NOT NULL,
    "canceledAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionVersion" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "planVersionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "quantity" DECIMAL(18,6) NOT NULL DEFAULT 1,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanVersion" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "billingPeriod" "BillingPeriod" NOT NULL,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meter" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "valueKey" TEXT,
    "aggregation" "MeterAggregation" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeterPrice" (
    "id" TEXT NOT NULL,
    "meterId" TEXT NOT NULL,
    "planVersionId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "unitPrice" DECIMAL(18,6) NOT NULL,
    "includedUnits" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeterPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageEvent" (
    "id" TEXT NOT NULL,
    "billingAccountId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "meterId" TEXT NOT NULL,
    "eventTimestamp" TIMESTAMP(3) NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "source" TEXT,
    "externalEventId" TEXT,
    "payloadJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RatedUsage" (
    "id" TEXT NOT NULL,
    "usageEventId" TEXT NOT NULL,
    "billingAccountId" TEXT NOT NULL,
    "subscriptionVersionId" TEXT,
    "meterPriceId" TEXT,
    "invoiceLineId" TEXT,
    "quantity" DECIMAL(18,6) NOT NULL,
    "unitPrice" DECIMAL(18,6) NOT NULL,
    "amount" DECIMAL(18,6) NOT NULL,
    "currency" TEXT NOT NULL,
    "ratedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RatedUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "billingAccountId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "billingRunId" TEXT,
    "invoiceNumber" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotalAmount" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "issuedAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLine" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "lineType" "InvoiceLineType" NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "unitPrice" DECIMAL(18,6) NOT NULL,
    "amount" DECIMAL(18,6) NOT NULL,
    "currency" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLineSource" (
    "id" TEXT NOT NULL,
    "invoiceLineId" TEXT NOT NULL,
    "sourceType" "InvoiceLineSourceType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "amount" DECIMAL(18,6) NOT NULL,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceLineSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingAdjustment" (
    "id" TEXT NOT NULL,
    "billingAccountId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "adjustmentType" "BillingAdjustmentType" NOT NULL,
    "amount" DECIMAL(18,6) NOT NULL,
    "currency" TEXT NOT NULL,
    "reason" TEXT,
    "createdByWorkosUserId" TEXT,
    "appliedAt" TIMESTAMP(3),
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingRun" (
    "id" TEXT NOT NULL,
    "billingAccountId" TEXT,
    "runType" "BillingRunType" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "status" "BillingRunStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingAuditLog" (
    "id" TEXT NOT NULL,
    "billingAccountId" TEXT,
    "billingRunId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" "BillingAuditAction" NOT NULL,
    "actorType" "BillingActorType" NOT NULL,
    "actorId" TEXT,
    "contextJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingAuditLog_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "WhatsappWebhook" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "whatsappDeviceId" TEXT NOT NULL,
    "webhookUrl" TEXT NOT NULL,
    "verifyToken" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappWebhook_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformUserRole_workosUserId_key" ON "PlatformUserRole"("workosUserId");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformUserRole_email_key" ON "PlatformUserRole"("email");

-- CreateIndex
CREATE INDEX "KnowledgeDocument_organizationId_path_idx" ON "KnowledgeDocument"("organizationId", "path");

-- CreateIndex
CREATE INDEX "KnowledgeDocument_organizationId_updatedAt_idx" ON "KnowledgeDocument"("organizationId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "KnowledgeDocument_updatedAt_idx" ON "KnowledgeDocument"("updatedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "GithubInstallStateNonce_nonceHash_key" ON "GithubInstallStateNonce"("nonceHash");

-- CreateIndex
CREATE INDEX "GithubInstallStateNonce_expiresAt_idx" ON "GithubInstallStateNonce"("expiresAt");

-- CreateIndex
CREATE INDEX "GithubInstallStateNonce_workosUserId_idx" ON "GithubInstallStateNonce"("workosUserId");

-- CreateIndex
CREATE INDEX "GithubInstallStateNonce_organizationId_idx" ON "GithubInstallStateNonce"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "GithubInstallation_githubInstallationId_key" ON "GithubInstallation"("githubInstallationId");

-- CreateIndex
CREATE INDEX "GithubInstallation_workosUserId_idx" ON "GithubInstallation"("workosUserId");

-- CreateIndex
CREATE INDEX "GithubInstallation_organizationId_idx" ON "GithubInstallation"("organizationId");

-- CreateIndex
CREATE INDEX "GithubInstallation_accountLogin_idx" ON "GithubInstallation"("accountLogin");

-- CreateIndex
CREATE INDEX "GithubRepositoryConnection_installationId_idx" ON "GithubRepositoryConnection"("installationId");

-- CreateIndex
CREATE INDEX "GithubRepositoryConnection_fullName_idx" ON "GithubRepositoryConnection"("fullName");

-- CreateIndex
CREATE UNIQUE INDEX "GithubRepositoryConnection_githubRepositoryId_installationI_key" ON "GithubRepositoryConnection"("githubRepositoryId", "installationId");

-- CreateIndex
CREATE UNIQUE INDEX "GithubWebhookEvent_deliveryId_key" ON "GithubWebhookEvent"("deliveryId");

-- CreateIndex
CREATE INDEX "GithubWebhookEvent_eventName_idx" ON "GithubWebhookEvent"("eventName");

-- CreateIndex
CREATE INDEX "GithubWebhookEvent_githubInstallationId_idx" ON "GithubWebhookEvent"("githubInstallationId");

-- CreateIndex
CREATE INDEX "GithubWebhookEvent_githubRepositoryId_idx" ON "GithubWebhookEvent"("githubRepositoryId");

-- CreateIndex
CREATE INDEX "GithubWebhookEvent_processStatus_idx" ON "GithubWebhookEvent"("processStatus");

-- CreateIndex
CREATE UNIQUE INDEX "SupportTicket_ticketNumber_key" ON "SupportTicket"("ticketNumber");

-- CreateIndex
CREATE INDEX "SupportTicket_organizationId_createdAt_idx" ON "SupportTicket"("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "SupportTicket_organizationId_status_idx" ON "SupportTicket"("organizationId", "status");

-- CreateIndex
CREATE INDEX "SupportTicket_requesterWorkosUserId_idx" ON "SupportTicket"("requesterWorkosUserId");

-- CreateIndex
CREATE INDEX "SupportTicket_assignedAgentWorkosUserId_idx" ON "SupportTicket"("assignedAgentWorkosUserId");

-- CreateIndex
CREATE INDEX "SupportTicket_department_idx" ON "SupportTicket"("department");

-- CreateIndex
CREATE INDEX "SupportTicketReply_ticketId_createdAt_idx" ON "SupportTicketReply"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "SupportTicketReply_authorWorkosUserId_idx" ON "SupportTicketReply"("authorWorkosUserId");

-- CreateIndex
CREATE INDEX "SupportTicketReply_isInternalNote_idx" ON "SupportTicketReply"("isInternalNote");

-- CreateIndex
CREATE INDEX "SupportTicketAttachmentUploadSession_organizationId_uploade_idx" ON "SupportTicketAttachmentUploadSession"("organizationId", "uploaderWorkosUserId");

-- CreateIndex
CREATE INDEX "SupportTicketAttachmentUploadSession_target_ticketId_idx" ON "SupportTicketAttachmentUploadSession"("target", "ticketId");

-- CreateIndex
CREATE INDEX "SupportTicketAttachmentUploadSession_expiresAt_idx" ON "SupportTicketAttachmentUploadSession"("expiresAt");

-- CreateIndex
CREATE INDEX "SupportTicketAttachmentUploadSession_consumedAt_idx" ON "SupportTicketAttachmentUploadSession"("consumedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BillingAccount_organizationId_key" ON "BillingAccount"("organizationId");

-- CreateIndex
CREATE INDEX "BillingSubscription_billingAccountId_status_idx" ON "BillingSubscription"("billingAccountId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BillingSubscription_billingAccountId_externalKey_key" ON "BillingSubscription"("billingAccountId", "externalKey");

-- CreateIndex
CREATE INDEX "SubscriptionVersion_subscriptionId_effectiveFrom_idx" ON "SubscriptionVersion"("subscriptionId", "effectiveFrom" DESC);

-- CreateIndex
CREATE INDEX "SubscriptionVersion_planVersionId_idx" ON "SubscriptionVersion"("planVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionVersion_subscriptionId_version_key" ON "SubscriptionVersion"("subscriptionId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_code_key" ON "Plan"("code");

-- CreateIndex
CREATE INDEX "PlanVersion_planId_effectiveFrom_idx" ON "PlanVersion"("planId", "effectiveFrom" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "PlanVersion_planId_version_key" ON "PlanVersion"("planId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Meter_code_key" ON "Meter"("code");

-- CreateIndex
CREATE INDEX "Meter_eventName_idx" ON "Meter"("eventName");

-- CreateIndex
CREATE INDEX "MeterPrice_meterId_planVersionId_idx" ON "MeterPrice"("meterId", "planVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "MeterPrice_meterId_planVersionId_effectiveFrom_key" ON "MeterPrice"("meterId", "planVersionId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "UsageEvent_billingAccountId_eventTimestamp_idx" ON "UsageEvent"("billingAccountId", "eventTimestamp");

-- CreateIndex
CREATE INDEX "UsageEvent_subscriptionId_meterId_eventTimestamp_idx" ON "UsageEvent"("subscriptionId", "meterId", "eventTimestamp");

-- CreateIndex
CREATE INDEX "UsageEvent_meterId_eventTimestamp_idx" ON "UsageEvent"("meterId", "eventTimestamp");

-- CreateIndex
CREATE UNIQUE INDEX "UsageEvent_billingAccountId_idempotencyKey_key" ON "UsageEvent"("billingAccountId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "RatedUsage_usageEventId_key" ON "RatedUsage"("usageEventId");

-- CreateIndex
CREATE INDEX "RatedUsage_billingAccountId_ratedAt_idx" ON "RatedUsage"("billingAccountId", "ratedAt");

-- CreateIndex
CREATE INDEX "RatedUsage_invoiceLineId_idx" ON "RatedUsage"("invoiceLineId");

-- CreateIndex
CREATE INDEX "RatedUsage_subscriptionVersionId_idx" ON "RatedUsage"("subscriptionVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "Invoice_billingAccountId_status_idx" ON "Invoice"("billingAccountId", "status");

-- CreateIndex
CREATE INDEX "Invoice_subscriptionId_periodStart_idx" ON "Invoice"("subscriptionId", "periodStart");

-- CreateIndex
CREATE INDEX "Invoice_billingRunId_idx" ON "Invoice"("billingRunId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_billingAccountId_periodStart_periodEnd_key" ON "Invoice"("billingAccountId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "InvoiceLine_invoiceId_idx" ON "InvoiceLine"("invoiceId");

-- CreateIndex
CREATE INDEX "InvoiceLine_lineType_idx" ON "InvoiceLine"("lineType");

-- CreateIndex
CREATE INDEX "InvoiceLineSource_sourceType_sourceId_idx" ON "InvoiceLineSource"("sourceType", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceLineSource_invoiceLineId_sourceType_sourceId_key" ON "InvoiceLineSource"("invoiceLineId", "sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "BillingAdjustment_billingAccountId_createdAt_idx" ON "BillingAdjustment"("billingAccountId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "BillingAdjustment_invoiceId_idx" ON "BillingAdjustment"("invoiceId");

-- CreateIndex
CREATE INDEX "BillingRun_billingAccountId_runType_startedAt_idx" ON "BillingRun"("billingAccountId", "runType", "startedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "BillingRun_billingAccountId_runType_periodStart_periodEnd_key" ON "BillingRun"("billingAccountId", "runType", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "BillingAuditLog_billingAccountId_createdAt_idx" ON "BillingAuditLog"("billingAccountId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "BillingAuditLog_billingRunId_createdAt_idx" ON "BillingAuditLog"("billingRunId", "createdAt");

-- CreateIndex
CREATE INDEX "BillingAuditLog_entityType_entityId_idx" ON "BillingAuditLog"("entityType", "entityId");

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

-- CreateIndex
CREATE INDEX "WhatsappWebhook_organizationId_idx" ON "WhatsappWebhook"("organizationId");

-- CreateIndex
CREATE INDEX "WhatsappWebhook_whatsappDeviceId_idx" ON "WhatsappWebhook"("whatsappDeviceId");

-- AddForeignKey
ALTER TABLE "GithubRepositoryConnection" ADD CONSTRAINT "GithubRepositoryConnection_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "GithubInstallation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicketReply" ADD CONSTRAINT "SupportTicketReply_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicketAttachmentUploadSession" ADD CONSTRAINT "SupportTicketAttachmentUploadSession_consumedTicketId_fkey" FOREIGN KEY ("consumedTicketId") REFERENCES "SupportTicket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicketAttachmentUploadSession" ADD CONSTRAINT "SupportTicketAttachmentUploadSession_consumedReplyId_fkey" FOREIGN KEY ("consumedReplyId") REFERENCES "SupportTicketReply"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingSubscription" ADD CONSTRAINT "BillingSubscription_billingAccountId_fkey" FOREIGN KEY ("billingAccountId") REFERENCES "BillingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionVersion" ADD CONSTRAINT "SubscriptionVersion_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "BillingSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionVersion" ADD CONSTRAINT "SubscriptionVersion_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "PlanVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanVersion" ADD CONSTRAINT "PlanVersion_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeterPrice" ADD CONSTRAINT "MeterPrice_meterId_fkey" FOREIGN KEY ("meterId") REFERENCES "Meter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeterPrice" ADD CONSTRAINT "MeterPrice_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "PlanVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageEvent" ADD CONSTRAINT "UsageEvent_billingAccountId_fkey" FOREIGN KEY ("billingAccountId") REFERENCES "BillingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageEvent" ADD CONSTRAINT "UsageEvent_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "BillingSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageEvent" ADD CONSTRAINT "UsageEvent_meterId_fkey" FOREIGN KEY ("meterId") REFERENCES "Meter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatedUsage" ADD CONSTRAINT "RatedUsage_usageEventId_fkey" FOREIGN KEY ("usageEventId") REFERENCES "UsageEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatedUsage" ADD CONSTRAINT "RatedUsage_billingAccountId_fkey" FOREIGN KEY ("billingAccountId") REFERENCES "BillingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatedUsage" ADD CONSTRAINT "RatedUsage_subscriptionVersionId_fkey" FOREIGN KEY ("subscriptionVersionId") REFERENCES "SubscriptionVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatedUsage" ADD CONSTRAINT "RatedUsage_meterPriceId_fkey" FOREIGN KEY ("meterPriceId") REFERENCES "MeterPrice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatedUsage" ADD CONSTRAINT "RatedUsage_invoiceLineId_fkey" FOREIGN KEY ("invoiceLineId") REFERENCES "InvoiceLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_billingAccountId_fkey" FOREIGN KEY ("billingAccountId") REFERENCES "BillingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "BillingSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_billingRunId_fkey" FOREIGN KEY ("billingRunId") REFERENCES "BillingRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLineSource" ADD CONSTRAINT "InvoiceLineSource_invoiceLineId_fkey" FOREIGN KEY ("invoiceLineId") REFERENCES "InvoiceLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingAdjustment" ADD CONSTRAINT "BillingAdjustment_billingAccountId_fkey" FOREIGN KEY ("billingAccountId") REFERENCES "BillingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingAdjustment" ADD CONSTRAINT "BillingAdjustment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingRun" ADD CONSTRAINT "BillingRun_billingAccountId_fkey" FOREIGN KEY ("billingAccountId") REFERENCES "BillingAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingAuditLog" ADD CONSTRAINT "BillingAuditLog_billingAccountId_fkey" FOREIGN KEY ("billingAccountId") REFERENCES "BillingAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingAuditLog" ADD CONSTRAINT "BillingAuditLog_billingRunId_fkey" FOREIGN KEY ("billingRunId") REFERENCES "BillingRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "WhatsappWebhook" ADD CONSTRAINT "WhatsappWebhook_whatsappDeviceId_fkey" FOREIGN KEY ("whatsappDeviceId") REFERENCES "WhatsappDevice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
