CREATE TYPE "AppManagedServiceType" AS ENUM ('MYSQL', 'POSTGRESQL', 'REDIS');

CREATE TYPE "AppManagedServiceCredentialStatus" AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TABLE "AppManagedServiceCredential" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "clusterId" TEXT NOT NULL,
  "serviceType" "AppManagedServiceType" NOT NULL,
  "endpointHost" TEXT NOT NULL,
  "endpointPort" INTEGER NOT NULL,
  "tlsEnabled" BOOLEAN NOT NULL DEFAULT false,
  "username" TEXT,
  "secretCiphertext" TEXT,
  "secretPreview" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "keyVersion" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  CONSTRAINT "AppManagedServiceCredential_clusterId_serviceType_key" UNIQUE ("clusterId", "serviceType"),
  CONSTRAINT "AppManagedServiceCredential_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "AppHostingCluster"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "AppManagedServiceCredential_clusterId_idx" ON "AppManagedServiceCredential"("clusterId");
CREATE INDEX "AppManagedServiceCredential_serviceType_idx" ON "AppManagedServiceCredential"("serviceType");
CREATE INDEX "AppManagedServiceCredential_isActive_idx" ON "AppManagedServiceCredential"("isActive");
