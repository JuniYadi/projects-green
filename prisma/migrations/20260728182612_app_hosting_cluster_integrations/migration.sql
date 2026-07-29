-- CreateEnum
CREATE TYPE "AppHostingClusterStatus" AS ENUM ('PLANNED', 'ACTIVE', 'DEPRECATED');

-- CreateEnum
CREATE TYPE "AppHostingClusterIntegrationType" AS ENUM ('JENKINS', 'GITOPS', 'REGISTRY', 'ARGOCD', 'KUBECONFIG', 'OPENSEARCH', 'PROMETHEUS');

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
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
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

-- CreateIndex
CREATE UNIQUE INDEX "DeployEvent_deploymentId_type_key" ON "DeployEvent"("deploymentId", "type");

-- AddForeignKey
ALTER TABLE "ApplicationStack" ADD CONSTRAINT "ApplicationStack_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "AppHostingCluster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppHostingClusterIntegration" ADD CONSTRAINT "AppHostingClusterIntegration_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "AppHostingCluster"("id") ON DELETE CASCADE ON UPDATE CASCADE;
