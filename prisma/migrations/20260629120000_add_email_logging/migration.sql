-- Create EmailLog table for tracking sent notification emails
CREATE TYPE "EmailLogType" AS ENUM ('TICKET_CREATED', 'TICKET_REPLIED', 'TICKET_CLOSED', 'TICKET_ADMIN_ALERT');

CREATE TYPE "EmailLogStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'BOUNCED');

CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT,
    "ticket_number" TEXT,
    "recipient_email" TEXT NOT NULL,
    "type" "EmailLogType" NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "EmailLogStatus" NOT NULL DEFAULT 'QUEUED',
    "error_message" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmailLog_ticket_id_idx" ON "EmailLog"("ticket_id");
CREATE INDEX "EmailLog_ticket_number_idx" ON "EmailLog"("ticket_number");
CREATE INDEX "EmailLog_recipient_email_idx" ON "EmailLog"("recipient_email");
CREATE INDEX "EmailLog_status_idx" ON "EmailLog"("status");
CREATE INDEX "EmailLog_created_at_idx" ON "EmailLog"("created_at" DESC);
