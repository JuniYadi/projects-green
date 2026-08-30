-- AlterTable: Add ingress/DNS readiness tracking columns to Deployment
ALTER TABLE "Deployment" ADD COLUMN IF NOT EXISTS "ingressVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Deployment" ADD COLUMN IF NOT EXISTS "ingressCheckedAt" TIMESTAMP(3);
