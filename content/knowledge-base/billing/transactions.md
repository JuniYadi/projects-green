---
path: /billing/transactions
locale: en
title: Transactions & Balance Ledger
category: Billing
purpose: Review the complete audit ledger of credit deposits, service deductions, and financial transactions.
howTo:
  - "Navigate to Console > Billing > Transactions (/console/billing/transactions)."
  - "Filter records by transaction type (Top-up, Service Debit, Refund, Admin Adjustment)."
  - "Inspect reference IDs, execution timestamps, and post-transaction running balance."
  - "Export transaction data for financial accounting reconciliation."
notes:
  - All balance movements are recorded in an immutable financial ledger.
  - Automatic deductions include structured metadata referencing the underlying service subscription.
---

This guide explains how to track organization balance movements, verify top-up transactions, and inspect financial audit records.

---

## 1. Understanding the Organization Ledger

The **Transactions** page (`/console/billing/transactions`) provides a comprehensive statement of all debit and credit movements.

![Transaction History & Balance Ledger](/kb-assets/billing/08-billing-transactions.png)

### Transaction Types:

- **CREDIT (Top-ups & Deposits)**: Funds added via top-up invoices, promotional grants, or adjustment credits.
- **DEBIT (Service Deductions)**: Automated charges for recurring subscription terms or on-demand resource usage.
- **REFUND**: Balance credited back following service adjustments.
- **ADJUSTMENT**: Administrative ledger reconciliations.

---

## 2. Audit Trail & Accounting Reconciliation

Each ledger record contains:

1. **Transaction ID**: Unique identifier for tracking and support requests.
2. **Timestamp**: Precision execution time.
3. **Description**: Clear line-item context (e.g. _Renewal App Hosting Starter_, _Deposit via QRIS_).
4. **Running Balance**: Exact account balance after the transaction settled.
