-- Add step and status columns to VpnAuditLog for provisioning step logs

ALTER TABLE "VpnAuditLog" ADD COLUMN "step" TEXT;
ALTER TABLE "VpnAuditLog" ADD COLUMN "status" TEXT;
