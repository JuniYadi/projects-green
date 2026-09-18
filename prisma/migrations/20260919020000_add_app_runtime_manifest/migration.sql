-- CreateTable
CREATE TABLE IF NOT EXISTS "AppRuntimeManifest" (
    "id" TEXT NOT NULL,
    "frameworkId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "manifestJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppRuntimeManifest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AppRuntimeManifest_frameworkId_key" ON "AppRuntimeManifest"("frameworkId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AppRuntimeManifest_frameworkId_idx" ON "AppRuntimeManifest"("frameworkId");
