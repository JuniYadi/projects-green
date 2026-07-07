-- Add REPLY to WhatsappBillingCategory enum
ALTER TYPE "WhatsappBillingCategory" ADD VALUE 'REPLY';

-- Change quotaBaseOut from Int to Decimal(12,2)
ALTER TABLE "WhatsappDevice" ALTER COLUMN "quotaBaseOut" TYPE DECIMAL(12,2);
ALTER TABLE "WhatsappDevice" ALTER COLUMN "quotaBaseOut" SET DEFAULT 0;
ALTER TABLE "WhatsappDevice" ALTER COLUMN "quotaBaseOut" SET NOT NULL;

-- Create WhatsappQuotaCreditRate table
CREATE TABLE "WhatsappQuotaCreditRate" (
  "category" "WhatsappBillingCategory" NOT NULL,
  "country" VARCHAR(2) NOT NULL,
  "quota_credit" DECIMAL(12,2) NOT NULL,
  "description" VARCHAR(255) NOT NULL,
  CONSTRAINT "WhatsappQuotaCreditRate_pkey" PRIMARY KEY ("category", "country")
);

-- Seed ID rates
INSERT INTO "WhatsappQuotaCreditRate" ("category", "country", "quota_credit", "description") VALUES
  ('MARKETING', 'ID', 2.00, 'Marketing message'),
  ('AUTHENTICATION', 'ID', 1.25, 'Authentication message'),
  ('UTILITY', 'ID', 1.00, 'Utility message'),
  ('REPLY', 'ID', 1.00, 'Reply message');
