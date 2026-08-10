-- Additive catalog lifecycle metadata. Existing active packages remain visible;
-- inactive legacy packages remain unavailable.
CREATE TYPE "ProductState" AS ENUM ('DRAFT', 'PUBLISHED', 'PAUSED', 'ARCHIVED');

ALTER TABLE "Package"
  ADD COLUMN "state" "ProductState" NOT NULL DEFAULT 'DRAFT';

UPDATE "Package"
SET "state" = CASE WHEN "isActive" THEN 'PUBLISHED'::"ProductState" ELSE 'ARCHIVED'::"ProductState" END;
