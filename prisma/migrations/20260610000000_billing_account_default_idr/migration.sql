-- Align BillingAccount.currency default with the rest of the billing stack (IDR).
-- Existing rows are left untouched; only the column default changes.
ALTER TABLE "BillingAccount" ALTER COLUMN "currency" SET DEFAULT 'IDR';
