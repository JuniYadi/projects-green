-- CreateEnum
CREATE TYPE "BillingStrategy" AS ENUM ('PRO_RATA', 'FIXED_CYCLE');

-- CreateEnum
CREATE TYPE "StockControl" AS ENUM ('UNLIMITED', 'TRACKED');

-- AlterTable
ALTER TABLE "ServicePlan" ADD COLUMN "allowBackorder" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "billingStrategy" "BillingStrategy" NOT NULL DEFAULT 'FIXED_CYCLE',
ADD COLUMN "stockControl" "StockControl" NOT NULL DEFAULT 'UNLIMITED',
ADD COLUMN "stockCount" INTEGER;
