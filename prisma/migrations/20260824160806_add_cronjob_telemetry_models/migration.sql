-- CreateEnum
CREATE TYPE "CronJobStatus" AS ENUM ('HEALTHY', 'RUNNING', 'DEGRADED', 'FAILED', 'MISSED', 'DISABLED');

-- CreateEnum
CREATE TYPE "CronExecutionStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'TIMED_OUT', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CronTriggerType" AS ENUM ('SCHEDULED_K8S', 'MANUAL_PORTAL', 'API_WEBHOOK', 'RETRY');

-- CreateTable
CREATE TABLE "CronJobDefinition" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "cronExpression" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "timeoutSeconds" INTEGER NOT NULL DEFAULT 3600,
    "gracePeriodMins" INTEGER NOT NULL DEFAULT 15,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastStatus" "CronJobStatus" NOT NULL DEFAULT 'HEALTHY',
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CronJobDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CronJobExecution" (
    "id" TEXT NOT NULL,
    "cronJobId" TEXT NOT NULL,
    "status" "CronExecutionStatus" NOT NULL DEFAULT 'PENDING',
    "triggerType" "CronTriggerType" NOT NULL DEFAULT 'SCHEDULED_K8S',
    "triggeredBy" TEXT,
    "triggerReason" TEXT,
    "podName" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "summary" JSONB,
    "errorMessage" TEXT,
    "errorStack" TEXT,
    "logTail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CronJobExecution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CronJobDefinition_code_key" ON "CronJobDefinition"("code");

-- CreateIndex
CREATE INDEX "CronJobDefinition_category_idx" ON "CronJobDefinition"("category");

-- CreateIndex
CREATE INDEX "CronJobDefinition_lastStatus_idx" ON "CronJobDefinition"("lastStatus");

-- CreateIndex
CREATE INDEX "CronJobExecution_cronJobId_startedAt_idx" ON "CronJobExecution"("cronJobId", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "CronJobExecution_status_idx" ON "CronJobExecution"("status");

-- AddForeignKey
ALTER TABLE "CronJobExecution" ADD CONSTRAINT "CronJobExecution_cronJobId_fkey" FOREIGN KEY ("cronJobId") REFERENCES "CronJobDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

