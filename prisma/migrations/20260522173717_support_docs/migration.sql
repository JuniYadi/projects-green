-- DropIndex
DROP INDEX "SupportTicket_priority_idx";

-- DropIndex
DROP INDEX "SupportTicket_service_idx";

-- AlterTable
ALTER TABLE "KnowledgeDocument" ALTER COLUMN "notes" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SupportTicket" ALTER COLUMN "priority" DROP DEFAULT;

-- RenameIndex
ALTER INDEX "SupportTicketAttachmentUploadSession_organizationId_uploaderW_i" RENAME TO "SupportTicketAttachmentUploadSession_organizationId_uploade_idx";
