-- AlterTable: Add allowInteractiveReplies to AiAgentProfile
ALTER TABLE "AiAgentProfile"
  ADD COLUMN IF NOT EXISTS "allowInteractiveReplies" BOOLEAN NOT NULL DEFAULT true;
