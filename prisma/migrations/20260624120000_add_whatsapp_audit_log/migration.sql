-- Create WhatsappAuditLog table for admin-side WhatsApp audit trail
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

-- Indexes for common query patterns
CREATE INDEX "WhatsappAuditLog_organizationId_createdAt_idx" ON "WhatsappAuditLog"("organizationId", "createdAt" DESC);
CREATE INDEX "WhatsappAuditLog_deviceId_createdAt_idx" ON "WhatsappAuditLog"("deviceId", "createdAt" DESC);
CREATE INDEX "WhatsappAuditLog_action_createdAt_idx" ON "WhatsappAuditLog"("action", "createdAt" DESC);
CREATE INDEX "WhatsappAuditLog_adminId_createdAt_idx" ON "WhatsappAuditLog"("adminId", "createdAt" DESC);
