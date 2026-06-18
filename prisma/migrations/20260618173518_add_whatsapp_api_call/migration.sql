-- CreateTable
CREATE TABLE "WhatsappApiCall" (
    "id" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "phoneNumberId" TEXT NOT NULL,
    "status" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsappApiCall_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WhatsappApiCall_phoneNumberId_createdAt_idx" ON "WhatsappApiCall"("phoneNumberId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "WhatsappApiCall_createdAt_idx" ON "WhatsappApiCall"("createdAt" DESC);
