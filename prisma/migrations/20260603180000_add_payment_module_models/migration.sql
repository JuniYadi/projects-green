-- Migration: add_payment_module_models
-- Adds payment-related columns to Invoice and creates payment module tables

-- AlterTable: Add payment module fields to Invoice
ALTER TABLE "Invoice"
  ADD COLUMN "type" TEXT,
  ADD COLUMN "paymentMethod" TEXT,
  ADD COLUMN "gatewayId" TEXT,
  ADD COLUMN "dueDate" TIMESTAMP(3),
  ADD COLUMN "metadata" JSONB;

-- CreateTable: PaymentGateway
CREATE TABLE "PaymentGateway" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentGateway_pkey" PRIMARY KEY ("id")
);

-- CreateTable: BankAccount
CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL,
    "gatewayId" TEXT,
    "bankCode" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PaymentConfirmation
CREATE TABLE "PaymentConfirmation" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "paymentDateTime" TIMESTAMP(3) NOT NULL,
    "senderBankName" TEXT,
    "senderName" TEXT,
    "senderAccount" TEXT,
    "screenshotUrl" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentConfirmation_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PaymentAuditLog
CREATE TABLE "PaymentAuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "actorId" TEXT,
    "details" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes
CREATE INDEX "PaymentGateway_type_isActive_idx" ON "PaymentGateway"("type", "isActive");
CREATE INDEX "BankAccount_gatewayId_isActive_idx" ON "BankAccount"("gatewayId", "isActive");
CREATE INDEX "BankAccount_bankCode_idx" ON "BankAccount"("bankCode");
CREATE INDEX "PaymentConfirmation_invoiceId_idx" ON "PaymentConfirmation"("invoiceId");
CREATE INDEX "PaymentConfirmation_bankAccountId_idx" ON "PaymentConfirmation"("bankAccountId");
CREATE INDEX "PaymentConfirmation_status_idx" ON "PaymentConfirmation"("status");
CREATE INDEX "PaymentConfirmation_createdAt_idx" ON "PaymentConfirmation"("createdAt");
CREATE INDEX "PaymentAuditLog_entityType_entityId_idx" ON "PaymentAuditLog"("entityType", "entityId");
CREATE INDEX "PaymentAuditLog_action_idx" ON "PaymentAuditLog"("action");
CREATE INDEX "PaymentAuditLog_createdAt_idx" ON "PaymentAuditLog"("createdAt");
CREATE INDEX "Invoice_gatewayId_idx" ON "Invoice"("gatewayId");

-- AddForeignKeys
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_gatewayId_fkey" FOREIGN KEY ("gatewayId") REFERENCES "PaymentGateway"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_gatewayId_fkey" FOREIGN KEY ("gatewayId") REFERENCES "PaymentGateway"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PaymentConfirmation" ADD CONSTRAINT "PaymentConfirmation_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentConfirmation" ADD CONSTRAINT "PaymentConfirmation_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
