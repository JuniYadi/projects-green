-- Add explicit customer cancellation scheduling and reinstatement audit state.
ALTER TYPE "BillingAuditAction" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_REINSTATED';

ALTER TABLE "Subscription"
ADD COLUMN "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "allocatedConfig" JSONB;
