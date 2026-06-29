-- CreateEnum
CREATE TYPE "EmailLogType" AS ENUM ('TICKET_CREATED', 'TICKET_REPLIED', 'TICKET_CLOSED', 'TICKET_ADMIN_ALERT');
CREATE TYPE "EmailLogStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'BOUNCED');

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT,
    "ticketNumber" TEXT,
    "recipientEmail" TEXT NOT NULL,
    "type" "EmailLogType" NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "EmailLogStatus" NOT NULL DEFAULT 'QUEUED',
    "errorMessage" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailLog_ticketId_idx" ON "EmailLog"("ticketId");
CREATE INDEX "EmailLog_ticketNumber_idx" ON "EmailLog"("ticketNumber");
CREATE INDEX "EmailLog_recipientEmail_idx" ON "EmailLog"("recipientEmail");
CREATE INDEX "EmailLog_status_idx" ON "EmailLog"("status");
CREATE INDEX "EmailLog_createdAt_idx" ON "EmailLog"("createdAt" DESC);
