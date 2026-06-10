ALTER TABLE "BankAccount"
  ADD COLUMN "supportedCurrencies" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "swiftCode" TEXT,
  ADD COLUMN "bankAddress" TEXT;

UPDATE "BankAccount"
SET "supportedCurrencies" = ARRAY["currency"]
WHERE cardinality("supportedCurrencies") = 0;
