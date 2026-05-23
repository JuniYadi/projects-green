-- CreateEnum
CREATE TYPE "SupportTicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "SupportTicketService" AS ENUM (
  'AUTH',
  'BILLING',
  'DEPLOY',
  'DOMAINS',
  'INTEGRATIONS',
  'DATA',
  'OTHER'
);

-- CreateEnum
CREATE TYPE "SupportTicketAttachmentUploadTarget" AS ENUM ('CREATE', 'REPLY');

-- AlterTable
ALTER TABLE "SupportTicket"
ADD COLUMN "priority" "SupportTicketPriority" NOT NULL DEFAULT 'MEDIUM',
ADD COLUMN "service" "SupportTicketService",
ADD COLUMN "secureForm" TEXT;

-- AlterTable
ALTER TABLE "SupportTicketReply"
ADD COLUMN "secureForm" TEXT;

-- CreateTable
CREATE TABLE "SupportTicketAttachmentUploadSession" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "uploaderWorkosUserId" TEXT NOT NULL,
  "target" "SupportTicketAttachmentUploadTarget" NOT NULL,
  "ticketId" TEXT,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "checksumSha256" TEXT,
  "storageKey" TEXT NOT NULL,
  "storageBucket" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "registeredAt" TIMESTAMP(3),
  "consumedAt" TIMESTAMP(3),
  "consumedTicketId" TEXT,
  "consumedReplyId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SupportTicketAttachmentUploadSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupportTicketAttachmentUploadSession_organizationId_uploaderW_idx"
ON "SupportTicketAttachmentUploadSession"(
  "organizationId",
  "uploaderWorkosUserId"
);

-- CreateIndex
CREATE INDEX "SupportTicketAttachmentUploadSession_target_ticketId_idx"
ON "SupportTicketAttachmentUploadSession"("target", "ticketId");

-- CreateIndex
CREATE INDEX "SupportTicketAttachmentUploadSession_expiresAt_idx"
ON "SupportTicketAttachmentUploadSession"("expiresAt");

-- CreateIndex
CREATE INDEX "SupportTicketAttachmentUploadSession_consumedAt_idx"
ON "SupportTicketAttachmentUploadSession"("consumedAt");

-- CreateIndex
CREATE INDEX "SupportTicket_priority_idx" ON "SupportTicket"("priority");

-- CreateIndex
CREATE INDEX "SupportTicket_service_idx" ON "SupportTicket"("service");

-- AddForeignKey
ALTER TABLE "SupportTicketAttachmentUploadSession"
ADD CONSTRAINT "SupportTicketAttachmentUploadSession_consumedTicketId_fkey"
FOREIGN KEY ("consumedTicketId") REFERENCES "SupportTicket"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicketAttachmentUploadSession"
ADD CONSTRAINT "SupportTicketAttachmentUploadSession_consumedReplyId_fkey"
FOREIGN KEY ("consumedReplyId") REFERENCES "SupportTicketReply"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
