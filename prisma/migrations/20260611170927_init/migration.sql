-- CreateEnum
CREATE TYPE "ApiKeyEnvironment" AS ENUM ('SANDBOX', 'LIVE');

-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('NONE', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "StackStatus" AS ENUM ('IDLE', 'QUEUED', 'BUILDING', 'DEPLOYING', 'RUNNING', 'FAILED');

-- CreateEnum
CREATE TYPE "DeploySource" AS ENUM ('GITHUB', 'TEMPLATE', 'MANUAL');

-- CreateEnum
CREATE TYPE "DeployEventType" AS ENUM ('QUEUED', 'BUILD_STARTED', 'MANIFEST_PUSHED', 'ARGOCD_SYNC_STARTED', 'ARGOCD_SYNCED', 'DEPLOY_COMPLETED', 'DEPLOY_FAILED', 'ROLLBACK_STARTED', 'ROLLBACK_COMPLETED');

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
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'OPEN', 'PAID', 'OVERDUE', 'CANCELLED', 'VOID', 'UNCOLLECTIBLE');

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
CREATE TYPE "ServiceType" AS ENUM ('APP_HOSTING', 'VPN', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "SubscriptionType" AS ENUM ('PAYG', 'BUNDLE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "BillingMode" AS ENUM ('PACKAGE', 'PAYG', 'CUSTOM');

-- CreateEnum
CREATE TYPE "BillingSubscriptionStatus2" AS ENUM ('ACTIVE', 'SUSPENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "VpnProvider" AS ENUM ('OPENVPN');

-- CreateEnum
CREATE TYPE "VpnRegionCode" AS ENUM ('INDONESIA');

-- CreateEnum
CREATE TYPE "VpnClientStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED', 'PROVISIONING_FAILED');

-- CreateEnum
CREATE TYPE "AdjustmentType" AS ENUM ('CREDIT', 'DEBIT');

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

-- CreateEnum
CREATE TYPE "VoucherStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'DEPLETED', 'DISABLED');

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
    "organizationId" TEXT NOT NULL,
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
CREATE TABLE "DetectorRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "patternJson" JSONB NOT NULL,
    "implicationsJson" JSONB NOT NULL,
    "confidenceWeight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DetectorRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuntimeMapping" (
    "id" TEXT NOT NULL,
    "frameworkId" TEXT NOT NULL,
    "frameworkVersion" TEXT,
    "runtimeId" TEXT NOT NULL,
    "runtimeVersion" TEXT NOT NULL,
    "buildVersion" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RuntimeMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionLog" (
    "id" TEXT NOT NULL,
    "installationId" BIGINT,
    "repoUrl" TEXT NOT NULL,
    "ref" TEXT,
    "detectedFramework" TEXT,
    "confidence" DOUBLE PRECISION,
    "enforcedRuntimes" JSONB,
    "toolCalls" JSONB,
    "reasoning" TEXT[],
    "warnings" TEXT[],
    "durationMs" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'success',
    "blockedByRuleId" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InspectionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationStack" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "StackStatus" NOT NULL DEFAULT 'IDLE',
    "sourceType" "DeploySource" NOT NULL DEFAULT 'GITHUB',
    "repositoryConnectionId" TEXT,
    "branchName" TEXT NOT NULL DEFAULT 'main',
    "rootDirectory" TEXT NOT NULL DEFAULT '/',
    "framework" TEXT,
    "buildCommand" TEXT,
    "dockerfileDetected" BOOLEAN NOT NULL DEFAULT false,
    "resourcePlanId" TEXT,
    "billingMode" TEXT DEFAULT 'PAYG',
    "hourlyCost" DECIMAL(10,4),
    "cpu" INTEGER,
    "memory" INTEGER,
    "customDomain" TEXT,
    "subdomain" TEXT,
    "envVarsJson" JSONB NOT NULL DEFAULT '[]',
    "metadataJson" JSONB,
    "lastDeployedAt" TIMESTAMP(3),
    "lastDeployStatus" "StackStatus",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationStack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deployment" (
    "id" TEXT NOT NULL,
    "stackId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" "StackStatus" NOT NULL DEFAULT 'QUEUED',
    "triggerType" "DeploySource" NOT NULL DEFAULT 'MANUAL',
    "commitSha" TEXT,
    "commitMessage" TEXT,
    "commitAuthor" TEXT,
    "branchName" TEXT NOT NULL DEFAULT 'main',
    "manifestPushed" BOOLEAN NOT NULL DEFAULT false,
    "manifestPushedAt" TIMESTAMP(3),
    "argocdSynced" BOOLEAN NOT NULL DEFAULT false,
    "argocdSyncedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "rollbackOfId" TEXT,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deployment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeployEvent" (
    "id" TEXT NOT NULL,
    "deploymentId" TEXT NOT NULL,
    "type" "DeployEventType" NOT NULL,
    "message" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeployEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeploymentLog" (
    "id" TEXT NOT NULL,
    "deploymentId" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'runtime',
    "status" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeploymentLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GithubWebhookEvent" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "action" TEXT,
    "githubInstallationId" BIGINT,
    "githubRepositoryId" BIGINT,
    "repositoryFullName" TEXT,
    "repositoryOwner" TEXT,
    "repositoryName" TEXT,
    "ref" TEXT,
    "branch" TEXT,
    "commitSha" TEXT,
    "commitMessage" TEXT,
    "commitAuthorName" TEXT,
    "commitAuthorEmail" TEXT,
    "commitUrl" TEXT,
    "senderLogin" TEXT,
    "senderAvatarUrl" TEXT,
    "repositoryConnectionId" TEXT,
    "applicationStackId" TEXT,
    "eventDisposition" TEXT NOT NULL DEFAULT 'tracked',
    "ignoreReason" TEXT,
    "responseStatus" INTEGER,
    "handlerDurationMs" INTEGER,
    "payloadJson" JSONB NOT NULL,
    "payloadSha256" TEXT NOT NULL,
    "signatureValid" BOOLEAN NOT NULL,
    "enqueueStatus" TEXT NOT NULL DEFAULT 'queued',
    "processStatus" TEXT NOT NULL DEFAULT 'pending',
    "processError" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "deleteReason" TEXT,
    "permanentDeleteAfter" TIMESTAMP(3),

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
    "tenantId" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "status" "BillingAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
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
    "type" TEXT,
    "paymentMethod" TEXT,
    "gatewayId" TEXT,
    "dueDate" TIMESTAMP(3),
    "metadata" JSONB,
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
CREATE TABLE "Region" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "flag" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Region_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Package" (
    "id" TEXT NOT NULL,
    "code" "ServiceType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Package_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServicePlan" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "resources" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServicePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pricing" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "type" "SubscriptionType" NOT NULL,
    "billingMode" "BillingMode" NOT NULL,
    "basePriceIdr" DECIMAL(12,2) NOT NULL,
    "monthlyCapIdr" DECIMAL(12,2),
    "unitRateCpu" DECIMAL(12,4),
    "unitRateMem" DECIMAL(12,4),
    "unitRateMessage" DECIMAL(12,4),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "pricingId" TEXT NOT NULL,
    "type" "SubscriptionType" NOT NULL,
    "billingMode" "BillingMode" NOT NULL,
    "status" "BillingSubscriptionStatus2" NOT NULL DEFAULT 'ACTIVE',
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "allocatedConfig" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VpnClient" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "provider" "VpnProvider" NOT NULL DEFAULT 'OPENVPN',
    "regionCode" "VpnRegionCode" NOT NULL DEFAULT 'INDONESIA',
    "clientName" TEXT NOT NULL,
    "status" "VpnClientStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "encryptedConfig" TEXT,
    "createdBy" TEXT,
    "revokedAt" TIMESTAMP(3),
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VpnClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageLedger" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "category" TEXT,
    "amountIdr" DECIMAL(12,2),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageLedger_pkey" PRIMARY KEY ("id")
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

-- CreateTable
CREATE TABLE "PaymentGateway" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "supportedCurrencies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentGateway_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL,
    "gatewayId" TEXT,
    "bankCode" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "supportedCurrencies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "swiftCode" TEXT,
    "bankAddress" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Currency" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "isBase" BOOLEAN NOT NULL DEFAULT false,
    "ratePerBase" DECIMAL(18,6) NOT NULL DEFAULT 1,
    "minTopup" DECIMAL(18,2) NOT NULL,
    "maxTopup" DECIMAL(18,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Currency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentConfirmation" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "paymentDateTime" TIMESTAMP(3) NOT NULL,
    "senderBankName" TEXT,
    "senderName" TEXT,
    "senderAccount" TEXT,
    "screenshotUrl" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentConfirmation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "actorId" TEXT,
    "details" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Voucher" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "prefix" TEXT,
    "status" "VoucherStatus" NOT NULL DEFAULT 'ACTIVE',
    "maxClaims" INTEGER NOT NULL DEFAULT 1,
    "claimedCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "targetWorkosUserId" TEXT,
    "targetOrganizationId" TEXT,
    "createdByWorkosUserId" TEXT NOT NULL,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Voucher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoucherClaim" (
    "id" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "workosUserId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "billingAdjustmentId" TEXT,
    "metadataJson" JSONB,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoucherClaim_pkey" PRIMARY KEY ("id")
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
CREATE INDEX "DetectorRule_isActive_idx" ON "DetectorRule"("isActive");

-- CreateIndex
CREATE INDEX "RuntimeMapping_frameworkId_isActive_idx" ON "RuntimeMapping"("frameworkId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "RuntimeMapping_frameworkId_frameworkVersion_runtimeId_key" ON "RuntimeMapping"("frameworkId", "frameworkVersion", "runtimeId");

-- CreateIndex
CREATE INDEX "InspectionLog_repoUrl_idx" ON "InspectionLog"("repoUrl");

-- CreateIndex
CREATE INDEX "InspectionLog_detectedFramework_idx" ON "InspectionLog"("detectedFramework");

-- CreateIndex
CREATE INDEX "InspectionLog_status_idx" ON "InspectionLog"("status");

-- CreateIndex
CREATE INDEX "InspectionLog_createdAt_idx" ON "InspectionLog"("createdAt");

-- CreateIndex
CREATE INDEX "ApplicationStack_organizationId_idx" ON "ApplicationStack"("organizationId");

-- CreateIndex
CREATE INDEX "ApplicationStack_repositoryConnectionId_idx" ON "ApplicationStack"("repositoryConnectionId");

-- CreateIndex
CREATE INDEX "ApplicationStack_status_idx" ON "ApplicationStack"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationStack_organizationId_slug_key" ON "ApplicationStack"("organizationId", "slug");

-- CreateIndex
CREATE INDEX "Deployment_stackId_idx" ON "Deployment"("stackId");

-- CreateIndex
CREATE INDEX "Deployment_organizationId_idx" ON "Deployment"("organizationId");

-- CreateIndex
CREATE INDEX "Deployment_status_idx" ON "Deployment"("status");

-- CreateIndex
CREATE INDEX "Deployment_createdAt_idx" ON "Deployment"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "DeployEvent_deploymentId_idx" ON "DeployEvent"("deploymentId");

-- CreateIndex
CREATE INDEX "DeployEvent_type_idx" ON "DeployEvent"("type");

-- CreateIndex
CREATE INDEX "DeployEvent_createdAt_idx" ON "DeployEvent"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "DeploymentLog_deploymentId_idx" ON "DeploymentLog"("deploymentId");

-- CreateIndex
CREATE INDEX "DeploymentLog_timestamp_idx" ON "DeploymentLog"("timestamp" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "GithubWebhookEvent_deliveryId_key" ON "GithubWebhookEvent"("deliveryId");

-- CreateIndex
CREATE INDEX "GithubWebhookEvent_eventName_idx" ON "GithubWebhookEvent"("eventName");

-- CreateIndex
CREATE INDEX "GithubWebhookEvent_githubInstallationId_idx" ON "GithubWebhookEvent"("githubInstallationId");

-- CreateIndex
CREATE INDEX "GithubWebhookEvent_githubRepositoryId_idx" ON "GithubWebhookEvent"("githubRepositoryId");

-- CreateIndex
CREATE INDEX "GithubWebhookEvent_githubInstallationId_githubRepositoryId_idx" ON "GithubWebhookEvent"("githubInstallationId", "githubRepositoryId");

-- CreateIndex
CREATE INDEX "GithubWebhookEvent_repositoryConnectionId_idx" ON "GithubWebhookEvent"("repositoryConnectionId");

-- CreateIndex
CREATE INDEX "GithubWebhookEvent_applicationStackId_idx" ON "GithubWebhookEvent"("applicationStackId");

-- CreateIndex
CREATE INDEX "GithubWebhookEvent_repositoryFullName_idx" ON "GithubWebhookEvent"("repositoryFullName");

-- CreateIndex
CREATE INDEX "GithubWebhookEvent_branch_idx" ON "GithubWebhookEvent"("branch");

-- CreateIndex
CREATE INDEX "GithubWebhookEvent_commitSha_idx" ON "GithubWebhookEvent"("commitSha");

-- CreateIndex
CREATE INDEX "GithubWebhookEvent_senderLogin_idx" ON "GithubWebhookEvent"("senderLogin");

-- CreateIndex
CREATE INDEX "GithubWebhookEvent_eventDisposition_idx" ON "GithubWebhookEvent"("eventDisposition");

-- CreateIndex
CREATE INDEX "GithubWebhookEvent_eventName_processStatus_idx" ON "GithubWebhookEvent"("eventName", "processStatus");

-- CreateIndex
CREATE INDEX "GithubWebhookEvent_processStatus_idx" ON "GithubWebhookEvent"("processStatus");

-- CreateIndex
CREATE INDEX "GithubWebhookEvent_deletedAt_idx" ON "GithubWebhookEvent"("deletedAt");

-- CreateIndex
CREATE INDEX "GithubWebhookEvent_permanentDeleteAfter_idx" ON "GithubWebhookEvent"("permanentDeleteAfter");

-- CreateIndex
CREATE INDEX "GithubWebhookEvent_receivedAt_idx" ON "GithubWebhookEvent"("receivedAt" DESC);

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
CREATE UNIQUE INDEX "Region_code_key" ON "Region"("code");

-- CreateIndex
CREATE INDEX "Region_isActive_idx" ON "Region"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Package_code_key" ON "Package"("code");

-- CreateIndex
CREATE INDEX "Package_code_idx" ON "Package"("code");

-- CreateIndex
CREATE INDEX "ServicePlan_packageId_idx" ON "ServicePlan"("packageId");

-- CreateIndex
CREATE UNIQUE INDEX "ServicePlan_packageId_code_key" ON "ServicePlan"("packageId", "code");

-- CreateIndex
CREATE INDEX "Pricing_planId_idx" ON "Pricing"("planId");

-- CreateIndex
CREATE INDEX "Pricing_regionId_idx" ON "Pricing"("regionId");

-- CreateIndex
CREATE UNIQUE INDEX "Pricing_planId_regionId_type_billingMode_key" ON "Pricing"("planId", "regionId", "type", "billingMode");

-- CreateIndex
CREATE INDEX "Subscription_tenantId_status_idx" ON "Subscription"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Subscription_packageId_idx" ON "Subscription"("packageId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_tenantId_packageId_planId_key" ON "Subscription"("tenantId", "packageId", "planId");

-- CreateIndex
CREATE INDEX "VpnClient_organizationId_status_idx" ON "VpnClient"("organizationId", "status");

-- CreateIndex
CREATE INDEX "VpnClient_subscriptionId_idx" ON "VpnClient"("subscriptionId");

-- CreateIndex
CREATE INDEX "VpnClient_currentPeriodEnd_idx" ON "VpnClient"("currentPeriodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "VpnClient_provider_clientName_key" ON "VpnClient"("provider", "clientName");

-- CreateIndex
CREATE INDEX "UsageLedger_tenantId_period_idx" ON "UsageLedger"("tenantId", "period");

-- CreateIndex
CREATE INDEX "UsageLedger_tenantId_category_idx" ON "UsageLedger"("tenantId", "category");

-- CreateIndex
CREATE INDEX "UsageLedger_subscriptionId_idx" ON "UsageLedger"("subscriptionId");

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

-- CreateIndex
CREATE INDEX "PaymentGateway_type_isActive_idx" ON "PaymentGateway"("type", "isActive");

-- CreateIndex
CREATE INDEX "BankAccount_gatewayId_isActive_idx" ON "BankAccount"("gatewayId", "isActive");

-- CreateIndex
CREATE INDEX "BankAccount_bankCode_idx" ON "BankAccount"("bankCode");

-- CreateIndex
CREATE INDEX "BankAccount_currency_isActive_idx" ON "BankAccount"("currency", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Currency_code_key" ON "Currency"("code");

-- CreateIndex
CREATE INDEX "Currency_isActive_idx" ON "Currency"("isActive");

-- CreateIndex
CREATE INDEX "PaymentConfirmation_invoiceId_idx" ON "PaymentConfirmation"("invoiceId");

-- CreateIndex
CREATE INDEX "PaymentConfirmation_bankAccountId_idx" ON "PaymentConfirmation"("bankAccountId");

-- CreateIndex
CREATE INDEX "PaymentConfirmation_status_idx" ON "PaymentConfirmation"("status");

-- CreateIndex
CREATE INDEX "PaymentConfirmation_createdAt_idx" ON "PaymentConfirmation"("createdAt");

-- CreateIndex
CREATE INDEX "PaymentAuditLog_entityType_entityId_idx" ON "PaymentAuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "PaymentAuditLog_action_idx" ON "PaymentAuditLog"("action");

-- CreateIndex
CREATE INDEX "PaymentAuditLog_createdAt_idx" ON "PaymentAuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Voucher_code_key" ON "Voucher"("code");

-- CreateIndex
CREATE INDEX "Voucher_status_expiresAt_idx" ON "Voucher"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "Voucher_targetWorkosUserId_idx" ON "Voucher"("targetWorkosUserId");

-- CreateIndex
CREATE INDEX "Voucher_targetOrganizationId_idx" ON "Voucher"("targetOrganizationId");

-- CreateIndex
CREATE INDEX "Voucher_code_status_idx" ON "Voucher"("code", "status");

-- CreateIndex
CREATE INDEX "VoucherClaim_workosUserId_claimedAt_idx" ON "VoucherClaim"("workosUserId", "claimedAt" DESC);

-- CreateIndex
CREATE INDEX "VoucherClaim_voucherId_claimedAt_idx" ON "VoucherClaim"("voucherId", "claimedAt" DESC);

-- CreateIndex
CREATE INDEX "VoucherClaim_organizationId_idx" ON "VoucherClaim"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "VoucherClaim_voucherId_workosUserId_key" ON "VoucherClaim"("voucherId", "workosUserId");

-- AddForeignKey
ALTER TABLE "GithubRepositoryConnection" ADD CONSTRAINT "GithubRepositoryConnection_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "GithubInstallation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationStack" ADD CONSTRAINT "ApplicationStack_repositoryConnectionId_fkey" FOREIGN KEY ("repositoryConnectionId") REFERENCES "GithubRepositoryConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deployment" ADD CONSTRAINT "Deployment_stackId_fkey" FOREIGN KEY ("stackId") REFERENCES "ApplicationStack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeployEvent" ADD CONSTRAINT "DeployEvent_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "Deployment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeploymentLog" ADD CONSTRAINT "DeploymentLog_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "Deployment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_gatewayId_fkey" FOREIGN KEY ("gatewayId") REFERENCES "PaymentGateway"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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
ALTER TABLE "ServicePlan" ADD CONSTRAINT "ServicePlan_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pricing" ADD CONSTRAINT "Pricing_planId_fkey" FOREIGN KEY ("planId") REFERENCES "ServicePlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pricing" ADD CONSTRAINT "Pricing_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "ServicePlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_pricingId_fkey" FOREIGN KEY ("pricingId") REFERENCES "Pricing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VpnClient" ADD CONSTRAINT "VpnClient_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageLedger" ADD CONSTRAINT "UsageLedger_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_gatewayId_fkey" FOREIGN KEY ("gatewayId") REFERENCES "PaymentGateway"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentConfirmation" ADD CONSTRAINT "PaymentConfirmation_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentConfirmation" ADD CONSTRAINT "PaymentConfirmation_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherClaim" ADD CONSTRAINT "VoucherClaim_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "Voucher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
