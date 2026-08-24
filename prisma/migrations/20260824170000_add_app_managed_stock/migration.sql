-- CreateEnum
CREATE TYPE "AppManagedStockStatus" AS ENUM ('AVAILABLE', 'ALLOCATED', 'DIRTY', 'MAINTENANCE');

-- CreateTable
CREATE TABLE "AppManagedStock" (
    "id" TEXT NOT NULL,
    "clusterId" TEXT NOT NULL,
    "serviceType" "AppManagedServiceType" NOT NULL,
    "label" TEXT,
    "endpointHost" TEXT NOT NULL,
    "endpointPort" INTEGER NOT NULL,
    "databaseName" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "tlsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "vaultPath" TEXT NOT NULL,
    "vaultVersion" INTEGER NOT NULL DEFAULT 1,
    "status" "AppManagedStockStatus" NOT NULL DEFAULT 'AVAILABLE',
    "allocatedStackId" TEXT,
    "allocatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppManagedStock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AppManagedStock_allocatedStackId_key"
    ON "AppManagedStock"("allocatedStackId");

-- CreateIndex
CREATE INDEX "AppManagedStock_clusterId_serviceType_status_idx"
    ON "AppManagedStock"("clusterId", "serviceType", "status");

-- CreateIndex
CREATE INDEX "AppManagedStock_status_idx" ON "AppManagedStock"("status");

-- AddForeignKey
ALTER TABLE "AppManagedStock"
    ADD CONSTRAINT "AppManagedStock_clusterId_fkey"
    FOREIGN KEY ("clusterId") REFERENCES "AppHostingCluster"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppManagedStock"
    ADD CONSTRAINT "AppManagedStock_allocatedStackId_fkey"
    FOREIGN KEY ("allocatedStackId") REFERENCES "ApplicationStack"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
