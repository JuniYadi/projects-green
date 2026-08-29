-- AlterTable: Add regionId column if not exists
ALTER TABLE "AppHostingCluster" ADD COLUMN IF NOT EXISTS "regionId" TEXT;

-- Data Migration: Backfill regionId from existing region column if region exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'AppHostingCluster' AND column_name = 'region'
    ) THEN
        -- Match by ServiceRegion id, code, or name
        UPDATE "AppHostingCluster" c
        SET "regionId" = r.id
        FROM "Region" r
        WHERE c."regionId" IS NULL
          AND (c."region" = r.id OR LOWER(c."region") = LOWER(r.code) OR LOWER(c."region") = LOWER(r.name));

        -- Drop legacy column
        ALTER TABLE "AppHostingCluster" DROP COLUMN "region";
    END IF;
END $$;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AppHostingCluster_regionId_status_idx" ON "AppHostingCluster"("regionId", "status");
CREATE INDEX IF NOT EXISTS "AppHostingCluster_regionId_isDefault_idx" ON "AppHostingCluster"("regionId", "isDefault");

-- AddForeignKey
DO $$
BEGIN
    ALTER TABLE "AppHostingCluster"
    ADD CONSTRAINT "AppHostingCluster_regionId_fkey"
    FOREIGN KEY ("regionId") REFERENCES "Region"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
