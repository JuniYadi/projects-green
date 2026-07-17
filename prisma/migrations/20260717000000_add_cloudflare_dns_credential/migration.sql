-- CreateTable
CREATE TABLE "CloudflareDnsCredential" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokenJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CloudflareDnsCredential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CloudflareDnsCredential_organizationId_idx" ON "CloudflareDnsCredential"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "CloudflareDnsCredential_organizationId_name_key" ON "CloudflareDnsCredential"("organizationId", "name");
