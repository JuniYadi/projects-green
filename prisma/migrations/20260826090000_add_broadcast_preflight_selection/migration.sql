ALTER TABLE "WhatsappBroadcastCampaign"
ADD COLUMN "templateId" TEXT,
ADD COLUMN "acknowledgeMultiDay" BOOLEAN NOT NULL DEFAULT false;
