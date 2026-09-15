-- AlterTable
ALTER TABLE "AppHostingDailyTrafficSnapshot" ADD COLUMN IF NOT EXISTS "topIpsJson" JSONB NOT NULL DEFAULT '[]';
