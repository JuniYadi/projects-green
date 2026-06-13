-- CreateEnum
CREATE TYPE "VpnProtocol" AS ENUM ('OPENVPN', 'WIREGUARD', 'PROXY');

-- CreateEnum
CREATE TYPE "VpnSubscriptionStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "VpnProvisioningStatus" AS ENUM ('PENDING', 'PROVISIONING', 'ACTIVE', 'FAILED', 'REVOKED');

-- CreateTable
CREATE TABLE "VpnPackage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VpnPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VpnPackageServer" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VpnPackageServer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VpnSubscription" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "status" "VpnSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VpnSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VpnServerAccount" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "protocol" "VpnProtocol" NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT,
    "configEncrypted" TEXT,
    "provisioningStatus" "VpnProvisioningStatus" NOT NULL DEFAULT 'PENDING',
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VpnServerAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VpnPackage_isActive_idx" ON "VpnPackage"("isActive");

-- CreateIndex
CREATE INDEX "VpnPackageServer_packageId_idx" ON "VpnPackageServer"("packageId");

-- CreateIndex
CREATE INDEX "VpnPackageServer_serverId_idx" ON "VpnPackageServer"("serverId");

-- CreateIndex
CREATE UNIQUE INDEX "VpnPackageServer_packageId_serverId_key" ON "VpnPackageServer"("packageId", "serverId");

-- CreateIndex
CREATE INDEX "VpnSubscription_organizationId_status_idx" ON "VpnSubscription"("organizationId", "status");

-- CreateIndex
CREATE INDEX "VpnSubscription_packageId_idx" ON "VpnSubscription"("packageId");

-- CreateIndex
CREATE INDEX "VpnSubscription_currentPeriodEnd_idx" ON "VpnSubscription"("currentPeriodEnd");

-- CreateIndex
CREATE INDEX "VpnServerAccount_subscriptionId_idx" ON "VpnServerAccount"("subscriptionId");

-- CreateIndex
CREATE INDEX "VpnServerAccount_serverId_idx" ON "VpnServerAccount"("serverId");

-- CreateIndex
CREATE INDEX "VpnServerAccount_provisioningStatus_idx" ON "VpnServerAccount"("provisioningStatus");

-- CreateIndex
CREATE UNIQUE INDEX "VpnServerAccount_serverId_protocol_username_key" ON "VpnServerAccount"("serverId", "protocol", "username");

-- AddForeignKey
ALTER TABLE "VpnPackageServer" ADD CONSTRAINT "VpnPackageServer_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "VpnPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VpnPackageServer" ADD CONSTRAINT "VpnPackageServer_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "VpnServer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VpnServerAccount" ADD CONSTRAINT "VpnServerAccount_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "VpnSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VpnServerAccount" ADD CONSTRAINT "VpnServerAccount_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "VpnServer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
