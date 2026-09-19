-- AlterTable: Add web crawler and sync schedule fields
ALTER TABLE "AiKnowledgeDocument"
  ADD COLUMN IF NOT EXISTS "crawlMode" TEXT DEFAULT 'SINGLE_PAGE';
ALTER TABLE "AiKnowledgeDocument"
  ADD COLUMN IF NOT EXISTS "syncSchedule" TEXT DEFAULT 'MANUAL';
ALTER TABLE "AiKnowledgeDocument"
  ADD COLUMN IF NOT EXISTS "lastSyncedAt" TIMESTAMP(3);
