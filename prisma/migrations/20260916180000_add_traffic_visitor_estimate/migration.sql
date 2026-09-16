-- AlterTable
ALTER TABLE "AppHostingDailyTrafficSnapshot" ADD COLUMN IF NOT EXISTS "automatedCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AppHostingDailyTrafficSnapshot" ADD COLUMN IF NOT EXISTS "visitorEstimate" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AppHostingDailyTrafficSnapshot" ADD COLUMN IF NOT EXISTS "visitorEstMethod" TEXT NOT NULL DEFAULT 'ip_cardinality_v1';
