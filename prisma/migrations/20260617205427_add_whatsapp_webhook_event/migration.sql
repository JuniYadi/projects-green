-- CreateTable
CREATE TABLE "WhatsappWebhookDeadLetter" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "deviceId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "errorMessage" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'dead_lettered',
    "failedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "replayedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappWebhookDeadLetter_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "CacheEntry" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CacheEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WhatsappWebhookDeadLetter_organizationId_status_idx" ON "WhatsappWebhookDeadLetter"("organizationId", "status");

-- CreateIndex
CREATE INDEX "WhatsappWebhookDeadLetter_deviceId_status_idx" ON "WhatsappWebhookDeadLetter"("deviceId", "status");

-- CreateIndex
CREATE INDEX "WhatsappWebhookDeadLetter_failedAt_idx" ON "WhatsappWebhookDeadLetter"("failedAt" DESC);

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
CREATE UNIQUE INDEX "CacheEntry_key_key" ON "CacheEntry"("key");

-- CreateIndex
CREATE INDEX "CacheEntry_key_expiresAt_idx" ON "CacheEntry"("key", "expiresAt");

-- AddForeignKey
ALTER TABLE "WhatsappWebhookEvent" ADD CONSTRAINT "WhatsappWebhookEvent_whatsappDeviceId_fkey" FOREIGN KEY ("whatsappDeviceId") REFERENCES "WhatsappDevice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
