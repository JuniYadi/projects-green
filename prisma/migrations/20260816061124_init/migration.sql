-- CreateEnum
CREATE TYPE "ApiKeyEnvironment" AS ENUM ('SANDBOX', 'LIVE');

-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('NONE', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "AppCredentialType" AS ENUM ('GITHUB_APP', 'GITHUB_TOKEN', 'CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_LEGACY_TOKEN');

-- CreateEnum
CREATE TYPE "AppCredentialStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED', 'PENDING');

-- CreateEnum
CREATE TYPE "StackStatus" AS ENUM ('IDLE', 'QUEUED', 'BUILDING', 'DEPLOYING', 'RUNNING', 'FAILED');

-- CreateEnum
CREATE TYPE "DeploySource" AS ENUM ('GITHUB', 'TEMPLATE', 'PUBLIC', 'MANUAL');

-- CreateEnum
CREATE TYPE "ApplicationDeployEventType" AS ENUM ('QUEUED', 'BUILD_STARTED', 'JENKINS_JOB_TRIGGERED', 'JENKINS_BUILD_QUEUED', 'JENKINS_BUILD_RUNNING', 'JENKINS_BUILD_COMPLETED', 'IMAGE_TAG_RECEIVED', 'GITOPS_COMMIT_CREATED', 'MANIFEST_PUSHED', 'ARGOCD_SYNC_STARTED', 'ARGOCD_SYNCED', 'POD_READY', 'DEPLOY_COMPLETED', 'DEPLOY_FAILED', 'ROLLBACK_STARTED', 'ROLLBACK_COMPLETED');

-- CreateEnum
CREATE TYPE "SupportTicketDepartment" AS ENUM ('BILLING', 'TECHNICAL', 'ACCOUNT', 'COMPLIANCE');

-- CreateEnum
CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_RESPONSE', 'ON_HOLD', 'RESOLVED', 'CLOSED');

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
CREATE TYPE "BillingPeriod" AS ENUM ('MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL', 'YEARLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "BillingOrderStatus" AS ENUM ('PENDING', 'CHARGED', 'FULFILLED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BillingChargeUnit" AS ENUM ('SUBSCRIPTION', 'DEVICE');

-- CreateEnum
CREATE TYPE "VoucherKind" AS ENUM ('BALANCE_CREDIT', 'PRODUCT_PROMOTION');

-- CreateEnum
CREATE TYPE "VoucherDiscountType" AS ENUM ('PERCENTAGE', 'FIXED');

-- CreateEnum
CREATE TYPE "VoucherCurrencyPolicy" AS ENUM ('MATCH_CURRENCY_ONLY', 'CONVERT_AT_CHECKOUT', 'CONVERT_AT_REDEMPTION');

-- CreateEnum
CREATE TYPE "ServiceAddonBillingMode" AS ENUM ('RECURRING', 'ONE_TIME', 'USAGE');

-- CreateEnum
CREATE TYPE "MeterAggregation" AS ENUM ('SUM', 'MAX', 'LAST', 'COUNT');

-- CreateEnum
CREATE TYPE "BillingInvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'OPEN', 'PAID', 'OVERDUE', 'CANCELLED', 'VOID', 'UNCOLLECTIBLE');

-- CreateEnum
CREATE TYPE "BillingInvoiceLineType" AS ENUM ('SUBSCRIPTION', 'METERED', 'ADJUSTMENT', 'TAX', 'CREDIT');

-- CreateEnum
CREATE TYPE "BillingInvoiceLineSourceType" AS ENUM ('RATED_USAGE', 'ADJUSTMENT', 'MANUAL');

-- CreateEnum
CREATE TYPE "BillingAdjustmentType" AS ENUM ('CREDIT', 'DEBIT', 'WRITEOFF');

-- CreateEnum
CREATE TYPE "BillingRunType" AS ENUM ('RATING', 'INVOICING', 'FINALIZATION', 'RECONCILIATION');

-- CreateEnum
CREATE TYPE "BillingRunStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "BillingAuditAction" AS ENUM ('CREATED', 'UPDATED', 'DELETED', 'RUN_STARTED', 'RUN_FINISHED', 'INVOICE_GENERATED', 'PAYMENT_CONFIRMED', 'ORDER_CREATED', 'BALANCE_ADJUSTED', 'TOPUP_PERFORMED', 'SUBSCRIPTION_ACTIVATED', 'SUBSCRIPTION_CANCELLED', 'SUBSCRIPTION_REINSTATED', 'CONTACT_ADDED', 'CONTACT_REMOVED', 'SETTINGS_CHANGED');

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
CREATE TYPE "BillingCurrency" AS ENUM ('USD', 'IDR');

-- CreateEnum
CREATE TYPE "BillingContactRole" AS ENUM ('OWNER', 'FINANCE', 'ACCOUNTING', 'GENERAL');

-- CreateEnum
CREATE TYPE "VpnProvider" AS ENUM ('OPENVPN', 'WIREGUARD');

-- CreateEnum
CREATE TYPE "VpnRegionCode" AS ENUM ('INDONESIA');

-- CreateEnum
CREATE TYPE "VpnClientStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED', 'PROVISIONING_FAILED');

-- CreateEnum
CREATE TYPE "VpnServerHealth" AS ENUM ('HEALTHY', 'WARNING', 'DOWN', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "AdjustmentType" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "VpnProtocol" AS ENUM ('OPENVPN', 'WIREGUARD', 'PROXY');

-- CreateEnum
CREATE TYPE "VpnSubscriptionStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "VpnProvisioningStatus" AS ENUM ('PENDING', 'PROVISIONING', 'ACTIVE', 'FAILED', 'REVOKED');

-- CreateEnum
CREATE TYPE "VpnDeviceStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'REVOKED');

-- CreateEnum
CREATE TYPE "VpnPairingMethod" AS ENUM ('SSO', 'QR');

-- CreateEnum
CREATE TYPE "VpnMobileSessionStatus" AS ENUM ('ACTIVE', 'STALE', 'CLOSED');

-- CreateEnum
CREATE TYPE "WhatsappDeviceStatus" AS ENUM ('ACTIVE', 'NON_ACTIVE', 'DISCONNECTED', 'UNKNOWN');

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
CREATE TYPE "WhatsappBillingCategory" AS ENUM ('MARKETING', 'UTILITY', 'AUTHENTICATION', 'SERVICE', 'REPLY');

-- CreateEnum
CREATE TYPE "WhatsappBillingStatus" AS ENUM ('CHARGED_PENDING_VERIFY', 'CONFIRMED', 'REVERTED_FAILED');

-- CreateEnum
CREATE TYPE "WhatsappApiKeyEnvironment" AS ENUM ('SANDBOX', 'LIVE');

-- CreateEnum
CREATE TYPE "WhatsappOrganizationApiKeyStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'DEAD_LETTERED');

-- CreateEnum
CREATE TYPE "EmailLogType" AS ENUM ('TICKET_CREATED', 'TICKET_REPLIED', 'TICKET_CLOSED', 'TICKET_ADMIN_ALERT', 'INVOICE_CREATED', 'INVOICE_PAYMENT_REMINDER', 'INVOICE_PAID', 'INVOICE_OVERDUE', 'INVOICE_CANCELLED', 'VPN_SUBSCRIPTION_CREATED', 'VPN_PROVISIONING_SUCCESS', 'VPN_PROVISIONING_FAILED', 'VPN_RENEWAL_SUCCESS', 'VPN_RENEWAL_FAILED', 'VPN_SUBSCRIPTION_SUSPENDED', 'VPN_SUBSCRIPTION_EXPIRED', 'VPN_SUBSCRIPTION_CANCELLED');

-- CreateEnum
CREATE TYPE "EmailLogStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'BOUNCED');

-- CreateEnum
CREATE TYPE "VoucherStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'DEPLETED', 'DISABLED');

-- CreateEnum
CREATE TYPE "AppHostingClusterStatus" AS ENUM ('PLANNED', 'ACTIVE', 'DEPRECATED');

-- CreateEnum
CREATE TYPE "AppHostingClusterIntegrationType" AS ENUM ('JENKINS', 'GITOPS', 'REGISTRY', 'ARGOCD', 'KUBECONFIG', 'OPENSEARCH', 'PROMETHEUS');

-- CreateEnum
CREATE TYPE "AppManagedServiceType" AS ENUM ('MYSQL', 'POSTGRESQL', 'REDIS');

-- CreateEnum
CREATE TYPE "AppManagedServiceCredentialStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ApplicationDomainKind" AS ENUM ('MANAGED', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ApplicationDomainDnsStatus" AS ENUM ('PENDING', 'VERIFIED', 'FAILED');

-- CreateEnum
CREATE TYPE "ApplicationDomainCertificateSource" AS ENUM ('MANAGED', 'UPLOADED');

-- CreateEnum
CREATE TYPE "ApplicationDomainCertificateStatus" AS ENUM ('PENDING', 'ACTIVE', 'EXPIRED', 'INVALID', 'REVOKED');

-- CreateEnum
CREATE TYPE "ApplicationDomainAllowlistMode" AS ENUM ('OPEN', 'ALLOWLIST_ONLY');

-- CreateEnum
CREATE TYPE "AiDeploymentSessionStatus" AS ENUM ('COLLECTING', 'INSPECTING', 'BLOCKED', 'PLAN_READY', 'CONFIRMED', 'EXECUTING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AiDeploymentSourceType" AS ENUM ('SOURCE', 'TEMPLATE');

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

    CONSTRAINT "DRM_pkey" PRIMARY KEY ("id")
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
    "aiTrace" JSONB,
    "providerDiagnostics" JSONB,
    "reasoning" TEXT[],
    "warnings" TEXT[],
    "durationMs" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'success',
    "blockedByRuleId" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DetectorInspectionLog_pkey" PRIMARY KEY ("id")
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
    "publicSourceUrl" TEXT,
    "publicSourceRef" TEXT,
    "branchName" TEXT NOT NULL DEFAULT 'main',
    "rootDirectory" TEXT NOT NULL DEFAULT '/',
    "framework" TEXT,
    "buildCommand" TEXT,
    "dockerfileDetected" BOOLEAN NOT NULL DEFAULT false,
    "resourcePlanId" TEXT,
    "clusterId" TEXT,
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
    "sourceUrl" TEXT,
    "sourceRef" TEXT,
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
    "type" "ApplicationDeployEventType" NOT NULL,
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
    "preferredCurrency" "BillingCurrency" NOT NULL DEFAULT 'USD',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "status" "BillingAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingContact" (
    "id" TEXT NOT NULL,
    "billingAccountId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "BillingContactRole" NOT NULL DEFAULT 'GENERAL',
    "notifyOnInvoice" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnLowBalance" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnSupport" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingContact_pkey" PRIMARY KEY ("id")
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

    CONSTRAINT "ServiceSubscriptionVersion_pkey" PRIMARY KEY ("id")
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
    "status" "BillingInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
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
CREATE TABLE "BillingOrder" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "billingAccountId" TEXT NOT NULL,
    "serviceSubscriptionId" TEXT,
    "billingInvoiceId" TEXT,
    "voucherId" TEXT,
    "voucherCode" TEXT,
    "voucherCurrency" TEXT,
    "voucherExchangeRate" DECIMAL(18,8),
    "voucherRateAt" TIMESTAMP(3),
    "voucherQuoteExpiresAt" TIMESTAMP(3),
    "status" "BillingOrderStatus" NOT NULL DEFAULT 'PENDING',
    "currency" TEXT NOT NULL,
    "subtotalAmount" DECIMAL(18,2) NOT NULL,
    "discountAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "chargedAt" TIMESTAMP(3),
    "fulfilledAt" TIMESTAMP(3),
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingOrderLine" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "pricingId" TEXT,
    "packageCode" "ServiceType" NOT NULL,
    "planCode" TEXT NOT NULL,
    "regionCode" TEXT NOT NULL,
    "billingPeriod" "BillingPeriod" NOT NULL,
    "chargeUnit" "BillingChargeUnit" NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "unitPrice" DECIMAL(18,2) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "metadataJson" JSONB,

    CONSTRAINT "BillingOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLine" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "lineType" "BillingInvoiceLineType" NOT NULL,
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
    "sourceType" "BillingInvoiceLineSourceType" NOT NULL,
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
    "billingPeriod" "BillingPeriod",
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "periodPrice" DECIMAL(18,2),
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "chargeUnit" "BillingChargeUnit" NOT NULL DEFAULT 'SUBSCRIPTION',
    "minimumCommitmentCycles" INTEGER,
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
CREATE TABLE "ServiceAddon" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "billingMode" "ServiceAddonBillingMode" NOT NULL DEFAULT 'RECURRING',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceAddon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceAddonPricing" (
    "id" TEXT NOT NULL,
    "addonId" TEXT NOT NULL,
    "billingPeriod" "BillingPeriod" NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "amount" DECIMAL(18,2) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceAddonPricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServicePlanAddon" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "addonId" TEXT NOT NULL,
    "label" TEXT,
    "description" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "enabledTerms" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServicePlanAddon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceSubscriptionAddon" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "addonId" TEXT NOT NULL,
    "billingPeriod" "BillingPeriod" NOT NULL,
    "priceLocked" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "quantity" DECIMAL(18,6) NOT NULL DEFAULT 1,
    "status" "BillingSubscriptionStatus2" NOT NULL DEFAULT 'ACTIVE',
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceSubscriptionAddon_pkey" PRIMARY KEY ("id")
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
    "billingPeriod" "BillingPeriod" NOT NULL DEFAULT 'MONTHLY',
    "priceLocked" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "quantity" DECIMAL(18,6) NOT NULL DEFAULT 1,
    "status" "BillingSubscriptionStatus2" NOT NULL DEFAULT 'ACTIVE',
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "commitmentEndsAt" TIMESTAMP(3),
    "allocatedConfig" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceSubscription_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "VpnRegion" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VpnRegion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VpnSshKey" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "privateKey" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VpnSshKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VpnServer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "ipAddress" TEXT,
    "sshPort" INTEGER NOT NULL DEFAULT 22,
    "sshKeyId" TEXT NOT NULL,
    "sshUser" TEXT NOT NULL DEFAULT 'root',
    "hasOpenVpn" BOOLEAN NOT NULL DEFAULT false,
    "openVpnPort" INTEGER,
    "hasWireGuard" BOOLEAN NOT NULL DEFAULT false,
    "wireGuardPort" INTEGER,
    "wireGuardPublicKey" TEXT,
    "wireGuardSubnet" TEXT,
    "hasProxy" BOOLEAN NOT NULL DEFAULT false,
    "proxyPort" INTEGER,
    "health" "VpnServerHealth" NOT NULL DEFAULT 'UNKNOWN',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VpnServer_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "VpnPackage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "servicePlanId" TEXT NOT NULL,
    "price" DECIMAL(12,2),
    "currency" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VpnPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VpnPackageServer" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VpnPackageServer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VpnSubscription" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "serviceSubscriptionId" TEXT,
    "status" "VpnSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "priceLocked" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "originalPrice" DECIMAL(12,2),
    "originalCurrency" TEXT,
    "exchangeRate" DECIMAL(18,6),
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "renewalFailedAt" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VpnSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VpnServerAccount" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "protocol" "VpnProtocol" NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT,
    "configEncrypted" TEXT,
    "provisioningStatus" "VpnProvisioningStatus" NOT NULL DEFAULT 'PENDING',
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VpnServerAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VpnMobileDevice" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "userId" TEXT,
    "deviceName" TEXT NOT NULL,
    "deviceFingerprint" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "osVersion" TEXT,
    "appVersion" TEXT,
    "pairedVia" "VpnPairingMethod" NOT NULL,
    "status" "VpnDeviceStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastSeenAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,
    "revokedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VpnMobileDevice_pkey" PRIMARY KEY ("id")
);

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
CREATE TABLE "VpnPairingToken" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "claimedAt" TIMESTAMP(3),
    "claimedByDevice" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VpnPairingToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VpnAuditLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "subscriptionId" TEXT,
    "serverId" TEXT,
    "correlationId" TEXT,
    "message" TEXT,
    "errorMessage" TEXT,
    "requestPayload" JSONB,
    "responsePayload" JSONB,
    "durationMs" INTEGER,
    "serverAccountId" TEXT,
    "deviceId" TEXT,
    "userId" TEXT,
    "adminId" TEXT,
    "action" TEXT NOT NULL,
    "step" TEXT,
    "status" TEXT,
    "details" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VpnAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsappMetaApp" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "metaAppId" TEXT NOT NULL,
    "appSecretEncrypted" TEXT NOT NULL,
    "verifyTokenEncrypted" TEXT NOT NULL,
    "webhookKey" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappMetaApp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsappDevice" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "quotaBase" DECIMAL(12,2) NOT NULL DEFAULT 1000,
    "currentQuotaUsed" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "quotaBaseOut" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "addonQuota" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "addonQuotaTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "dailyLimitMessage" INTEGER NOT NULL DEFAULT 1000,
    "rates" TEXT,
    "status" "WhatsappDeviceStatus" NOT NULL DEFAULT 'ACTIVE',
    "token" TEXT,
    "tokenEncrypted" TEXT,
    "tokenIv" TEXT,
    "s3Path" TEXT,
    "whatsappBusinessAccountId" TEXT,
    "whatsappPhoneId" TEXT,
    "whatsappMetaAppId" TEXT,
    "whatsappApplicationId" TEXT,
    "whatsappVersion" TEXT NOT NULL DEFAULT 'v24.0',
    "whatsappProfile" JSONB,
    "features" JSONB,
    "callbackUrl" TEXT,
    "callbackHeaderName" TEXT,
    "callbackHeaderValue" TEXT,
    "expiredAt" TIMESTAMP(3),
    "lastHeartbeatAt" TIMESTAMP(3),
    "lastDisconnectedAt" TIMESTAMP(3),
    "appSecret" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsappQuotaCreditRate" (
    "category" "WhatsappBillingCategory" NOT NULL,
    "country" VARCHAR(2) NOT NULL,
    "quota_credit" DECIMAL(12,2) NOT NULL,
    "description" VARCHAR(255) NOT NULL,

    CONSTRAINT "WhatsappQuotaCreditRate_pkey" PRIMARY KEY ("category","country")
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
    "category" "WhatsappBillingCategory",
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
    "internalNotes" TEXT,

    CONSTRAINT "WhatsappConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsappConversationLabel" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "color" VARCHAR(7),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappConversationLabel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsappConversationLabelOnConversation" (
    "conversationId" TEXT NOT NULL,
    "labelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsappConversationLabelOnConversation_pkey" PRIMARY KEY ("conversationId","labelId")
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
CREATE TABLE "WhatsappApiCall" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "operation" TEXT NOT NULL,
    "phoneNumberId" TEXT,
    "status" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsappApiCall_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "WhatsappOrganizationApiKey" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "status" "WhatsappOrganizationApiKeyStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdByWorkosUserId" TEXT,
    "rotatedByWorkosUserId" TEXT,
    "revokedByWorkosUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rotatedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "lastUsedIp" TEXT,
    "lastUsedUserAgent" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappOrganizationApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsappWebhook" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "whatsappDeviceId" TEXT NOT NULL,
    "webhookUrl" TEXT NOT NULL,
    "verifyToken" TEXT NOT NULL,
    "authType" TEXT DEFAULT 'none',
    "authValue" TEXT,
    "authHeaderName" TEXT,
    "retryMaxAttempts" INTEGER NOT NULL DEFAULT 3,
    "retryIntervalMs" INTEGER NOT NULL DEFAULT 5000,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappWebhook_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "WhatsappWebhookEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "whatsappDeviceId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "processingStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "metaPayload" JSONB NOT NULL,
    "waMessageId" TEXT,
    "errorMessage" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsappWebhookEvent_pkey" PRIMARY KEY ("id")
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

-- CreateTable
CREATE TABLE "WhatsappQuotaAlert" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "whatsappDeviceId" TEXT NOT NULL,
    "threshold" INTEGER NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsappQuotaAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT,
    "ticketNumber" TEXT,
    "recipientEmail" TEXT NOT NULL,
    "type" "EmailLogType" NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "EmailLogStatus" NOT NULL DEFAULT 'QUEUED',
    "errorMessage" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3),
    "organizationId" TEXT,
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "bodyHtml" TEXT,
    "providerMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
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
    "minBalanceWarn" DECIMAL(18,2) NOT NULL DEFAULT 0,
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
    "kind" "VoucherKind" NOT NULL DEFAULT 'BALANCE_CREDIT',
    "discountType" "VoucherDiscountType",
    "discountValue" DECIMAL(65,30),
    "discountCurrency" TEXT,
    "currencyPolicy" "VoucherCurrencyPolicy" NOT NULL DEFAULT 'MATCH_CURRENCY_ONLY',
    "firstCheckoutOnly" BOOLEAN NOT NULL DEFAULT false,
    "allowUpgrade" BOOLEAN NOT NULL DEFAULT false,
    "stackable" BOOLEAN NOT NULL DEFAULT false,
    "minimumOrderAmount" DECIMAL(65,30),
    "maximumDiscountAmount" DECIMAL(65,30),
    "maxClaims" INTEGER NOT NULL DEFAULT 1,
    "claimedCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "targetWorkosUserId" TEXT,
    "targetOrganizationId" TEXT,
    "allowedPackageCodes" JSONB,
    "allowedPlanCodes" JSONB,
    "allowedBillingPeriods" JSONB,
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
    "orderId" TEXT,
    "billingAdjustmentId" TEXT,
    "discountAmount" DECIMAL(65,30),
    "discountCurrency" TEXT,
    "exchangeRate" DECIMAL(18,8),
    "rateAt" TIMESTAMP(3),
    "quoteExpiresAt" TIMESTAMP(3),
    "metadataJson" JSONB,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoucherClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsappAuditLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "deviceId" TEXT,
    "adminId" TEXT,
    "correlationId" TEXT,
    "action" TEXT NOT NULL,
    "status" TEXT,
    "message" TEXT,
    "errorMessage" TEXT,
    "details" JSONB,
    "durationMs" INTEGER,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsappAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsappCatalog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "metaCatalogId" TEXT NOT NULL,
    "deviceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsappCatalogProduct" (
    "id" TEXT NOT NULL,
    "catalogId" TEXT NOT NULL,
    "productRetailerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" TEXT,
    "currency" TEXT,
    "imageUrl" TEXT,
    "url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappCatalogProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CacheEntry" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CacheEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppCredential" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "AppCredentialType" NOT NULL,
    "name" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "encryptedJSON" TEXT NOT NULL,
    "maskedPreview" TEXT NOT NULL,
    "status" "AppCredentialStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppHostingCluster" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "status" "AppHostingClusterStatus" NOT NULL DEFAULT 'PLANNED',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppHostingCluster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppHostingClusterIntegration" (
    "id" TEXT NOT NULL,
    "clusterId" TEXT NOT NULL,
    "type" "AppHostingClusterIntegrationType" NOT NULL,
    "metaJson" JSONB NOT NULL DEFAULT '{}',
    "secretCiphertext" TEXT,
    "secretPreview" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppHostingClusterIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppManagedServiceCredential" (
    "id" TEXT NOT NULL,
    "clusterId" TEXT NOT NULL,
    "serviceType" "AppManagedServiceType" NOT NULL,
    "endpointHost" TEXT NOT NULL,
    "endpointPort" INTEGER NOT NULL,
    "tlsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "username" TEXT,
    "secretCiphertext" TEXT,
    "secretPreview" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppManagedServiceCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppHostingClusterEndpoint" (
    "id" TEXT NOT NULL,
    "clusterId" TEXT NOT NULL,
    "managedBaseDomain" TEXT NOT NULL,
    "cnameTarget" TEXT NOT NULL,
    "ipv4Addresses" TEXT[],
    "ipv6Addresses" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppHostingClusterEndpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationDomain" (
    "id" TEXT NOT NULL,
    "stackId" TEXT NOT NULL,
    "clusterId" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "kind" "ApplicationDomainKind" NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "dnsStatus" "ApplicationDomainDnsStatus" NOT NULL DEFAULT 'PENDING',
    "expectedCnameTarget" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "allowlistMode" "ApplicationDomainAllowlistMode" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationDomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationDomainCertificate" (
    "id" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "source" "ApplicationDomainCertificateSource" NOT NULL,
    "status" "ApplicationDomainCertificateStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3),
    "fingerprint" TEXT,
    "validationError" TEXT,
    "tlsSecretName" TEXT,
    "certificateCiphertext" TEXT,
    "privateKeyCiphertext" TEXT,
    "chainCiphertext" TEXT,
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationDomainCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationDomainAllowlistEntry" (
    "id" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "cidr" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationDomainAllowlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiDeploymentSession" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workosUserId" TEXT NOT NULL,
    "status" "AiDeploymentSessionStatus" NOT NULL DEFAULT 'COLLECTING',
    "sourceType" "AiDeploymentSourceType" NOT NULL DEFAULT 'SOURCE',
    "currentPlanVersion" INTEGER NOT NULL DEFAULT 1,
    "currentPlanHash" TEXT,
    "plan" JSONB,
    "serverContext" JSONB,
    "executionRefs" JSONB,
    "stackId" TEXT,
    "deploymentId" TEXT,
    "blockedReason" TEXT,
    "confirmedBy" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "confirmationPlanHash" TEXT,
    "idempotencyKey" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiDeploymentSession_pkey" PRIMARY KEY ("id")
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
CREATE INDEX "DRM_frameworkId_isActive_idx" ON "RuntimeMapping"("frameworkId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "DRM_frameworkId_frameworkVersion_runtimeId_key" ON "RuntimeMapping"("frameworkId", "frameworkVersion", "runtimeId");

-- CreateIndex
CREATE INDEX "DetectorInspectionLog_repoUrl_idx" ON "InspectionLog"("repoUrl");

-- CreateIndex
CREATE INDEX "DetectorInspectionLog_detectedFramework_idx" ON "InspectionLog"("detectedFramework");

-- CreateIndex
CREATE INDEX "DetectorInspectionLog_status_idx" ON "InspectionLog"("status");

-- CreateIndex
CREATE INDEX "DetectorInspectionLog_createdAt_idx" ON "InspectionLog"("createdAt");

-- CreateIndex
CREATE INDEX "ApplicationStack_organizationId_idx" ON "ApplicationStack"("organizationId");

-- CreateIndex
CREATE INDEX "ApplicationStack_repositoryConnectionId_idx" ON "ApplicationStack"("repositoryConnectionId");

-- CreateIndex
CREATE INDEX "ApplicationStack_status_idx" ON "ApplicationStack"("status");

-- CreateIndex
CREATE INDEX "ApplicationStack_clusterId_idx" ON "ApplicationStack"("clusterId");

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
CREATE UNIQUE INDEX "DeployEvent_deploymentId_type_key" ON "DeployEvent"("deploymentId", "type");

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
CREATE INDEX "BillingContact_billingAccountId_idx" ON "BillingContact"("billingAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingContact_billingAccountId_email_key" ON "BillingContact"("billingAccountId", "email");

-- CreateIndex
CREATE INDEX "BillingSubscription_billingAccountId_status_idx" ON "BillingSubscription"("billingAccountId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BillingSubscription_billingAccountId_externalKey_key" ON "BillingSubscription"("billingAccountId", "externalKey");

-- CreateIndex
CREATE INDEX "ServiceSubscriptionVersion_subscriptionId_effectiveFrom_idx" ON "SubscriptionVersion"("subscriptionId", "effectiveFrom" DESC);

-- CreateIndex
CREATE INDEX "ServiceSubscriptionVersion_planVersionId_idx" ON "SubscriptionVersion"("planVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceSubscriptionVersion_subscriptionId_version_key" ON "SubscriptionVersion"("subscriptionId", "version");

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
CREATE UNIQUE INDEX "BillingOrder_idempotencyKey_key" ON "BillingOrder"("idempotencyKey");

-- CreateIndex
CREATE INDEX "BillingOrder_organizationId_createdAt_idx" ON "BillingOrder"("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "BillingOrder_billingAccountId_status_idx" ON "BillingOrder"("billingAccountId", "status");

-- CreateIndex
CREATE INDEX "BillingOrder_billingInvoiceId_idx" ON "BillingOrder"("billingInvoiceId");

-- CreateIndex
CREATE INDEX "BillingOrder_serviceSubscriptionId_idx" ON "BillingOrder"("serviceSubscriptionId");

-- CreateIndex
CREATE INDEX "BillingOrder_voucherId_idx" ON "BillingOrder"("voucherId");

-- CreateIndex
CREATE INDEX "BillingOrderLine_orderId_idx" ON "BillingOrderLine"("orderId");

-- CreateIndex
CREATE INDEX "BillingOrderLine_pricingId_idx" ON "BillingOrderLine"("pricingId");

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
CREATE UNIQUE INDEX "Pricing_planId_regionId_type_billingMode_billingPeriod_curr_key" ON "Pricing"("planId", "regionId", "type", "billingMode", "billingPeriod", "currency", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceAddon_code_key" ON "ServiceAddon"("code");

-- CreateIndex
CREATE INDEX "ServiceAddon_isActive_idx" ON "ServiceAddon"("isActive");

-- CreateIndex
CREATE INDEX "ServiceAddonPricing_addonId_currency_billingPeriod_isActive_idx" ON "ServiceAddonPricing"("addonId", "currency", "billingPeriod", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceAddonPricing_addonId_billingPeriod_currency_effectiv_key" ON "ServiceAddonPricing"("addonId", "billingPeriod", "currency", "effectiveFrom");

-- CreateIndex
CREATE INDEX "ServicePlanAddon_planId_isActive_idx" ON "ServicePlanAddon"("planId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ServicePlanAddon_planId_addonId_key" ON "ServicePlanAddon"("planId", "addonId");

-- CreateIndex
CREATE INDEX "ServiceSubscriptionAddon_subscriptionId_status_idx" ON "ServiceSubscriptionAddon"("subscriptionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceSubscriptionAddon_subscriptionId_addonId_key" ON "ServiceSubscriptionAddon"("subscriptionId", "addonId");

-- CreateIndex
CREATE INDEX "ServiceSubscription_tenantId_status_idx" ON "Subscription"("tenantId", "status");

-- CreateIndex
CREATE INDEX "ServiceSubscription_packageId_idx" ON "Subscription"("packageId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceSubscription_tenantId_packageId_planId_key" ON "Subscription"("tenantId", "packageId", "planId");

-- CreateIndex
CREATE INDEX "VpnClient_organizationId_status_idx" ON "VpnClient"("organizationId", "status");

-- CreateIndex
CREATE INDEX "VpnClient_subscriptionId_idx" ON "VpnClient"("subscriptionId");

-- CreateIndex
CREATE INDEX "VpnClient_currentPeriodEnd_idx" ON "VpnClient"("currentPeriodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "VpnClient_provider_clientName_key" ON "VpnClient"("provider", "clientName");

-- CreateIndex
CREATE UNIQUE INDEX "VpnRegion_slug_key" ON "VpnRegion"("slug");

-- CreateIndex
CREATE INDEX "VpnRegion_isActive_idx" ON "VpnRegion"("isActive");

-- CreateIndex
CREATE INDEX "VpnSshKey_fingerprint_idx" ON "VpnSshKey"("fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "VpnServer_name_key" ON "VpnServer"("name");

-- CreateIndex
CREATE INDEX "VpnServer_regionId_idx" ON "VpnServer"("regionId");

-- CreateIndex
CREATE INDEX "VpnServer_sshKeyId_idx" ON "VpnServer"("sshKeyId");

-- CreateIndex
CREATE INDEX "VpnServer_isActive_idx" ON "VpnServer"("isActive");

-- CreateIndex
CREATE INDEX "UsageLedger_tenantId_period_idx" ON "UsageLedger"("tenantId", "period");

-- CreateIndex
CREATE INDEX "UsageLedger_tenantId_category_idx" ON "UsageLedger"("tenantId", "category");

-- CreateIndex
CREATE INDEX "UsageLedger_subscriptionId_idx" ON "UsageLedger"("subscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "VpnPackage_servicePlanId_key" ON "VpnPackage"("servicePlanId");

-- CreateIndex
CREATE INDEX "VpnPackage_isActive_idx" ON "VpnPackage"("isActive");

-- CreateIndex
CREATE INDEX "VpnPackageServer_packageId_idx" ON "VpnPackageServer"("packageId");

-- CreateIndex
CREATE INDEX "VpnPackageServer_serverId_idx" ON "VpnPackageServer"("serverId");

-- CreateIndex
CREATE UNIQUE INDEX "VpnPackageServer_packageId_serverId_key" ON "VpnPackageServer"("packageId", "serverId");

-- CreateIndex
CREATE UNIQUE INDEX "VpnSubscription_serviceSubscriptionId_key" ON "VpnSubscription"("serviceSubscriptionId");

-- CreateIndex
CREATE INDEX "VpnSubscription_organizationId_status_idx" ON "VpnSubscription"("organizationId", "status");

-- CreateIndex
CREATE INDEX "VpnSubscription_packageId_idx" ON "VpnSubscription"("packageId");

-- CreateIndex
CREATE INDEX "VpnSubscription_currentPeriodEnd_idx" ON "VpnSubscription"("currentPeriodEnd");

-- CreateIndex
CREATE INDEX "VpnServerAccount_subscriptionId_idx" ON "VpnServerAccount"("subscriptionId");

-- CreateIndex
CREATE INDEX "VpnServerAccount_serverId_idx" ON "VpnServerAccount"("serverId");

-- CreateIndex
CREATE INDEX "VpnServerAccount_provisioningStatus_idx" ON "VpnServerAccount"("provisioningStatus");

-- CreateIndex
CREATE UNIQUE INDEX "VpnServerAccount_serverId_protocol_username_key" ON "VpnServerAccount"("serverId", "protocol", "username");

-- CreateIndex
CREATE INDEX "VpnMobileDevice_organizationId_status_idx" ON "VpnMobileDevice"("organizationId", "status");

-- CreateIndex
CREATE INDEX "VpnMobileDevice_subscriptionId_idx" ON "VpnMobileDevice"("subscriptionId");

-- CreateIndex
CREATE INDEX "VpnMobileDevice_userId_idx" ON "VpnMobileDevice"("userId");

-- CreateIndex
CREATE INDEX "VpnMobileDevice_status_idx" ON "VpnMobileDevice"("status");

-- CreateIndex
CREATE UNIQUE INDEX "VpnMobileDevice_subscriptionId_deviceFingerprint_key" ON "VpnMobileDevice"("subscriptionId", "deviceFingerprint");

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
CREATE UNIQUE INDEX "VpnPairingToken_token_key" ON "VpnPairingToken"("token");

-- CreateIndex
CREATE INDEX "VpnPairingToken_subscriptionId_idx" ON "VpnPairingToken"("subscriptionId");

-- CreateIndex
CREATE INDEX "VpnPairingToken_token_idx" ON "VpnPairingToken"("token");

-- CreateIndex
CREATE INDEX "VpnPairingToken_expiresAt_idx" ON "VpnPairingToken"("expiresAt");

-- CreateIndex
CREATE INDEX "VpnAuditLog_organizationId_createdAt_idx" ON "VpnAuditLog"("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "VpnAuditLog_subscriptionId_createdAt_idx" ON "VpnAuditLog"("subscriptionId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "VpnAuditLog_serverId_createdAt_idx" ON "VpnAuditLog"("serverId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "VpnAuditLog_correlationId_idx" ON "VpnAuditLog"("correlationId");

-- CreateIndex
CREATE INDEX "VpnAuditLog_serverAccountId_createdAt_idx" ON "VpnAuditLog"("serverAccountId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "VpnAuditLog_deviceId_createdAt_idx" ON "VpnAuditLog"("deviceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "VpnAuditLog_action_createdAt_idx" ON "VpnAuditLog"("action", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "VpnAuditLog_adminId_createdAt_idx" ON "VpnAuditLog"("adminId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappMetaApp_metaAppId_key" ON "WhatsappMetaApp"("metaAppId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappMetaApp_webhookKey_key" ON "WhatsappMetaApp"("webhookKey");

-- CreateIndex
CREATE INDEX "WhatsappMetaApp_active_idx" ON "WhatsappMetaApp"("active");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappDevice_phoneNumber_key" ON "WhatsappDevice"("phoneNumber");

-- CreateIndex
CREATE INDEX "WhatsappDevice_organizationId_idx" ON "WhatsappDevice"("organizationId");

-- CreateIndex
CREATE INDEX "WhatsappDevice_whatsappBusinessAccountId_idx" ON "WhatsappDevice"("whatsappBusinessAccountId");

-- CreateIndex
CREATE INDEX "WhatsappDevice_whatsappMetaAppId_idx" ON "WhatsappDevice"("whatsappMetaAppId");

-- CreateIndex
CREATE INDEX "WhatsappDevice_whatsappPhoneId_idx" ON "WhatsappDevice"("whatsappPhoneId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappDevice_whatsappMetaAppId_whatsappPhoneId_key" ON "WhatsappDevice"("whatsappMetaAppId", "whatsappPhoneId");

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
CREATE INDEX "WhatsappConversationLabel_organizationId_idx" ON "WhatsappConversationLabel"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappConversationLabel_organizationId_name_key" ON "WhatsappConversationLabel"("organizationId", "name");

-- CreateIndex
CREATE INDEX "WhatsappConversationLabelOnConversation_labelId_idx" ON "WhatsappConversationLabelOnConversation"("labelId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappMessage_waMessageId_key" ON "WhatsappMessage"("waMessageId");

-- CreateIndex
CREATE INDEX "WhatsappMessage_conversationId_createdAt_idx" ON "WhatsappMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "WhatsappMessageStatus_messageId_createdAt_idx" ON "WhatsappMessageStatus"("messageId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappMedia_metaMediaId_key" ON "WhatsappMedia"("metaMediaId");

-- CreateIndex
CREATE INDEX "WhatsappMedia_organizationId_idx" ON "WhatsappMedia"("organizationId");

-- CreateIndex
CREATE INDEX "WhatsappMedia_deviceId_idx" ON "WhatsappMedia"("deviceId");

-- CreateIndex
CREATE INDEX "WhatsappMedia_metaMediaId_idx" ON "WhatsappMedia"("metaMediaId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappDailyCount_organizationId_date_whatsappDeviceId_key" ON "WhatsappDailyCount"("organizationId", "date", "whatsappDeviceId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappHourlyCount_organizationId_whatsappDeviceId_hour_key" ON "WhatsappHourlyCount"("organizationId", "whatsappDeviceId", "hour");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappMonthlyCount_organizationId_year_month_whatsappDevi_key" ON "WhatsappMonthlyCount"("organizationId", "year", "month", "whatsappDeviceId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappQuotaSession_organizationId_phoneNumber_category_key" ON "WhatsappQuotaSession"("organizationId", "phoneNumber", "category");

-- CreateIndex
CREATE INDEX "WhatsappBillingLedger_organizationId_createdAt_idx" ON "WhatsappBillingLedger"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "WhatsappBillingLedger_waMessageId_idx" ON "WhatsappBillingLedger"("waMessageId");

-- CreateIndex
CREATE INDEX "WhatsappApiCall_phoneNumberId_createdAt_idx" ON "WhatsappApiCall"("phoneNumberId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "WhatsappApiCall_createdAt_idx" ON "WhatsappApiCall"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "WhatsappApiCall_phoneNumberId_status_createdAt_idx" ON "WhatsappApiCall"("phoneNumberId", "status", "createdAt" DESC);

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
CREATE UNIQUE INDEX "WhatsappOrganizationApiKey_fingerprint_key" ON "WhatsappOrganizationApiKey"("fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappOrganizationApiKey_keyHash_key" ON "WhatsappOrganizationApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "WhatsappOrganizationApiKey_organizationId_createdAt_idx" ON "WhatsappOrganizationApiKey"("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "WhatsappOrganizationApiKey_organizationId_status_idx" ON "WhatsappOrganizationApiKey"("organizationId", "status");

-- CreateIndex
CREATE INDEX "WhatsappOrganizationApiKey_status_createdAt_idx" ON "WhatsappOrganizationApiKey"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "WhatsappWebhook_organizationId_idx" ON "WhatsappWebhook"("organizationId");

-- CreateIndex
CREATE INDEX "WhatsappWebhook_whatsappDeviceId_idx" ON "WhatsappWebhook"("whatsappDeviceId");

-- CreateIndex
CREATE INDEX "WhatsappWebhookDeliveryLog_organizationId_createdAt_idx" ON "WhatsappWebhookDeliveryLog"("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "WhatsappWebhookDeliveryLog_webhookId_createdAt_idx" ON "WhatsappWebhookDeliveryLog"("webhookId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "WhatsappWebhookDeliveryLog_status_nextRetryAt_idx" ON "WhatsappWebhookDeliveryLog"("status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "WhatsappWebhookEvent_organizationId_createdAt_idx" ON "WhatsappWebhookEvent"("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "WhatsappWebhookEvent_whatsappDeviceId_createdAt_idx" ON "WhatsappWebhookEvent"("whatsappDeviceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "WhatsappWebhookEvent_eventType_createdAt_idx" ON "WhatsappWebhookEvent"("eventType", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "WhatsappWebhookEvent_processingStatus_createdAt_idx" ON "WhatsappWebhookEvent"("processingStatus", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "WhatsappWebhookEvent_waMessageId_idx" ON "WhatsappWebhookEvent"("waMessageId");

-- CreateIndex
CREATE INDEX "WhatsappWebhookEvent_createdAt_idx" ON "WhatsappWebhookEvent"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "WhatsappWebhookDeadLetter_deviceId_failedAt_idx" ON "WhatsappWebhookDeadLetter"("deviceId", "failedAt" DESC);

-- CreateIndex
CREATE INDEX "WhatsappWebhookDeadLetter_replayStatus_idx" ON "WhatsappWebhookDeadLetter"("replayStatus");

-- CreateIndex
CREATE INDEX "WhatsappWebhookDeadLetter_organizationId_failedAt_idx" ON "WhatsappWebhookDeadLetter"("organizationId", "failedAt" DESC);

-- CreateIndex
CREATE INDEX "WhatsappQuotaAlert_organizationId_idx" ON "WhatsappQuotaAlert"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappQuotaAlert_organizationId_whatsappDeviceId_threshol_key" ON "WhatsappQuotaAlert"("organizationId", "whatsappDeviceId", "threshold");

-- CreateIndex
CREATE INDEX "EmailLog_ticketId_idx" ON "EmailLog"("ticketId");

-- CreateIndex
CREATE INDEX "EmailLog_ticketNumber_idx" ON "EmailLog"("ticketNumber");

-- CreateIndex
CREATE INDEX "EmailLog_recipientEmail_idx" ON "EmailLog"("recipientEmail");

-- CreateIndex
CREATE INDEX "EmailLog_status_idx" ON "EmailLog"("status");

-- CreateIndex
CREATE INDEX "EmailLog_createdAt_idx" ON "EmailLog"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "EmailLog_organizationId_idx" ON "EmailLog"("organizationId");

-- CreateIndex
CREATE INDEX "EmailLog_type_idx" ON "EmailLog"("type");

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
CREATE INDEX "Voucher_kind_status_idx" ON "Voucher"("kind", "status");

-- CreateIndex
CREATE INDEX "VoucherClaim_workosUserId_claimedAt_idx" ON "VoucherClaim"("workosUserId", "claimedAt" DESC);

-- CreateIndex
CREATE INDEX "VoucherClaim_voucherId_claimedAt_idx" ON "VoucherClaim"("voucherId", "claimedAt" DESC);

-- CreateIndex
CREATE INDEX "VoucherClaim_organizationId_idx" ON "VoucherClaim"("organizationId");

-- CreateIndex
CREATE INDEX "VoucherClaim_orderId_idx" ON "VoucherClaim"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "VoucherClaim_voucherId_workosUserId_key" ON "VoucherClaim"("voucherId", "workosUserId");

-- CreateIndex
CREATE INDEX "WhatsappAuditLog_organizationId_createdAt_idx" ON "WhatsappAuditLog"("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "WhatsappAuditLog_deviceId_createdAt_idx" ON "WhatsappAuditLog"("deviceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "WhatsappAuditLog_action_createdAt_idx" ON "WhatsappAuditLog"("action", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "WhatsappAuditLog_adminId_createdAt_idx" ON "WhatsappAuditLog"("adminId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "WhatsappCatalog_organizationId_idx" ON "WhatsappCatalog"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappCatalog_organizationId_metaCatalogId_key" ON "WhatsappCatalog"("organizationId", "metaCatalogId");

-- CreateIndex
CREATE INDEX "WhatsappCatalogProduct_catalogId_idx" ON "WhatsappCatalogProduct"("catalogId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappCatalogProduct_catalogId_productRetailerId_key" ON "WhatsappCatalogProduct"("catalogId", "productRetailerId");

-- CreateIndex
CREATE UNIQUE INDEX "CacheEntry_key_key" ON "CacheEntry"("key");

-- CreateIndex
CREATE INDEX "CacheEntry_key_expiresAt_idx" ON "CacheEntry"("key", "expiresAt");

-- CreateIndex
CREATE INDEX "AppCredential_organizationId_idx" ON "AppCredential"("organizationId");

-- CreateIndex
CREATE INDEX "AppCredential_organizationId_type_idx" ON "AppCredential"("organizationId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "AppCredential_organizationId_type_name_key" ON "AppCredential"("organizationId", "type", "name");

-- CreateIndex
CREATE UNIQUE INDEX "AppHostingCluster_code_key" ON "AppHostingCluster"("code");

-- CreateIndex
CREATE INDEX "AppHostingCluster_status_idx" ON "AppHostingCluster"("status");

-- CreateIndex
CREATE INDEX "AppHostingCluster_isDefault_idx" ON "AppHostingCluster"("isDefault");

-- CreateIndex
CREATE INDEX "AppHostingClusterIntegration_clusterId_idx" ON "AppHostingClusterIntegration"("clusterId");

-- CreateIndex
CREATE INDEX "AppHostingClusterIntegration_type_idx" ON "AppHostingClusterIntegration"("type");

-- CreateIndex
CREATE INDEX "AppHostingClusterIntegration_isActive_idx" ON "AppHostingClusterIntegration"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "AppHostingClusterIntegration_clusterId_type_key" ON "AppHostingClusterIntegration"("clusterId", "type");

-- CreateIndex
CREATE INDEX "AppManagedServiceCredential_clusterId_idx" ON "AppManagedServiceCredential"("clusterId");

-- CreateIndex
CREATE INDEX "AppManagedServiceCredential_serviceType_idx" ON "AppManagedServiceCredential"("serviceType");

-- CreateIndex
CREATE INDEX "AppManagedServiceCredential_isActive_idx" ON "AppManagedServiceCredential"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "AppManagedServiceCredential_clusterId_serviceType_key" ON "AppManagedServiceCredential"("clusterId", "serviceType");

-- CreateIndex
CREATE UNIQUE INDEX "AppHostingClusterEndpoint_clusterId_key" ON "AppHostingClusterEndpoint"("clusterId");

-- CreateIndex
CREATE INDEX "AppHostingClusterEndpoint_isActive_idx" ON "AppHostingClusterEndpoint"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationDomain_hostname_key" ON "ApplicationDomain"("hostname");

-- CreateIndex
CREATE INDEX "ApplicationDomain_stackId_idx" ON "ApplicationDomain"("stackId");

-- CreateIndex
CREATE INDEX "ApplicationDomain_clusterId_idx" ON "ApplicationDomain"("clusterId");

-- CreateIndex
CREATE INDEX "ApplicationDomain_dnsStatus_idx" ON "ApplicationDomain"("dnsStatus");

-- CreateIndex
CREATE INDEX "ApplicationDomain_stackId_isPrimary_idx" ON "ApplicationDomain"("stackId", "isPrimary");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationDomainCertificate_domainId_key" ON "ApplicationDomainCertificate"("domainId");

-- CreateIndex
CREATE INDEX "ApplicationDomainAllowlistEntry_domainId_enabled_position_idx" ON "ApplicationDomainAllowlistEntry"("domainId", "enabled", "position");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationDomainAllowlistEntry_domainId_cidr_key" ON "ApplicationDomainAllowlistEntry"("domainId", "cidr");

-- CreateIndex
CREATE UNIQUE INDEX "AiDeploymentSession_stackId_key" ON "AiDeploymentSession"("stackId");

-- CreateIndex
CREATE UNIQUE INDEX "AiDeploymentSession_deploymentId_key" ON "AiDeploymentSession"("deploymentId");

-- CreateIndex
CREATE UNIQUE INDEX "AiDeploymentSession_idempotencyKey_key" ON "AiDeploymentSession"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AiDeploymentSession_organizationId_workosUserId_idx" ON "AiDeploymentSession"("organizationId", "workosUserId");

-- CreateIndex
CREATE INDEX "AiDeploymentSession_organizationId_stackId_idx" ON "AiDeploymentSession"("organizationId", "stackId");

-- CreateIndex
CREATE INDEX "AiDeploymentSession_organizationId_status_idx" ON "AiDeploymentSession"("organizationId", "status");

-- CreateIndex
CREATE INDEX "AiDeploymentSession_status_expiresAt_idx" ON "AiDeploymentSession"("status", "expiresAt");

-- AddForeignKey
ALTER TABLE "GithubRepositoryConnection" ADD CONSTRAINT "GithubRepositoryConnection_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "GithubInstallation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationStack" ADD CONSTRAINT "ApplicationStack_repositoryConnectionId_fkey" FOREIGN KEY ("repositoryConnectionId") REFERENCES "GithubRepositoryConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationStack" ADD CONSTRAINT "ApplicationStack_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "AppHostingCluster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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
ALTER TABLE "BillingContact" ADD CONSTRAINT "BillingContact_billingAccountId_fkey" FOREIGN KEY ("billingAccountId") REFERENCES "BillingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "BillingOrder" ADD CONSTRAINT "BillingOrder_serviceSubscriptionId_fkey" FOREIGN KEY ("serviceSubscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingOrder" ADD CONSTRAINT "BillingOrder_billingAccountId_fkey" FOREIGN KEY ("billingAccountId") REFERENCES "BillingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingOrder" ADD CONSTRAINT "BillingOrder_billingInvoiceId_fkey" FOREIGN KEY ("billingInvoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingOrder" ADD CONSTRAINT "BillingOrder_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "Voucher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingOrderLine" ADD CONSTRAINT "BillingOrderLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "BillingOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingOrderLine" ADD CONSTRAINT "BillingOrderLine_pricingId_fkey" FOREIGN KEY ("pricingId") REFERENCES "Pricing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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
ALTER TABLE "ServiceAddonPricing" ADD CONSTRAINT "ServiceAddonPricing_addonId_fkey" FOREIGN KEY ("addonId") REFERENCES "ServiceAddon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicePlanAddon" ADD CONSTRAINT "ServicePlanAddon_planId_fkey" FOREIGN KEY ("planId") REFERENCES "ServicePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicePlanAddon" ADD CONSTRAINT "ServicePlanAddon_addonId_fkey" FOREIGN KEY ("addonId") REFERENCES "ServiceAddon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceSubscriptionAddon" ADD CONSTRAINT "ServiceSubscriptionAddon_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceSubscriptionAddon" ADD CONSTRAINT "ServiceSubscriptionAddon_addonId_fkey" FOREIGN KEY ("addonId") REFERENCES "ServiceAddon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "ServicePlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_pricingId_fkey" FOREIGN KEY ("pricingId") REFERENCES "Pricing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VpnClient" ADD CONSTRAINT "VpnClient_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VpnServer" ADD CONSTRAINT "VpnServer_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "VpnRegion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VpnServer" ADD CONSTRAINT "VpnServer_sshKeyId_fkey" FOREIGN KEY ("sshKeyId") REFERENCES "VpnSshKey"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageLedger" ADD CONSTRAINT "UsageLedger_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VpnPackage" ADD CONSTRAINT "VpnPackage_servicePlanId_fkey" FOREIGN KEY ("servicePlanId") REFERENCES "ServicePlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VpnPackageServer" ADD CONSTRAINT "VpnPackageServer_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "VpnPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VpnPackageServer" ADD CONSTRAINT "VpnPackageServer_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "VpnServer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VpnSubscription" ADD CONSTRAINT "VpnSubscription_serviceSubscriptionId_fkey" FOREIGN KEY ("serviceSubscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VpnServerAccount" ADD CONSTRAINT "VpnServerAccount_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "VpnSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VpnServerAccount" ADD CONSTRAINT "VpnServerAccount_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "VpnServer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VpnMobileDevice" ADD CONSTRAINT "VpnMobileDevice_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "VpnSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VpnMobileSession" ADD CONSTRAINT "VpnMobileSession_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "VpnMobileDevice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VpnMobileSession" ADD CONSTRAINT "VpnMobileSession_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "VpnSubscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VpnMobileSession" ADD CONSTRAINT "VpnMobileSession_serverAccountId_fkey" FOREIGN KEY ("serverAccountId") REFERENCES "VpnServerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VpnMobileSession" ADD CONSTRAINT "VpnMobileSession_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "VpnServer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VpnPairingToken" ADD CONSTRAINT "VpnPairingToken_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "VpnSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappDevice" ADD CONSTRAINT "WhatsappDevice_whatsappMetaAppId_fkey" FOREIGN KEY ("whatsappMetaAppId") REFERENCES "WhatsappMetaApp"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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
ALTER TABLE "WhatsappConversationLabelOnConversation" ADD CONSTRAINT "WhatsappConversationLabelOnConversation_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "WhatsappConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappConversationLabelOnConversation" ADD CONSTRAINT "WhatsappConversationLabelOnConversation_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "WhatsappConversationLabel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappMessage" ADD CONSTRAINT "WhatsappMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "WhatsappConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappMessageStatus" ADD CONSTRAINT "WhatsappMessageStatus_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "WhatsappMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappDailyCount" ADD CONSTRAINT "WhatsappDailyCount_whatsappDeviceId_fkey" FOREIGN KEY ("whatsappDeviceId") REFERENCES "WhatsappDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappHourlyCount" ADD CONSTRAINT "WhatsappHourlyCount_whatsappDeviceId_fkey" FOREIGN KEY ("whatsappDeviceId") REFERENCES "WhatsappDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappMonthlyCount" ADD CONSTRAINT "WhatsappMonthlyCount_whatsappDeviceId_fkey" FOREIGN KEY ("whatsappDeviceId") REFERENCES "WhatsappDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappQuotaSession" ADD CONSTRAINT "WhatsappQuotaSession_whatsappDeviceId_fkey" FOREIGN KEY ("whatsappDeviceId") REFERENCES "WhatsappDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappBillingLedger" ADD CONSTRAINT "WhatsappBillingLedger_whatsappDeviceId_fkey" FOREIGN KEY ("whatsappDeviceId") REFERENCES "WhatsappDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappAttachment" ADD CONSTRAINT "WhatsappAttachment_whatsappDeviceId_fkey" FOREIGN KEY ("whatsappDeviceId") REFERENCES "WhatsappDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappBroadcastRateState" ADD CONSTRAINT "WhatsappBroadcastRateState_whatsappContactGroupId_fkey" FOREIGN KEY ("whatsappContactGroupId") REFERENCES "WhatsappContactGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappBroadcastRateState" ADD CONSTRAINT "WhatsappBroadcastRateState_whatsappDeviceId_fkey" FOREIGN KEY ("whatsappDeviceId") REFERENCES "WhatsappDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappWebhook" ADD CONSTRAINT "WhatsappWebhook_whatsappDeviceId_fkey" FOREIGN KEY ("whatsappDeviceId") REFERENCES "WhatsappDevice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappWebhookDeliveryLog" ADD CONSTRAINT "WhatsappWebhookDeliveryLog_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "WhatsappWebhook"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappWebhookEvent" ADD CONSTRAINT "WhatsappWebhookEvent_whatsappDeviceId_fkey" FOREIGN KEY ("whatsappDeviceId") REFERENCES "WhatsappDevice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_gatewayId_fkey" FOREIGN KEY ("gatewayId") REFERENCES "PaymentGateway"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentConfirmation" ADD CONSTRAINT "PaymentConfirmation_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentConfirmation" ADD CONSTRAINT "PaymentConfirmation_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherClaim" ADD CONSTRAINT "VoucherClaim_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "Voucher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherClaim" ADD CONSTRAINT "VoucherClaim_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "BillingOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappCatalog" ADD CONSTRAINT "WhatsappCatalog_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "WhatsappDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappCatalogProduct" ADD CONSTRAINT "WhatsappCatalogProduct_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "WhatsappCatalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppHostingClusterIntegration" ADD CONSTRAINT "AppHostingClusterIntegration_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "AppHostingCluster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppManagedServiceCredential" ADD CONSTRAINT "AppManagedServiceCredential_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "AppHostingCluster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppHostingClusterEndpoint" ADD CONSTRAINT "AppHostingClusterEndpoint_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "AppHostingCluster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationDomain" ADD CONSTRAINT "ApplicationDomain_stackId_fkey" FOREIGN KEY ("stackId") REFERENCES "ApplicationStack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationDomain" ADD CONSTRAINT "ApplicationDomain_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "AppHostingCluster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationDomainCertificate" ADD CONSTRAINT "ApplicationDomainCertificate_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "ApplicationDomain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationDomainAllowlistEntry" ADD CONSTRAINT "ApplicationDomainAllowlistEntry_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "ApplicationDomain"("id") ON DELETE CASCADE ON UPDATE CASCADE;
