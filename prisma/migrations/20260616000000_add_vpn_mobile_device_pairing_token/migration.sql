-- CreateEnum
CREATE TYPE "VpnDeviceStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'REVOKED');

-- CreateEnum
CREATE TYPE "VpnPairingMethod" AS ENUM ('SSO', 'QR');

-- CreateTable
CREATE TABLE "VpnMobileDevice" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "userId" TEXT,
    "deviceName" TEXT NOT NULL,
    "deviceFingerprint" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "osVersion" TEXT,
    "appVersion" TEXT,
    "pairedVia" "VpnPairingMethod" NOT NULL,
    "status" "VpnDeviceStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastSeenAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,
    "revokedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VpnMobileDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VpnPairingToken" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "claimedAt" TIMESTAMP(3),
    "claimedByDevice" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VpnPairingToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VpnAuditLog" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VpnAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VpnMobileDevice_subscriptionId_deviceFingerprint_key" ON "VpnMobileDevice"("subscriptionId", "deviceFingerprint");

-- CreateIndex
CREATE INDEX "VpnMobileDevice_organizationId_status_idx" ON "VpnMobileDevice"("organizationId", "status");

-- CreateIndex
CREATE INDEX "VpnMobileDevice_subscriptionId_idx" ON "VpnMobileDevice"("subscriptionId");

-- CreateIndex
CREATE INDEX "VpnMobileDevice_userId_idx" ON "VpnMobileDevice"("userId");

-- CreateIndex
CREATE INDEX "VpnMobileDevice_status_idx" ON "VpnMobileDevice"("status");

-- CreateIndex
CREATE UNIQUE INDEX "VpnPairingToken_token_key" ON "VpnPairingToken"("token");

-- CreateIndex
CREATE INDEX "VpnPairingToken_subscriptionId_idx" ON "VpnPairingToken"("subscriptionId");

-- CreateIndex
CREATE INDEX "VpnPairingToken_token_idx" ON "VpnPairingToken"("token");

-- CreateIndex
CREATE INDEX "VpnPairingToken_expiresAt_idx" ON "VpnPairingToken"("expiresAt");

-- CreateIndex
CREATE INDEX "VpnAuditLog_deviceId_createdAt_idx" ON "VpnAuditLog"("deviceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "VpnAuditLog_action_createdAt_idx" ON "VpnAuditLog"("action", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "VpnMobileDevice" ADD CONSTRAINT "VpnMobileDevice_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "VpnSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VpnPairingToken" ADD CONSTRAINT "VpnPairingToken_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "VpnSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
