-- CreateTable
CREATE TABLE IF NOT EXISTS "AppHostingDailyTrafficSnapshot" (
    "id" TEXT NOT NULL,
    "stackId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "totalRequests" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "totalBytes" BIGINT NOT NULL DEFAULT 0,
    "avgLatencyMs" INTEGER NOT NULL DEFAULT 0,
    "hourlyTrendJson" JSONB NOT NULL DEFAULT '[]',
    "topPathsJson" JSONB NOT NULL DEFAULT '[]',
    "errorPathsJson" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppHostingDailyTrafficSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AppHostingDailyTrafficSnapshot_stackId_date_idx" ON "AppHostingDailyTrafficSnapshot"("stackId", "date");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AppHostingDailyTrafficSnapshot_stackId_date_key" ON "AppHostingDailyTrafficSnapshot"("stackId", "date");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'AppHostingDailyTrafficSnapshot_stackId_fkey'
    ) THEN
        ALTER TABLE "AppHostingDailyTrafficSnapshot" ADD CONSTRAINT "AppHostingDailyTrafficSnapshot_stackId_fkey" FOREIGN KEY ("stackId") REFERENCES "ApplicationStack"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
