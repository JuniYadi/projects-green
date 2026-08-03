ALTER TYPE "DeploySource" ADD VALUE 'PUBLIC';

ALTER TABLE "ApplicationStack"
  ADD COLUMN "publicSourceUrl" TEXT,
  ADD COLUMN "publicSourceRef" TEXT;

ALTER TABLE "Deployment"
  ADD COLUMN "sourceUrl" TEXT,
  ADD COLUMN "sourceRef" TEXT;
