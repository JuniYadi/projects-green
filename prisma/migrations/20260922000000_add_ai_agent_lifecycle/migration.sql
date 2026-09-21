CREATE TYPE "AiAgentStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');

ALTER TABLE "AiAgentProfile"
ADD COLUMN "status" "AiAgentStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN "archivedAt" TIMESTAMP(3);

UPDATE "AiAgentProfile" AS agent
SET "status" = CASE
  WHEN agent."isActive" = false THEN 'PAUSED'::"AiAgentStatus"
  WHEN EXISTS (
    SELECT 1
    FROM "AiChannelBinding" AS binding
    WHERE binding."agentProfileId" = agent."id"
      AND binding."isActive" = true
  ) THEN 'ACTIVE'::"AiAgentStatus"
  ELSE 'DRAFT'::"AiAgentStatus"
END;

CREATE INDEX "AiAgentProfile_organizationId_status_idx"
ON "AiAgentProfile"("organizationId", "status");
