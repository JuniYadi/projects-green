-- CreateEnum
CREATE TYPE "VpnServerHealth" AS ENUM ('HEALTHY', 'WARNING', 'DOWN', 'UNKNOWN');

-- CreateTable
CREATE TABLE "VpnRegion" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "flagEmoji" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VpnRegion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VpnSshKey" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "privateKey" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VpnSshKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VpnServer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "sshKeyId" TEXT NOT NULL,
    "sshUser" TEXT NOT NULL DEFAULT 'root',
    "hasOpenVpn" BOOLEAN NOT NULL DEFAULT false,
    "openVpnPort" INTEGER,
    "hasWireGuard" BOOLEAN NOT NULL DEFAULT false,
    "wireGuardPort" INTEGER,
    "hasProxy" BOOLEAN NOT NULL DEFAULT false,
    "proxyPort" INTEGER,
    "health" "VpnServerHealth" NOT NULL DEFAULT 'UNKNOWN',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VpnServer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VpnRegion_slug_key" ON "VpnRegion"("slug");

-- CreateIndex
CREATE INDEX "VpnRegion_isActive_idx" ON "VpnRegion"("isActive");

-- CreateIndex
CREATE INDEX "VpnSshKey_fingerprint_idx" ON "VpnSshKey"("fingerprint");

-- CreateIndex
CREATE INDEX "VpnServer_regionId_idx" ON "VpnServer"("regionId");

-- CreateIndex
CREATE INDEX "VpnServer_sshKeyId_idx" ON "VpnServer"("sshKeyId");

-- CreateIndex
CREATE INDEX "VpnServer_isActive_idx" ON "VpnServer"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "VpnServer_name_key" ON "VpnServer"("name");

-- AddForeignKey
ALTER TABLE "VpnServer" ADD CONSTRAINT "VpnServer_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "VpnRegion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VpnServer" ADD CONSTRAINT "VpnServer_sshKeyId_fkey" FOREIGN KEY ("sshKeyId") REFERENCES "VpnSshKey"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
