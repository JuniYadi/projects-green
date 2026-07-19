/*
  Warnings:

  - You are about to drop the `CloudflareDnsCredential` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "AppCredentialType" AS ENUM ('GITHUB_APP', 'GITHUB_TOKEN', 'CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_LEGACY_TOKEN');

-- CreateEnum
CREATE TYPE "AppCredentialStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED', 'PENDING');

-- DropTable
DROP TABLE "CloudflareDnsCredential";

-- CreateTable
CREATE TABLE "AppCredential" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "AppCredentialType" NOT NULL,
    "name" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "encryptedJSON" TEXT NOT NULL,
    "maskedPreview" TEXT NOT NULL,
    "status" "AppCredentialStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppCredential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AppCredential_organizationId_idx" ON "AppCredential"("organizationId");

-- CreateIndex
CREATE INDEX "AppCredential_organizationId_type_idx" ON "AppCredential"("organizationId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "AppCredential_organizationId_type_name_key" ON "AppCredential"("organizationId", "type", "name");
