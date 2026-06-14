-- CreateEnum
CREATE TYPE "BillingCurrency" AS ENUM ('USD', 'IDR');

-- CreateEnum
CREATE TYPE "BillingContactRole" AS ENUM ('OWNER', 'FINANCE', 'ACCOUNTING', 'GENERAL');

-- AlterTable
ALTER TABLE "BillingAccount" ADD COLUMN     "preferredCurrency" "BillingCurrency" NOT NULL DEFAULT 'USD';

-- AlterTable
ALTER TABLE "VpnServer" ADD COLUMN     "ipAddress" TEXT,
ADD COLUMN     "sshPort" INTEGER NOT NULL DEFAULT 22;

-- CreateTable
CREATE TABLE "BillingContact" (
    "id" TEXT NOT NULL,
    "billingAccountId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "BillingContactRole" NOT NULL DEFAULT 'GENERAL',
    "notifyOnInvoice" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnLowBalance" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnSupport" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingContact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BillingContact_billingAccountId_idx" ON "BillingContact"("billingAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingContact_billingAccountId_email_key" ON "BillingContact"("billingAccountId", "email");

-- AddForeignKey
ALTER TABLE "BillingContact" ADD CONSTRAINT "BillingContact_billingAccountId_fkey" FOREIGN KEY ("billingAccountId") REFERENCES "BillingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
