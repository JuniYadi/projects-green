CREATE TYPE "WhatsappOrganizationApiKeyStatus" AS ENUM ('ACTIVE', 'REVOKED');

CREATE TABLE "WhatsappOrganizationApiKey" (
    id TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    fingerprint TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    status "WhatsappOrganizationApiKeyStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdByWorkosUserId" TEXT,
    "rotatedByWorkosUserId" TEXT,
    "revokedByWorkosUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rotatedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "lastUsedIp" TEXT,
    "lastUsedUserAgent" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappOrganizationApiKey_pkey" PRIMARY KEY (id)
);

CREATE UNIQUE INDEX "WhatsappOrganizationApiKey_fingerprint_key"
ON "WhatsappOrganizationApiKey" (fingerprint);

CREATE UNIQUE INDEX "WhatsappOrganizationApiKey_keyHash_key"
ON "WhatsappOrganizationApiKey" ("keyHash");

CREATE UNIQUE INDEX "WhatsappOrganizationApiKey_one_active_per_org_key"
ON "WhatsappOrganizationApiKey" ("organizationId")
WHERE status = 'ACTIVE';

CREATE INDEX "WhatsappOrganizationApiKey_organizationId_createdAt_idx"
ON "WhatsappOrganizationApiKey" ("organizationId", "createdAt" DESC);

CREATE INDEX "WhatsappOrganizationApiKey_organizationId_status_idx"
ON "WhatsappOrganizationApiKey" ("organizationId", status);

CREATE INDEX "WhatsappOrganizationApiKey_status_createdAt_idx"
ON "WhatsappOrganizationApiKey" (status, "createdAt" DESC);
