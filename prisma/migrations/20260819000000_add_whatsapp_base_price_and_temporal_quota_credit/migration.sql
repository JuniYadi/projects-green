-- AlterTable
ALTER TABLE "WhatsappQuotaCreditRate" DROP CONSTRAINT IF EXISTS "WhatsappQuotaCreditRate_pkey";
ALTER TABLE "WhatsappQuotaCreditRate"
ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS "effectiveTo" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT concat('wqcr_', md5(random()::text || clock_timestamp()::text)),
ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true,
ALTER COLUMN "country" SET DEFAULT 'ID',
ALTER COLUMN "description" DROP NOT NULL;

ALTER TABLE "WhatsappQuotaCreditRate" ADD CONSTRAINT "WhatsappQuotaCreditRate_pkey" PRIMARY KEY ("id");

-- CreateTable
CREATE TABLE IF NOT EXISTS "WhatsappBasePrice" (
    "id" TEXT NOT NULL,
    "category" "WhatsappBillingCategory" NOT NULL,
    "country" VARCHAR(2) NOT NULL DEFAULT 'ID',
    "basePrice" DECIMAL(12,2) NOT NULL,
    "metaCost" DECIMAL(12,2),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'IDR',
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsappBasePrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WhatsappBasePrice_category_country_effectiveFrom_isActive_idx" ON "WhatsappBasePrice"("category", "country", "effectiveFrom" DESC, "isActive");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WhatsappQuotaCreditRate_category_country_effectiveFrom_isAc_idx" ON "WhatsappQuotaCreditRate"("category", "country", "effectiveFrom" DESC, "isActive");
