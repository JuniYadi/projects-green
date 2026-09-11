-- CreateTable
CREATE TABLE IF NOT EXISTS "AppHostingDailyLogSnapshot" (
    "id" TEXT NOT NULL,
    "stackId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "totalLogs" INTEGER NOT NULL DEFAULT 0,
    "infoCount" INTEGER NOT NULL DEFAULT 0,
    "warnCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "healthScore" INTEGER NOT NULL DEFAULT 100,
    "hourlyTrendJson" JSONB NOT NULL DEFAULT '[]',
    "topErrorsJson" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppHostingDailyLogSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AppHostingDailyLogSnapshot_stackId_date_idx" ON "AppHostingDailyLogSnapshot"("stackId", "date");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AppHostingDailyLogSnapshot_stackId_date_key" ON "AppHostingDailyLogSnapshot"("stackId", "date");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'AppHostingDailyLogSnapshot_stackId_fkey'
    ) THEN
        ALTER TABLE "AppHostingDailyLogSnapshot" ADD CONSTRAINT "AppHostingDailyLogSnapshot_stackId_fkey" FOREIGN KEY ("stackId") REFERENCES "ApplicationStack"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
