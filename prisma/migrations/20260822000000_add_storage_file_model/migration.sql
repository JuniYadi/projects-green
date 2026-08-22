-- CreateEnum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StorageFileStatus') THEN
        CREATE TYPE "StorageFileStatus" AS ENUM ('PENDING', 'ACTIVE', 'DELETED');
    END IF;
END$$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "StorageFile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "uploadedByUserId" TEXT,
    "purpose" TEXT NOT NULL DEFAULT 'general',
    "bucket" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL DEFAULT 0,
    "status" "StorageFileStatus" NOT NULL DEFAULT 'PENDING',
    "publicUrl" TEXT,
    "metadata" JSONB,
    "expiresAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorageFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "StorageFile_storageKey_key" ON "StorageFile"("storageKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StorageFile_organizationId_status_idx" ON "StorageFile"("organizationId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StorageFile_status_expiresAt_idx" ON "StorageFile"("status", "expiresAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StorageFile_organizationId_purpose_idx" ON "StorageFile"("organizationId", "purpose");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StorageFile_createdAt_idx" ON "StorageFile"("createdAt" DESC);
