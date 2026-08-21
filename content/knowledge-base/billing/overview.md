---
path: /billing
locale: en
title: Billing Console & Balance
category: Billing
purpose: Manage organization balance, view estimated costs, track invoices, and manage service subscriptions in the Billing Console.
howTo:
  - "Navigate to Console > Billing (/console/billing)."
  - "Review Organization Balance, Next Billing Date, and Estimated Monthly Cost."
  - "Click Top Up Balance to add funds to your organization account."
  - "Inspect transaction history, recent invoices, and download official PDF invoices."
notes:
  - Organization balance is used for automated subscription renewals and pay-as-you-go service fees.
  - Invoices in DRAFT or UNPAID status can be settled via balance or integrated payment gateways.
  - Official PDF invoices are available for download on all issued billing records for accounting audits.
---

This guide explains how to monitor billing status, manage organization balance, view monthly cost projections, and manage invoices and active subscriptions through the Billing Console.

---

## 1. Billing Dashboard Overview

The Billing Dashboard provides unified visibility into your organization's financial status and cloud resource expenditures.

Access this section via **Console** > **Billing** (`/id/console/billing` or `/en/console/billing`).

![Billing Console Dashboard](/kb-assets/billing/01-billing-overview-id.png)

### Key Dashboard Metrics:

1. **Balance**: Total active deposit available for automated recurring renewals and on-demand usage charges.
2. **Next Billing Date**: Scheduled upcoming renewal date for active service subscriptions.
3. **Estimated Monthly Cost**: Projected average monthly spend based on historical invoices and active service tiers.
4. **Product Usage & Costs (e.g. WhatsApp)**: Direct link to granular per-service consumption analytics.

---

## 2. Organization Balance Top-Up

To ensure continuous uptime and prevent service interruptions due to insufficient funds, you can top up your balance at any time.

### Top-Up Steps:

1. From the billing dashboard, click **"Isi Saldo" / "Top Up"** (or go to `/console/billing/topup`).
2. Select a preset balance amount or enter a custom amount (observing minimum transaction limits in IDR/USD).
3. Choose your preferred payment method (Bank Transfer / Virtual Account / QRIS / Credit Card).
4. Complete the payment before the expiration window. Your balance will be credited instantly once confirmed.

![Balance Top Up Page](/kb-assets/billing/02-billing-topup.png)

---

## 3. Invoice Management & Payments

All issued service invoices are listed in the **Invoice Terbaru / Recent Invoices** table.

![Recent Invoices List](/kb-assets/billing/03-billing-invoices-list.png)

### Invoice Status Lifecycle:

- **PAID**: The invoice has been successfully paid and recorded.
- **UNPAID / PENDING**: Awaiting payment before the stated due date.
- **DRAFT**: Billing cycle preparation in progress prior to finalization.
- **VOID / CANCELLED**: An invoice that was cancelled or adjusted.

### Downloading PDF Invoices:

Click **"Download PDF"** in the action column of any invoice row to download official tax-compliant invoices for your accounting records.

---

## 4. Service Subscription Management

The Subscriptions tab displays all active recurring services (such as App Hosting, WhatsApp Cloud Services, VPN, etc.) linked to your organization.

![Service Subscriptions](/kb-assets/billing/04-billing-subscriptions.png)

- **Active Tiers & Plans**: Detailed configuration and quota allocations of your running services.
- **Renewal Cycles**: Scheduled renewal dates and auto-charge statuses.
- **Upgrades / Downgrades**: Seamless plan modifications with automated proration calculations.

---

## 5. Billing Navigation Menu

Use the navigation bar at the top of the Billing page to access related modules:

- **Usage**: Detailed resource consumption breakdowns and service line-item charts.
- **Alerts**: Configure low-balance threshold triggers for automated email/webhook notifications.
- **Transactions**: Itemized audit log of credit deposits and service debit deductions.
- **Vouchers**: Claim and apply promo vouchers or enterprise commercial discounts.
- **Contacts**: Maintain billing notification recipient email addresses.
- **Settings**: Manage billing currency, company legal information, and tax IDs.
