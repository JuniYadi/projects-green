-- DropIndex
DROP INDEX IF EXISTS "Invoice_invoiceNumber_key";

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_billingAccountId_invoiceNumber_key" ON "Invoice"("billingAccountId", "invoiceNumber");
