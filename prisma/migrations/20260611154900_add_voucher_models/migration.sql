-- CreateEnum
CREATE TYPE "VoucherStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'DEPLETED', 'DISABLED');

-- CreateTable
CREATE TABLE "Voucher" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "prefix" TEXT,
    "status" "VoucherStatus" NOT NULL DEFAULT 'ACTIVE',
    "maxClaims" INTEGER NOT NULL DEFAULT 1,
    "claimedCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "targetWorkosUserId" TEXT,
    "targetOrganizationId" TEXT,
    "createdByWorkosUserId" TEXT NOT NULL,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Voucher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoucherClaim" (
    "id" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "workosUserId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "billingAdjustmentId" TEXT,
    "metadataJson" JSONB,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoucherClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Voucher_code_key" ON "Voucher"("code");

-- CreateIndex
CREATE INDEX "Voucher_status_expiresAt_idx" ON "Voucher"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "Voucher_targetWorkosUserId_idx" ON "Voucher"("targetWorkosUserId");

-- CreateIndex
CREATE INDEX "Voucher_targetOrganizationId_idx" ON "Voucher"("targetOrganizationId");

-- CreateIndex
CREATE INDEX "Voucher_code_status_idx" ON "Voucher"("code", "status");

-- CreateIndex
CREATE UNIQUE INDEX "VoucherClaim_voucherId_workosUserId_key" ON "VoucherClaim"("voucherId", "workosUserId");

-- CreateIndex
CREATE INDEX "VoucherClaim_workosUserId_claimedAt_idx" ON "VoucherClaim"("workosUserId", "claimedAt" DESC);

-- CreateIndex
CREATE INDEX "VoucherClaim_voucherId_claimedAt_idx" ON "VoucherClaim"("voucherId", "claimedAt" DESC);

-- CreateIndex
CREATE INDEX "VoucherClaim_organizationId_idx" ON "VoucherClaim"("organizationId");

-- AddForeignKey
ALTER TABLE "VoucherClaim" ADD CONSTRAINT "VoucherClaim_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "Voucher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
