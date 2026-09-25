ALTER TYPE "EmailLogType" ADD VALUE 'APP_HOSTING_READY';
ALTER TABLE "EmailLog" ADD COLUMN "eventKey" TEXT;
CREATE UNIQUE INDEX "EmailLog_eventKey_key" ON "EmailLog"("eventKey");
