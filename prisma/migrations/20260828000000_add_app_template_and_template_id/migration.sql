-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "AppTemplateCategory" AS ENUM ('AI', 'AUTOMATION', 'CMS', 'DATABASE', 'DEVELOPER_TOOLS', 'ANALYTICS', 'UTILITIES');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "AppTemplateVisibility" AS ENUM ('PRIVATE', 'PENDING_REVIEW', 'PUBLIC', 'REJECTED', 'UNLISTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "AppTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "readmeMarkdown" TEXT,
    "iconUrl" TEXT,
    "category" "AppTemplateCategory" NOT NULL DEFAULT 'UTILITIES',
    "visibility" "AppTemplateVisibility" NOT NULL DEFAULT 'PRIVATE',
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "blueprintJson" JSONB NOT NULL,
    "isOfficial" BOOLEAN NOT NULL DEFAULT false,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "reviewNotes" TEXT,
    "installCount" INTEGER NOT NULL DEFAULT 0,
    "priceMonthly" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AppTemplate_slug_key" ON "AppTemplate"("slug");
CREATE INDEX IF NOT EXISTS "AppTemplate_visibility_category_idx" ON "AppTemplate"("visibility", "category");
CREATE INDEX IF NOT EXISTS "AppTemplate_organizationId_idx" ON "AppTemplate"("organizationId");
CREATE INDEX IF NOT EXISTS "AppTemplate_isFeatured_installCount_idx" ON "AppTemplate"("isFeatured", "installCount");

-- AlterTable
ALTER TABLE "ApplicationStack" ADD COLUMN IF NOT EXISTS "templateId" TEXT;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "ApplicationStack" ADD CONSTRAINT "ApplicationStack_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "AppTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
