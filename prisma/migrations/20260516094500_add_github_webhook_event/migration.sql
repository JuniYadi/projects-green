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
