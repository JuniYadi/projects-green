-- AlterTable
ALTER TABLE "KnowledgeDocument"
ADD COLUMN "category" TEXT NOT NULL DEFAULT 'General',
ADD COLUMN "contentMarkdown" TEXT,
ADD COLUMN "contentHash" VARCHAR(64),
ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "locale" VARCHAR(10) NOT NULL DEFAULT 'en';

-- DropIndex
DROP INDEX "KnowledgeDocument_organizationId_path_idx";

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeDocument_path_locale_organizationId_key"
ON "KnowledgeDocument"("path", "locale", "organizationId");

-- CreateIndex
CREATE INDEX "KnowledgeDocument_organizationId_path_locale_idx"
ON "KnowledgeDocument"("organizationId", "path", "locale");

-- CreateIndex
CREATE INDEX "KnowledgeDocument_isPublic_category_locale_idx"
ON "KnowledgeDocument"("isPublic", "category", "locale");
