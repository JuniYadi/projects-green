-- CreateEnum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ContainerImageStatus') THEN
        CREATE TYPE "ContainerImageStatus" AS ENUM ('ACTIVE', 'READY', 'EXPIRED', 'PURGED');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SecurityScanStatus') THEN
        CREATE TYPE "SecurityScanStatus" AS ENUM ('PASSED', 'WARNING', 'FAILED');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'VulnerabilitySeverity') THEN
        CREATE TYPE "VulnerabilitySeverity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'UNKNOWN');
    END IF;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "ApplicationContainerImage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "stackId" TEXT NOT NULL,
    "deploymentId" TEXT,
    "buildNumber" INTEGER NOT NULL,
    "imageTag" TEXT NOT NULL,
    "digest" TEXT,
    "sizeBytes" BIGINT,
    "status" "ContainerImageStatus" NOT NULL DEFAULT 'READY',
    "pushedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rotatedAt" TIMESTAMP(3),
    "purgedAt" TIMESTAMP(3),

    CONSTRAINT "ApplicationContainerImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ApplicationSecurityScan" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "stackId" TEXT NOT NULL,
    "imageId" TEXT NOT NULL,
    "imageTag" TEXT NOT NULL,
    "scannerEngine" TEXT NOT NULL DEFAULT 'trivy',
    "scannerVersion" TEXT NOT NULL DEFAULT '0.73.0',
    "status" "SecurityScanStatus" NOT NULL DEFAULT 'PASSED',
    "criticalCount" INTEGER NOT NULL DEFAULT 0,
    "highCount" INTEGER NOT NULL DEFAULT 0,
    "mediumCount" INTEGER NOT NULL DEFAULT 0,
    "lowCount" INTEGER NOT NULL DEFAULT 0,
    "unfixedCount" INTEGER NOT NULL DEFAULT 0,
    "storageKey" TEXT NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationSecurityScan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SecurityVulnerability" (
    "cveId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "severity" "VulnerabilitySeverity" NOT NULL,
    "cvssScore" DOUBLE PRECISION,
    "primaryUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecurityVulnerability_pkey" PRIMARY KEY ("cveId")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SecurityScanFinding" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "cveId" TEXT NOT NULL,
    "severity" "VulnerabilitySeverity" NOT NULL,
    "packageName" TEXT NOT NULL,
    "installedVersion" TEXT NOT NULL,
    "fixedVersion" TEXT,
    "sourceTarget" TEXT NOT NULL,
    "class" TEXT NOT NULL,
    "introducedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityScanFinding_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes
CREATE UNIQUE INDEX IF NOT EXISTS "ApplicationContainerImage_stackId_imageTag_key" ON "ApplicationContainerImage"("stackId", "imageTag");
CREATE INDEX IF NOT EXISTS "ApplicationContainerImage_organizationId_idx" ON "ApplicationContainerImage"("organizationId");
CREATE INDEX IF NOT EXISTS "ApplicationContainerImage_stackId_status_idx" ON "ApplicationContainerImage"("stackId", "status");

CREATE UNIQUE INDEX IF NOT EXISTS "ApplicationSecurityScan_imageId_key" ON "ApplicationSecurityScan"("imageId");
CREATE INDEX IF NOT EXISTS "ApplicationSecurityScan_organizationId_scannedAt_idx" ON "ApplicationSecurityScan"("organizationId", "scannedAt");
CREATE INDEX IF NOT EXISTS "ApplicationSecurityScan_stackId_status_idx" ON "ApplicationSecurityScan"("stackId", "status");

CREATE INDEX IF NOT EXISTS "SecurityVulnerability_severity_idx" ON "SecurityVulnerability"("severity");

CREATE UNIQUE INDEX IF NOT EXISTS "SecurityScanFinding_scanId_cveId_packageName_key" ON "SecurityScanFinding"("scanId", "cveId", "packageName");
CREATE INDEX IF NOT EXISTS "SecurityScanFinding_scanId_severity_idx" ON "SecurityScanFinding"("scanId", "severity");
CREATE INDEX IF NOT EXISTS "SecurityScanFinding_cveId_idx" ON "SecurityScanFinding"("cveId");
CREATE INDEX IF NOT EXISTS "SecurityScanFinding_packageName_idx" ON "SecurityScanFinding"("packageName");
CREATE INDEX IF NOT EXISTS "SecurityScanFinding_class_idx" ON "SecurityScanFinding"("class");

-- AddForeignKeys
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ApplicationContainerImage_stackId_fkey') THEN
        ALTER TABLE "ApplicationContainerImage" ADD CONSTRAINT "ApplicationContainerImage_stackId_fkey" FOREIGN KEY ("stackId") REFERENCES "ApplicationStack"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ApplicationContainerImage_deploymentId_fkey') THEN
        ALTER TABLE "ApplicationContainerImage" ADD CONSTRAINT "ApplicationContainerImage_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "Deployment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ApplicationSecurityScan_imageId_fkey') THEN
        ALTER TABLE "ApplicationSecurityScan" ADD CONSTRAINT "ApplicationSecurityScan_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "ApplicationContainerImage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ApplicationSecurityScan_stackId_fkey') THEN
        ALTER TABLE "ApplicationSecurityScan" ADD CONSTRAINT "ApplicationSecurityScan_stackId_fkey" FOREIGN KEY ("stackId") REFERENCES "ApplicationStack"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SecurityScanFinding_scanId_fkey') THEN
        ALTER TABLE "SecurityScanFinding" ADD CONSTRAINT "SecurityScanFinding_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "ApplicationSecurityScan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SecurityScanFinding_cveId_fkey') THEN
        ALTER TABLE "SecurityScanFinding" ADD CONSTRAINT "SecurityScanFinding_cveId_fkey" FOREIGN KEY ("cveId") REFERENCES "SecurityVulnerability"("cveId") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;
