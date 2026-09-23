-- AlterEnum
ALTER TYPE "StackStatus" ADD VALUE 'TERMINATED';

-- AlterTable
ALTER TABLE "ApplicationStack" ADD COLUMN "terminatedAt" TIMESTAMP(3),
ADD COLUMN "scheduledPurgeAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "ApplicationStack_scheduledPurgeAt_idx" ON "ApplicationStack"("scheduledPurgeAt");
