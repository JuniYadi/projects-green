-- CreateEnum
CREATE TYPE "VoucherKind" AS ENUM ('BALANCE_CREDIT', 'PRODUCT_PROMOTION');

-- CreateEnum
CREATE TYPE "VoucherDiscountType" AS ENUM ('PERCENTAGE', 'FIXED');

-- CreateEnum
CREATE TYPE "VoucherCurrencyPolicy" AS ENUM ('MATCH_CURRENCY_ONLY', 'CONVERT_AT_CHECKOUT', 'CONVERT_AT_REDEMPTION');

-- CreateEnum
CREATE TYPE "ServiceAddonBillingMode" AS ENUM ('RECURRING', 'ONE_TIME', 'USAGE');

-- AlterTable
ALTER TABLE "BillingOrder" ADD COLUMN     "discountAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "voucherCode" TEXT,
ADD COLUMN     "voucherCurrency" TEXT,
ADD COLUMN     "voucherExchangeRate" DECIMAL(18,8),
ADD COLUMN     "voucherId" TEXT,
ADD COLUMN     "voucherQuoteExpiresAt" TIMESTAMP(3),
ADD COLUMN     "voucherRateAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Voucher" ADD COLUMN     "allowUpgrade" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "allowedBillingPeriods" JSONB,
ADD COLUMN     "allowedPackageCodes" JSONB,
ADD COLUMN     "allowedPlanCodes" JSONB,
ADD COLUMN     "currencyPolicy" "VoucherCurrencyPolicy" NOT NULL DEFAULT 'MATCH_CURRENCY_ONLY',
ADD COLUMN     "discountCurrency" TEXT,
ADD COLUMN     "discountType" "VoucherDiscountType",
ADD COLUMN     "discountValue" DECIMAL(65,30),
ADD COLUMN     "firstCheckoutOnly" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "kind" "VoucherKind" NOT NULL DEFAULT 'BALANCE_CREDIT',
ADD COLUMN     "maximumDiscountAmount" DECIMAL(65,30),
ADD COLUMN     "minimumOrderAmount" DECIMAL(65,30),
ADD COLUMN     "stackable" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "VoucherClaim" ADD COLUMN     "discountAmount" DECIMAL(65,30),
ADD COLUMN     "discountCurrency" TEXT,
ADD COLUMN     "exchangeRate" DECIMAL(18,8),
ADD COLUMN     "orderId" TEXT,
ADD COLUMN     "quoteExpiresAt" TIMESTAMP(3),
ADD COLUMN     "rateAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ServiceAddon" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "billingMode" "ServiceAddonBillingMode" NOT NULL DEFAULT 'RECURRING',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceAddon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceAddonPricing" (
    "id" TEXT NOT NULL,
    "addonId" TEXT NOT NULL,
    "billingPeriod" "BillingPeriod" NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "amount" DECIMAL(18,2) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceAddonPricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServicePlanAddon" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "addonId" TEXT NOT NULL,
    "label" TEXT,
    "description" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "enabledTerms" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServicePlanAddon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceSubscriptionAddon" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "addonId" TEXT NOT NULL,
    "billingPeriod" "BillingPeriod" NOT NULL,
    "priceLocked" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "quantity" DECIMAL(18,6) NOT NULL DEFAULT 1,
    "status" "BillingSubscriptionStatus2" NOT NULL DEFAULT 'ACTIVE',
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceSubscriptionAddon_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceAddon_code_key" ON "ServiceAddon"("code");

-- CreateIndex
CREATE INDEX "ServiceAddon_isActive_idx" ON "ServiceAddon"("isActive");

-- CreateIndex
CREATE INDEX "ServiceAddonPricing_addonId_currency_billingPeriod_isActive_idx" ON "ServiceAddonPricing"("addonId", "currency", "billingPeriod", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceAddonPricing_addonId_billingPeriod_currency_effectiv_key" ON "ServiceAddonPricing"("addonId", "billingPeriod", "currency", "effectiveFrom");

-- CreateIndex
CREATE INDEX "ServicePlanAddon_planId_isActive_idx" ON "ServicePlanAddon"("planId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ServicePlanAddon_planId_addonId_key" ON "ServicePlanAddon"("planId", "addonId");

-- CreateIndex
CREATE INDEX "ServiceSubscriptionAddon_subscriptionId_status_idx" ON "ServiceSubscriptionAddon"("subscriptionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceSubscriptionAddon_subscriptionId_addonId_key" ON "ServiceSubscriptionAddon"("subscriptionId", "addonId");

-- CreateIndex
CREATE INDEX "BillingOrder_voucherId_idx" ON "BillingOrder"("voucherId");

-- CreateIndex
CREATE INDEX "Voucher_kind_status_idx" ON "Voucher"("kind", "status");

-- CreateIndex
CREATE INDEX "VoucherClaim_orderId_idx" ON "VoucherClaim"("orderId");

-- AddForeignKey
ALTER TABLE "BillingOrder" ADD CONSTRAINT "BillingOrder_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "Voucher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceAddonPricing" ADD CONSTRAINT "ServiceAddonPricing_addonId_fkey" FOREIGN KEY ("addonId") REFERENCES "ServiceAddon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicePlanAddon" ADD CONSTRAINT "ServicePlanAddon_planId_fkey" FOREIGN KEY ("planId") REFERENCES "ServicePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicePlanAddon" ADD CONSTRAINT "ServicePlanAddon_addonId_fkey" FOREIGN KEY ("addonId") REFERENCES "ServiceAddon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceSubscriptionAddon" ADD CONSTRAINT "ServiceSubscriptionAddon_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceSubscriptionAddon" ADD CONSTRAINT "ServiceSubscriptionAddon_addonId_fkey" FOREIGN KEY ("addonId") REFERENCES "ServiceAddon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherClaim" ADD CONSTRAINT "VoucherClaim_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "BillingOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
