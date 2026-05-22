-- CreateTable
CREATE TABLE "KnowledgeDocument" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT,
  "path" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "howTo" TEXT[] NOT NULL,
  "notes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "searchText" TEXT NOT NULL,
  "updatedByWorkosUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "KnowledgeDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KnowledgeDocument_organizationId_path_idx" ON "KnowledgeDocument"(
  "organizationId",
  "path"
);

-- CreateIndex
CREATE INDEX "KnowledgeDocument_organizationId_updatedAt_idx" ON "KnowledgeDocument"(
  "organizationId",
  "updatedAt" DESC
);

-- CreateIndex
CREATE INDEX "KnowledgeDocument_updatedAt_idx" ON "KnowledgeDocument"(
  "updatedAt" DESC
);

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeDocument_global_path_key" ON "KnowledgeDocument"(
  "path"
) WHERE "organizationId" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeDocument_org_path_key" ON "KnowledgeDocument"(
  "organizationId",
  "path"
) WHERE "organizationId" IS NOT NULL;

-- Seed current console documentation entry
INSERT INTO "KnowledgeDocument" (
  "id",
  "organizationId",
  "path",
  "title",
  "purpose",
  "howTo",
  "notes",
  "searchText",
  "updatedByWorkosUserId",
  "createdAt",
  "updatedAt"
) VALUES (
  'kdoc_console_overview_seed',
  NULL,
  '/console',
  'Console Overview',
  'Monitor product health and navigate core workflows from one place.',
  ARRAY[
    'Use the left navigation to move between platform sections.',
    'Review summary cards for quick status checks before deeper analysis.',
    'Open this documentation panel when you need feature guidance.'
  ]::TEXT[],
  ARRAY[
    'This is the first documentation rollout and currently covers console only.',
    'Additional page documentation can be added incrementally to the registry.'
  ]::TEXT[],
  '/console console overview monitor product health and navigate core workflows from one place use the left navigation to move between platform sections review summary cards for quick status checks before deeper analysis open this documentation panel when you need feature guidance this is the first documentation rollout and currently covers console only additional page documentation can be added incrementally to the registry',
  'system',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT DO NOTHING;
