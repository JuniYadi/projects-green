-- CreateTable
-- Secret columns store ciphertext only; plaintext values are not persisted.
CREATE TABLE "WhatsappMetaApp" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "metaAppId" TEXT NOT NULL,
    "appSecretEncrypted" TEXT NOT NULL,
    "verifyTokenEncrypted" TEXT NOT NULL,
    "webhookKey" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappMetaApp_pkey" PRIMARY KEY ("id")
);

-- Add nullable association for existing devices
ALTER TABLE "WhatsappDevice" ADD COLUMN "whatsappMetaAppId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappMetaApp_metaAppId_key" ON "WhatsappMetaApp"("metaAppId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappMetaApp_webhookKey_key" ON "WhatsappMetaApp"("webhookKey");

-- CreateIndex
CREATE INDEX "WhatsappMetaApp_active_idx" ON "WhatsappMetaApp"("active");

-- CreateIndex
CREATE INDEX "WhatsappDevice_whatsappMetaAppId_idx" ON "WhatsappDevice"("whatsappMetaAppId");

-- CreateIndex
CREATE INDEX "WhatsappDevice_whatsappPhoneId_idx" ON "WhatsappDevice"("whatsappPhoneId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappDevice_whatsappMetaAppId_whatsappPhoneId_key" ON "WhatsappDevice"("whatsappMetaAppId", "whatsappPhoneId");

-- AddForeignKey
ALTER TABLE "WhatsappDevice" ADD CONSTRAINT "WhatsappDevice_whatsappMetaAppId_fkey" FOREIGN KEY ("whatsappMetaAppId") REFERENCES "WhatsappMetaApp"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
