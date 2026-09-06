---
path: /billing
locale: en
title: Billing Console & Balance Management
category: Billing
purpose: Manage organization prepaid balance, monitor recurring service subscriptions, inspect recent invoices, and access billing modules.
howTo:
  - "Navigate to Console > Billing (/console/billing)."
  - "Review Organization Balance, Next Billing Date, and Estimated Monthly Cost."
  - "Click Top Up Balance to add funds to your organization account."
  - "Inspect active service subscriptions, recent invoices, and download official PDF tax invoices."
  - "Navigate to specialized billing modules: Subscriptions, Invoices, Transactions, Usage, Alerts, Vouchers, Contacts, and Settings."
notes:
  - "Organization balance is used for automated subscription renewals and pay-as-you-go service fees."
  - "Invoices in Open status can be settled via organization balance or integrated payment gateways."
  - "Official PDF invoices are issued under legal entity PT. Premium Fast Network."
---

# Billing Console & Balance Management

The **Billing Console** provides unified visibility into your organization's financial liquidity, recurring subscriptions, invoice history, and cloud resource expenditures.

Access this section via **Console** > **Billing** (`/en/console/billing` or `/id/console/billing`).

![Billing Console Dashboard](/kb-assets/billing/01-billing-overview-id.png)

---

## 1. Key Dashboard Metrics

1. **Organization Balance**: Total active liquid deposit available for automated subscription renewals and on-demand Pay-As-You-Go charges (e.g. `IDR 14,312,580.66`). Click **View Statement →** to inspect the real-time banking statement.
2. **Next Invoice Date**: Scheduled upcoming renewal date for active service subscriptions based on running terms.
3. **Estimated Monthly Cost**: Projected average monthly spend based on historical invoices and active service tiers.
4. **WhatsApp Usage & Costs**: Direct link to granular per-device conversation consumption analytics.

---

## 2. Organization Balance Top-Up

To ensure continuous uptime and prevent service interruptions due to insufficient funds, you can top up your balance at any time.

1. From the billing dashboard, click **"Top Up Balance"** (or go to `/console/billing/topup`).
2. Select a preset balance amount (e.g. `Rp 180.000`, `Rp 450.000`, `Rp 4.500.000`) or enter a custom amount (minimum `Rp 50.000`).
3. Choose your preferred payment method (Bank Transfer, Virtual Account, or QRIS).
4. Complete payment before the expiration window. Your balance will be credited instantly once confirmed.

![Balance Top Up Page](/kb-assets/billing/02-billing-topup.png)

---

## 3. Active Service Subscriptions

The Subscriptions card displays all active recurring cloud services (such as WhatsApp Business Cloud, App Hosting, VPN, etc.) linked to your organization.

![Service Subscriptions](/kb-assets/billing/subscriptions/01-subscriptions-list.png)

- **Active Tiers & Plans**: Detailed configuration and quota allocations of your running services.
- **Renewal Cycles**: Scheduled renewal dates and auto-charge statuses.
- **Detailed Management**: Explore our dedicated [**Service Subscriptions Guide**](/docs/billing/subscriptions) for order details, signup metadata, and renewal cancellation policies.

---

## 4. Invoice Management & Tax Receipts

All issued service invoices and top-up receipts are listed in the **Recent Invoices** table:

![Recent Invoices List](/kb-assets/billing/invoices/01-invoices-management.png)

- **Invoice Numbers**: Official tracking codes (`INV-*` for subscription orders, `TOP-*` for top-up invoices).
- **Payment Statuses**: `Paid`, `Open`, or `Void`.
- **Download PDF**: Instant export of official tax invoices issued by **PT. Premium Fast Network**.
- **Detailed Accounting**: Explore our dedicated [**Invoices & Billing History Guide**](/docs/billing/invoices) for itemized line item breakdowns and corporate tax receipts.

---

## 5. Billing Navigation Menu

Access specialized modules from the top navigation bar:
- [**Subscriptions**](/docs/billing/subscriptions): Manage recurring service plans, renewal dates, and terms.
- [**Invoices**](/docs/billing/invoices): Search billing history and download official accounting PDFs.
- [**Transactions**](/docs/billing/transactions): Banking-style balance statement ledger tracking all debit and credit movements.
- [**Usage**](/docs/billing/usage): Detailed resource consumption breakdowns and service charts.
- [**Alerts**](/docs/billing/alerts): Configure low-balance threshold triggers for automated notifications.
- [**Vouchers**](/docs/billing/vouchers): Claim and apply promotional vouchers and enterprise discounts.
- [**Contacts**](/docs/billing/contacts): Maintain billing notification recipient email addresses.
- [**Settings**](/docs/billing/settings): Manage billing currency, company legal information, and tax IDs.
