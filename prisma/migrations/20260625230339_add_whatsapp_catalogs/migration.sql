-- CreateTable
CREATE TABLE "WhatsappCatalog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "metaCatalogId" TEXT NOT NULL,
    "deviceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsappCatalogProduct" (
    "id" TEXT NOT NULL,
    "catalogId" TEXT NOT NULL,
    "productRetailerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" TEXT,
    "currency" TEXT,
    "imageUrl" TEXT,
    "url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappCatalogProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WhatsappCatalog_organizationId_idx" ON "WhatsappCatalog"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappCatalog_organizationId_metaCatalogId_key" ON "WhatsappCatalog"("organizationId", "metaCatalogId");

-- CreateIndex
CREATE INDEX "WhatsappCatalogProduct_catalogId_idx" ON "WhatsappCatalogProduct"("catalogId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappCatalogProduct_catalogId_productRetailerId_key" ON "WhatsappCatalogProduct"("catalogId", "productRetailerId");

-- AddForeignKey
ALTER TABLE "WhatsappCatalog" ADD CONSTRAINT "WhatsappCatalog_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "WhatsappDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappCatalogProduct" ADD CONSTRAINT "WhatsappCatalogProduct_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "WhatsappCatalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
