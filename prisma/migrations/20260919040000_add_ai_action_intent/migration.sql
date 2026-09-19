-- CreateTable
CREATE TABLE IF NOT EXISTS "AiActionIntent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "agentProfileId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "connectionId" TEXT,
    "subpath" TEXT NOT NULL DEFAULT '/',
    "method" TEXT NOT NULL DEFAULT 'GET',
    "slots" JSONB NOT NULL DEFAULT '[]',
    "requireCustomerConfirmation" BOOLEAN NOT NULL DEFAULT false,
    "enableMultimodalVision" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiActionIntent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AiActionIntent_organizationId_isActive_idx" ON "AiActionIntent"("organizationId", "isActive");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AiActionIntent_agentProfileId_idx" ON "AiActionIntent"("agentProfileId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AiActionIntent_agentProfileId_fkey'
  ) THEN
    ALTER TABLE "AiActionIntent" ADD CONSTRAINT "AiActionIntent_agentProfileId_fkey" FOREIGN KEY ("agentProfileId") REFERENCES "AiAgentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AiActionIntent_connectionId_fkey'
  ) THEN
    ALTER TABLE "AiActionIntent" ADD CONSTRAINT "AiActionIntent_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "AiIntegrationConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
