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

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS btree_gist;

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

-- CreateIndex
CREATE UNIQUE INDEX "BillingAccount_organizationId_key" ON "BillingAccount"("organizationId");

-- CreateIndex
CREATE INDEX "BillingSubscription_billingAccountId_status_idx" ON "BillingSubscription"("billingAccountId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BillingSubscription_billingAccountId_externalKey_key" ON "BillingSubscription"("billingAccountId", "externalKey");

-- CreateIndex
CREATE UNIQUE INDEX "BillingSubscription_billingAccountId_null_externalKey_key" ON "BillingSubscription"("billingAccountId") WHERE "externalKey" IS NULL;

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
CREATE UNIQUE INDEX "BillingRun_global_runType_period_key" ON "BillingRun"("runType", "periodStart", "periodEnd") WHERE "billingAccountId" IS NULL;

-- CreateIndex
CREATE INDEX "BillingAuditLog_billingAccountId_createdAt_idx" ON "BillingAuditLog"("billingAccountId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "BillingAuditLog_billingRunId_createdAt_idx" ON "BillingAuditLog"("billingRunId", "createdAt");

-- CreateIndex
CREATE INDEX "BillingAuditLog_entityType_entityId_idx" ON "BillingAuditLog"("entityType", "entityId");

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

-- AddCheckConstraint
ALTER TABLE "PlanVersion"
ADD CONSTRAINT "PlanVersion_effective_window_check"
CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom");

-- AddCheckConstraint
ALTER TABLE "SubscriptionVersion"
ADD CONSTRAINT "SubscriptionVersion_effective_window_check"
CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom");

-- AddCheckConstraint
ALTER TABLE "SubscriptionVersion"
ADD CONSTRAINT "SubscriptionVersion_quantity_nonnegative_check"
CHECK ("quantity" >= 0);

-- AddCheckConstraint
ALTER TABLE "MeterPrice"
ADD CONSTRAINT "MeterPrice_effective_window_check"
CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom");

-- AddCheckConstraint
ALTER TABLE "MeterPrice"
ADD CONSTRAINT "MeterPrice_unitPrice_nonnegative_check"
CHECK ("unitPrice" >= 0);

-- AddCheckConstraint
ALTER TABLE "MeterPrice"
ADD CONSTRAINT "MeterPrice_includedUnits_nonnegative_check"
CHECK ("includedUnits" >= 0);

-- AddCheckConstraint
ALTER TABLE "UsageEvent"
ADD CONSTRAINT "UsageEvent_quantity_nonnegative_check"
CHECK ("quantity" >= 0);

-- AddCheckConstraint
ALTER TABLE "RatedUsage"
ADD CONSTRAINT "RatedUsage_quantity_nonnegative_check"
CHECK ("quantity" >= 0);

-- AddCheckConstraint
ALTER TABLE "RatedUsage"
ADD CONSTRAINT "RatedUsage_amount_nonnegative_check"
CHECK ("amount" >= 0);

-- AddCheckConstraint
ALTER TABLE "Invoice"
ADD CONSTRAINT "Invoice_period_window_check"
CHECK ("periodEnd" > "periodStart");

-- AddExclusionConstraint
ALTER TABLE "PlanVersion"
ADD CONSTRAINT "PlanVersion_planId_effective_window_excl"
EXCLUDE USING GIST (
  "planId" WITH =,
  tsrange(
    "effectiveFrom",
    COALESCE("effectiveTo", TIMESTAMP '9999-12-31 23:59:59.999'),
    '[)'
  ) WITH &&
);

-- AddExclusionConstraint
ALTER TABLE "SubscriptionVersion"
ADD CONSTRAINT "SubscriptionVersion_subscriptionId_effective_window_excl"
EXCLUDE USING GIST (
  "subscriptionId" WITH =,
  tsrange(
    "effectiveFrom",
    COALESCE("effectiveTo", TIMESTAMP '9999-12-31 23:59:59.999'),
    '[)'
  ) WITH &&
);

-- AddExclusionConstraint
ALTER TABLE "MeterPrice"
ADD CONSTRAINT "MeterPrice_meterId_planVersionId_effective_window_excl"
EXCLUDE USING GIST (
  "meterId" WITH =,
  "planVersionId" WITH =,
  tsrange(
    "effectiveFrom",
    COALESCE("effectiveTo", TIMESTAMP '9999-12-31 23:59:59.999'),
    '[)'
  ) WITH &&
);

-- RenameIndex
ALTER INDEX "GithubRepositoryConnection_githubRepositoryId_installationId_ke" RENAME TO "GithubRepositoryConnection_githubRepositoryId_installationI_key";
