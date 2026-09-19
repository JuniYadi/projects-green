-- AlterTable: Add widget configuration and allowedDomains to AiAgentProfile
ALTER TABLE "AiAgentProfile"
  ADD COLUMN IF NOT EXISTS "allowedDomains" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "widgetColor" TEXT DEFAULT '#10B981',
  ADD COLUMN IF NOT EXISTS "widgetPosition" TEXT DEFAULT 'bottom-right',
  ADD COLUMN IF NOT EXISTS "welcomeMessage" TEXT DEFAULT 'Halo! Ada yang bisa kami bantu?';
