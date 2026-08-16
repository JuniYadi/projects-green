-- AlterTable
ALTER TABLE "Pricing" ADD COLUMN "minimumCommitmentCycles" INTEGER;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN "commitmentEndsAt" TIMESTAMP(3);
