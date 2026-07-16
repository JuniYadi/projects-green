-- Add internal notes to conversation
ALTER TABLE "WhatsappConversation" ADD COLUMN "internalNotes" TEXT;

-- Create label model
CREATE TABLE "WhatsappConversationLabel" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "color" VARCHAR(7),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappConversationLabel_pkey" PRIMARY KEY ("id")
);

-- Create join table
CREATE TABLE "WhatsappConversationLabelOnConversation" (
    "conversationId" TEXT NOT NULL,
    "labelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsappConversationLabelOnConversation_pkey" PRIMARY KEY ("conversationId","labelId")
);

-- Indexes
CREATE INDEX "WhatsappConversationLabel_organizationId_idx" ON "WhatsappConversationLabel"("organizationId");
CREATE UNIQUE INDEX "WhatsappConversationLabel_organizationId_name_key" ON "WhatsappConversationLabel"("organizationId", "name");
CREATE INDEX "WhatsappConversationLabelOnConversation_labelId_idx" ON "WhatsappConversationLabelOnConversation"("labelId");

-- Foreign keys
ALTER TABLE "WhatsappConversationLabelOnConversation" ADD CONSTRAINT "WhatsappConversationLabelOnConversation_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "WhatsappConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WhatsappConversationLabelOnConversation" ADD CONSTRAINT "WhatsappConversationLabelOnConversation_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "WhatsappConversationLabel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
