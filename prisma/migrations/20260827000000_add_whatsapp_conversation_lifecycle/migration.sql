-- CreateEnum
CREATE TYPE "WhatsappConversationStatus" AS ENUM ('OPEN', 'PENDING', 'RESOLVED');

-- CreateEnum
CREATE TYPE "WhatsappConversationStage" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "WhatsappActivityType" AS ENUM ('STATUS_CHANGE', 'ASSIGNMENT_CHANGE', 'STAGE_CHANGE', 'NOTE_ADDED', 'CSAT_SURVEY_SENT', 'CSAT_RATING_RECEIVED');

-- AlterTable
ALTER TABLE "WhatsappConversation"
ADD COLUMN "status" "WhatsappConversationStatus" NOT NULL DEFAULT 'OPEN',
ADD COLUMN "stage" "WhatsappConversationStage",
ADD COLUMN "assigneeId" TEXT,
ADD COLUMN "lastReadAt" TIMESTAMP(3),
ADD COLUMN "csatScore" INTEGER;

-- CreateTable
CREATE TABLE "WhatsappConversationNote" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorName" TEXT,
    "body" TEXT NOT NULL,
    "mentions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappConversationNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsappConversationActivity" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT,
    "type" "WhatsappActivityType" NOT NULL,
    "fromValue" TEXT,
    "toValue" TEXT,
    "noteId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsappConversationActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WhatsappConversation_organizationId_status_idx" ON "WhatsappConversation"("organizationId", "status");
CREATE INDEX "WhatsappConversation_organizationId_assigneeId_idx" ON "WhatsappConversation"("organizationId", "assigneeId");
CREATE INDEX "WhatsappConversationNote_conversationId_createdAt_idx" ON "WhatsappConversationNote"("conversationId", "createdAt");
CREATE INDEX "WhatsappConversationActivity_conversationId_createdAt_idx" ON "WhatsappConversationActivity"("conversationId", "createdAt");

-- AddForeignKey
ALTER TABLE "WhatsappConversationNote" ADD CONSTRAINT "WhatsappConversationNote_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "WhatsappConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappConversationActivity" ADD CONSTRAINT "WhatsappConversationActivity_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "WhatsappConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappConversationActivity" ADD CONSTRAINT "WhatsappConversationActivity_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "WhatsappConversationNote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
