-- CreateEnum
CREATE TYPE "VpnProvider" AS ENUM ('OPENVPN');

-- CreateEnum
CREATE TYPE "VpnRegionCode" AS ENUM ('INDONESIA');

-- CreateEnum
CREATE TYPE "VpnClientStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED', 'PROVISIONING_FAILED');

-- CreateTable
CREATE TABLE "VpnClient" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "provider" "VpnProvider" NOT NULL DEFAULT 'OPENVPN',
    "regionCode" "VpnRegionCode" NOT NULL DEFAULT 'INDONESIA',
    "clientName" TEXT NOT NULL,
    "status" "VpnClientStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "encryptedConfig" TEXT,
    "createdBy" TEXT,
    "revokedAt" TIMESTAMP(3),
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VpnClient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VpnClient_provider_clientName_key" ON "VpnClient"("provider", "clientName");

-- CreateIndex
CREATE INDEX "VpnClient_organizationId_status_idx" ON "VpnClient"("organizationId", "status");

-- CreateIndex
CREATE INDEX "VpnClient_subscriptionId_idx" ON "VpnClient"("subscriptionId");

-- CreateIndex
CREATE INDEX "VpnClient_currentPeriodEnd_idx" ON "VpnClient"("currentPeriodEnd");

-- AddForeignKey
ALTER TABLE "VpnClient" ADD CONSTRAINT "VpnClient_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
