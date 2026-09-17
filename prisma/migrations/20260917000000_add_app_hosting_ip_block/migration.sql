-- CreateTable
CREATE TABLE "AppHostingIpBlock" (
    "id" TEXT NOT NULL,
    "stackId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "durationMinutes" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "enforcedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedBy" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppHostingIpBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AppHostingIpBlock_stackId_status_idx" ON "AppHostingIpBlock"("stackId", "status");

-- CreateIndex
CREATE INDEX "AppHostingIpBlock_organizationId_ipAddress_idx" ON "AppHostingIpBlock"("organizationId", "ipAddress");

-- CreateIndex
CREATE INDEX "AppHostingIpBlock_expiresAt_idx" ON "AppHostingIpBlock"("expiresAt");

-- AddForeignKey
ALTER TABLE "AppHostingIpBlock" ADD CONSTRAINT "AppHostingIpBlock_stackId_fkey" FOREIGN KEY ("stackId") REFERENCES "ApplicationStack"("id") ON DELETE CASCADE ON UPDATE CASCADE;
