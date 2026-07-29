-- CreateEnum
CREATE TYPE "AppHostingClusterStatus" AS ENUM ('PLANNED', 'ACTIVE', 'DEPRECATED');

-- CreateEnum
CREATE TYPE "AppHostingClusterIntegrationType" AS ENUM ('JENKINS', 'GITOPS', 'REGISTRY', 'ARGOCD', 'KUBECONFIG', 'OPENSEARCH', 'PROMETHEUS');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ApplicationDeployEventType" ADD VALUE 'JENKINS_JOB_TRIGGERED';
ALTER TYPE "ApplicationDeployEventType" ADD VALUE 'JENKINS_BUILD_QUEUED';
ALTER TYPE "ApplicationDeployEventType" ADD VALUE 'JENKINS_BUILD_RUNNING';
ALTER TYPE "ApplicationDeployEventType" ADD VALUE 'JENKINS_BUILD_COMPLETED';
ALTER TYPE "ApplicationDeployEventType" ADD VALUE 'IMAGE_TAG_RECEIVED';
ALTER TYPE "ApplicationDeployEventType" ADD VALUE 'GITOPS_COMMIT_CREATED';
ALTER TYPE "ApplicationDeployEventType" ADD VALUE 'POD_READY';

-- AlterTable
ALTER TABLE "ApplicationStack" ADD COLUMN     "clusterId" TEXT;

-- CreateTable
CREATE TABLE "AppHostingCluster" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "status" "AppHostingClusterStatus" NOT NULL DEFAULT 'PLANNED',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppHostingCluster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppHostingClusterIntegration" (
    "id" TEXT NOT NULL,
    "clusterId" TEXT NOT NULL,
    "type" "AppHostingClusterIntegrationType" NOT NULL,
    "metaJson" JSONB NOT NULL DEFAULT '{}',
    "secretCiphertext" TEXT,
    "secretPreview" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppHostingClusterIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AppHostingCluster_code_key" ON "AppHostingCluster"("code");

-- CreateIndex
CREATE INDEX "AppHostingCluster_status_idx" ON "AppHostingCluster"("status");

-- CreateIndex
CREATE INDEX "AppHostingCluster_isDefault_idx" ON "AppHostingCluster"("isDefault");

-- CreateIndex
CREATE INDEX "AppHostingClusterIntegration_clusterId_idx" ON "AppHostingClusterIntegration"("clusterId");

-- CreateIndex
CREATE INDEX "AppHostingClusterIntegration_type_idx" ON "AppHostingClusterIntegration"("type");

-- CreateIndex
CREATE INDEX "AppHostingClusterIntegration_isActive_idx" ON "AppHostingClusterIntegration"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "AppHostingClusterIntegration_clusterId_type_key" ON "AppHostingClusterIntegration"("clusterId", "type");

-- CreateIndex
CREATE INDEX "ApplicationStack_clusterId_idx" ON "ApplicationStack"("clusterId");

-- AddForeignKey
ALTER TABLE "ApplicationStack" ADD CONSTRAINT "ApplicationStack_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "AppHostingCluster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppHostingClusterIntegration" ADD CONSTRAINT "AppHostingClusterIntegration_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "AppHostingCluster"("id") ON DELETE CASCADE ON UPDATE CASCADE;
