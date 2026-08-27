-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "ProvisioningStatus" AS ENUM ('PENDING', 'PROVISIONING', 'ACTIVE', 'FAILED', 'REVOKED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "ServiceProvisionAccount" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "serviceType" "ServiceType" NOT NULL,
    "targetId" TEXT,
    "identifier" TEXT NOT NULL,
    "status" "ProvisioningStatus" NOT NULL DEFAULT 'PENDING',
    "encryptedSecret" TEXT,
    "vaultPath" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceProvisionAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ServiceProvisionAccount_subscriptionId_serviceType_idx" ON "ServiceProvisionAccount"("subscriptionId", "serviceType");
CREATE INDEX IF NOT EXISTS "ServiceProvisionAccount_status_idx" ON "ServiceProvisionAccount"("status");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "ServiceProvisionAccount" ADD CONSTRAINT "ServiceProvisionAccount_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
