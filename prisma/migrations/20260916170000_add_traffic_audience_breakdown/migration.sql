-- AlterTable
ALTER TABLE "AppHostingDailyTrafficSnapshot" ADD COLUMN IF NOT EXISTS "audienceJson" JSONB NOT NULL DEFAULT '{}';
