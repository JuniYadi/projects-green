-- CreateTable
CREATE TABLE IF NOT EXISTS "AiIntegrationConnection" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "baseUrl" TEXT NOT NULL,
    "encryptedHeadersJson" TEXT,
    "authType" TEXT NOT NULL DEFAULT 'NONE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiIntegrationConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AiIntegrationConnection_organizationId_name_key" ON "AiIntegrationConnection"("organizationId", "name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AiIntegrationConnection_organizationId_isActive_idx" ON "AiIntegrationConnection"("organizationId", "isActive");
