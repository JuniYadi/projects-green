CREATE TYPE "ApplicationDomainKind" AS ENUM ('MANAGED', 'CUSTOM');
CREATE TYPE "ApplicationDomainDnsStatus" AS ENUM ('PENDING', 'VERIFIED', 'FAILED');
CREATE TYPE "ApplicationDomainCertificateSource" AS ENUM ('MANAGED', 'UPLOADED');
CREATE TYPE "ApplicationDomainCertificateStatus" AS ENUM ('PENDING', 'ACTIVE', 'EXPIRED', 'INVALID', 'REVOKED');
CREATE TYPE "ApplicationDomainAllowlistMode" AS ENUM ('OPEN', 'ALLOWLIST_ONLY');

CREATE TABLE "AppHostingClusterEndpoint" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "clusterId" TEXT NOT NULL,
  "managedBaseDomain" TEXT NOT NULL,
  "cnameTarget" TEXT NOT NULL,
  "ipv4Addresses" TEXT[] NOT NULL,
  "ipv6Addresses" TEXT[] NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AppHostingClusterEndpoint_clusterId_key" UNIQUE ("clusterId"),
  CONSTRAINT "AppHostingClusterEndpoint_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "AppHostingCluster"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "AppHostingClusterEndpoint_isActive_idx" ON "AppHostingClusterEndpoint"("isActive");

CREATE TABLE "ApplicationDomain" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "stackId" TEXT NOT NULL,
  "clusterId" TEXT NOT NULL,
  "hostname" TEXT NOT NULL,
  "kind" "ApplicationDomainKind" NOT NULL,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "dnsStatus" "ApplicationDomainDnsStatus" NOT NULL DEFAULT 'PENDING',
  "expectedCnameTarget" TEXT NOT NULL,
  "verifiedAt" TIMESTAMP(3),
  "allowlistMode" "ApplicationDomainAllowlistMode" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ApplicationDomain_hostname_key" UNIQUE ("hostname"),
  CONSTRAINT "ApplicationDomain_stackId_fkey" FOREIGN KEY ("stackId") REFERENCES "ApplicationStack"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ApplicationDomain_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "AppHostingCluster"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ApplicationDomain_stackId_idx" ON "ApplicationDomain"("stackId");
CREATE INDEX "ApplicationDomain_clusterId_idx" ON "ApplicationDomain"("clusterId");
CREATE INDEX "ApplicationDomain_dnsStatus_idx" ON "ApplicationDomain"("dnsStatus");
CREATE INDEX "ApplicationDomain_stackId_isPrimary_idx" ON "ApplicationDomain"("stackId", "isPrimary");

CREATE TABLE "ApplicationDomainCertificate" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "domainId" TEXT NOT NULL,
  "source" "ApplicationDomainCertificateSource" NOT NULL,
  "status" "ApplicationDomainCertificateStatus" NOT NULL DEFAULT 'PENDING',
  "expiresAt" TIMESTAMP(3),
  "fingerprint" TEXT,
  "validationError" TEXT,
  "certificateCiphertext" TEXT,
  "privateKeyCiphertext" TEXT,
  "chainCiphertext" TEXT,
  "keyVersion" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ApplicationDomainCertificate_domainId_key" UNIQUE ("domainId"),
  CONSTRAINT "ApplicationDomainCertificate_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "ApplicationDomain"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ApplicationDomainAllowlistEntry" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "domainId" TEXT NOT NULL,
  "cidr" TEXT NOT NULL,
  "description" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ApplicationDomainAllowlistEntry_domainId_cidr_key" UNIQUE ("domainId", "cidr"),
  CONSTRAINT "ApplicationDomainAllowlistEntry_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "ApplicationDomain"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ApplicationDomainAllowlistEntry_domainId_enabled_position_idx" ON "ApplicationDomainAllowlistEntry"("domainId", "enabled", "position");
