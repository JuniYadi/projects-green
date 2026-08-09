-- CreateEnum
CREATE TYPE "AiDeploymentSessionStatus" AS ENUM ('COLLECTING', 'INSPECTING', 'BLOCKED', 'PLAN_READY', 'CONFIRMED', 'EXECUTING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AiDeploymentSourceType" AS ENUM ('SOURCE', 'TEMPLATE');

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
CREATE UNIQUE INDEX "AiDeploymentSession_idempotencyKey_key" ON "AiDeploymentSession"("idempotencyKey") WHERE "idempotencyKey" IS NOT NULL;

-- CreateIndex
CREATE INDEX "AiDeploymentSession_organizationId_workosUserId_idx" ON "AiDeploymentSession"("organizationId", "workosUserId");

-- CreateIndex
CREATE INDEX "AiDeploymentSession_organizationId_status_idx" ON "AiDeploymentSession"("organizationId", "status");

-- CreateIndex
CREATE INDEX "AiDeploymentSession_status_expiresAt_idx" ON "AiDeploymentSession"("status", "expiresAt");
