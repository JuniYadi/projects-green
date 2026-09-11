ALTER TABLE "ApplicationDomain"
  ADD COLUMN IF NOT EXISTS "dnsLastCheckedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "dnsVerificationReason" TEXT,
  ADD COLUMN IF NOT EXISTS "dnsResolverEvidenceJson" JSONB;
