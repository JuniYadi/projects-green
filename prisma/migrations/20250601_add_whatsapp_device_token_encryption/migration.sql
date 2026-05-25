-- AlterTable
ALTER TABLE "WhatsappDevice" ADD COLUMN "tokenEncrypted" TEXT,
ADD COLUMN "tokenIv" TEXT,
ALTER COLUMN "token" DROP NOT NULL;
