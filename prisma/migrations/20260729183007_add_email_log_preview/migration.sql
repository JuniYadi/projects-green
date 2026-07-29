-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.

ALTER TYPE "EmailLogType" ADD VALUE 'INVOICE_CREATED';
ALTER TYPE "EmailLogType" ADD VALUE 'INVOICE_PAYMENT_REMINDER';
ALTER TYPE "EmailLogType" ADD VALUE 'INVOICE_PAID';
ALTER TYPE "EmailLogType" ADD VALUE 'INVOICE_OVERDUE';
ALTER TYPE "EmailLogType" ADD VALUE 'INVOICE_CANCELLED';
ALTER TYPE "EmailLogType" ADD VALUE 'VPN_SUBSCRIPTION_CREATED';
ALTER TYPE "EmailLogType" ADD VALUE 'VPN_PROVISIONING_SUCCESS';
ALTER TYPE "EmailLogType" ADD VALUE 'VPN_PROVISIONING_FAILED';
ALTER TYPE "EmailLogType" ADD VALUE 'VPN_RENEWAL_SUCCESS';
ALTER TYPE "EmailLogType" ADD VALUE 'VPN_RENEWAL_FAILED';
ALTER TYPE "EmailLogType" ADD VALUE 'VPN_SUBSCRIPTION_SUSPENDED';
ALTER TYPE "EmailLogType" ADD VALUE 'VPN_SUBSCRIPTION_EXPIRED';
ALTER TYPE "EmailLogType" ADD VALUE 'VPN_SUBSCRIPTION_CANCELLED';

-- AlterTable
ALTER TABLE "EmailLog" ADD COLUMN     "bodyHtml" TEXT,
ADD COLUMN     "organizationId" TEXT,
ADD COLUMN     "providerMessageId" TEXT,
ADD COLUMN     "relatedEntityId" TEXT,
ADD COLUMN     "relatedEntityType" TEXT;

-- CreateIndex
CREATE INDEX "EmailLog_organizationId_idx" ON "EmailLog"("organizationId");

-- CreateIndex
CREATE INDEX "EmailLog_type_idx" ON "EmailLog"("type");
