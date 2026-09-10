-- AlterTable
ALTER TABLE "WhatsappMetaApp" ADD COLUMN "systemTokenEncrypted" TEXT,
ADD COLUMN "defaultVersion" TEXT NOT NULL DEFAULT 'v24.0';

-- AlterTable
ALTER TABLE "WhatsappDevice" ALTER COLUMN "whatsappVersion" DROP NOT NULL;
