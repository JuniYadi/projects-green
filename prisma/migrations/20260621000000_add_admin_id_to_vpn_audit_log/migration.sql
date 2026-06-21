-- Add adminId column to VpnAuditLog for tracking admin-triggered actions
ALTER TABLE "VpnAuditLog" ADD COLUMN "adminId" TEXT;

-- Index for querying audit logs by admin
CREATE INDEX "VpnAuditLog_adminId_createdAt_idx" ON "VpnAuditLog"("adminId", "createdAt" DESC);
