-- AlterTable
ALTER TABLE "VpnAuditLog" ADD COLUMN     "correlationId" TEXT,
ADD COLUMN     "durationMs" INTEGER,
ADD COLUMN     "errorMessage" TEXT,
ADD COLUMN     "message" TEXT,
ADD COLUMN     "organizationId" TEXT,
ADD COLUMN     "requestPayload" JSONB,
ADD COLUMN     "responsePayload" JSONB,
ADD COLUMN     "serverAccountId" TEXT,
ADD COLUMN     "serverId" TEXT,
ADD COLUMN     "subscriptionId" TEXT;

-- AlterTable
ALTER TABLE "WhatsappApiCall" ALTER COLUMN "phoneNumberId" DROP NOT NULL;

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
