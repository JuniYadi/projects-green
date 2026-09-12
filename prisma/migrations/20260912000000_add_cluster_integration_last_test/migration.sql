-- AlterTable: record the outcome of the last connection probe so the Settings
-- list can show "Active · unreachable 19:58" instead of only the DB flag.
ALTER TABLE "AppHostingClusterIntegration"
  ADD COLUMN IF NOT EXISTS "lastTestAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastTestOk" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "lastTestMessage" TEXT;
