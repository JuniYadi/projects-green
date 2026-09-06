---
path: /billing/transactions
locale: en
title: Transactions & Balance Statement Ledger
category: Billing
purpose: Review the complete audit ledger of wallet top-up deposits, service debit deductions, ending balance tracking, and linked invoice receipts.
howTo:
  - "Navigate to Console > Billing > Transactions (/console/billing/transactions)."
  - "Monitor Current Balance, Total Top-Up Inflow (+), and Total Usage Outflow (−)."
  - "Inspect the Balance Statement (Debit/Credit) table for running balance calculations."
  - "Click on linked invoice numbers (TOP-* or INV-*) to review detailed line items."
  - "Filter records by date or search specific activity descriptions."
notes:
  - "All balance movements are recorded in an immutable financial audit ledger."
  - "Subscription debits reference their corresponding order ID and tax invoice."
  - "Ending Balance reflects the exact reconciled account balance immediately after each transaction."
---

# Transactions & Balance Statement Ledger

The **Transactions** console (`/console/billing/transactions`) provides a real-time banking-style balance statement detailing all cash inflows, subscription debit charges, promotional voucher redemptions, and post-transaction ending balances.

![Transaction History & Balance Statement](/kb-assets/billing/08-billing-transactions.png)

---

## 1. Balance Summary Metrics

The top cards present immediate financial liquidity indicators:

- **Current Balance**: Total liquid prepaid deposit available across your organization (e.g. `IDR 14,312,580.66`).
- **Total Top-Up / Inflow (+)**: Cumulative deposit credits added via bank transfer, virtual accounts, QRIS, or voucher claims (e.g. `+IDR 14,950,000`).
- **Total Usage / Outflow (−)**: Cumulative debit charges deducted for active subscriptions and Pay-As-You-Go service consumption (e.g. `−IDR 637,419`).
- **Top-Up Balance CTA**: Quick shortcut to initiate a new deposit invoice.
- **Invoices Cross-Link**: Direct access to view full official tax invoices and download accounting receipts.

---

## 2. Balance Statement (Debit/Credit) Ledger

The statement table functions as an immutable corporate bank ledger:

| Column | Description | Real Example |
| :--- | :--- | :--- |
| **Balance Activity** | Clear context describing the credit inflow or service order debit | `Subscription order cmtdt6q...` or `Manual mark paid: TOP-4FE02F19` |
| **Invoice Reference** | Direct link to the official billing document | [`INV-20260829-OLTM`](/console/billing/invoices/cmtdt6qgl0004yk4cjwr05jtr) or [`TOP-4FE02F19`](/console/billing/invoices/cmtgyomlr0047017cipvzb2cg) |
| **Status (Type)** | `Credit (+)` for deposits/refunds; `Debit (−)` for subscription fees | `Credit (+)` or `Debit (−)` |
| **Amount** | Net financial delta applied to your wallet | `+ IDR 4,500,000` or `− IDR 21,935` |
| **Ending Balance** | Reconciled running balance immediately following the transaction | `IDR 14,312,581` |
| **Date & Time** | Timestamp with minute-level precision | `Aug 31, 2026, 03:13 PM` |

---

## 3. Financial Reconciliation & Auditing

1. **Voucher Redemptions**: Promotional credits applied to your account are recorded with a `Credit (+)` tag and reference code (e.g. `Voucher redemption: J2PZBO29`).
2. **Subscription Charges**: Automated subscription renewals deduct from the available balance and link directly to the finalized tax invoice.
3. **Traceability**: Every entry provides end-to-end traceability between your organization's bank transfer deposit and individual product resource usage.
