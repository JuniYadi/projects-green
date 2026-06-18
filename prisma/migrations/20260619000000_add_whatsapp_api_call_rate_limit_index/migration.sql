-- CreateIndex
CREATE INDEX "WhatsappApiCall_phoneNumberId_status_createdAt_idx" ON "WhatsappApiCall"("phoneNumberId", "status", "createdAt" DESC);
