-- CreateTable
CREATE TABLE "VaultSecretAuditLog" (
    id TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "stackId" TEXT NOT NULL,
    "workosUserId" TEXT NOT NULL,
    environment TEXT NOT NULL,
    "secretKey" TEXT NOT NULL,
    action TEXT NOT NULL DEFAULT 'SECRET_REVEALED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VaultSecretAuditLog_pkey" PRIMARY KEY (id)
);

-- CreateIndex
CREATE INDEX "VaultSecretAuditLog_organizationId_createdAt_idx"
ON "VaultSecretAuditLog" ("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "VaultSecretAuditLog_stackId_createdAt_idx"
ON "VaultSecretAuditLog" ("stackId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "VaultSecretAuditLog_workosUserId_createdAt_idx"
ON "VaultSecretAuditLog" ("workosUserId", "createdAt" DESC);
