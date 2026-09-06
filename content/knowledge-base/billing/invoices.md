---
path: /billing/invoices
locale: en
title: Invoices, Billing History & Tax Receipts
category: Billing
purpose: Track invoice payment history, inspect itemized service line items, review official legal entities, and download tax-compliant PDF invoices.
howTo:
  - "Navigate to Console > Billing > Invoices (/console/billing/invoices)."
  - "Filter invoice history by status (All, Paid, Open, Void) or search by invoice number."
  - "Click on any invoice number (e.g. INV-20260829-OLTM) to view the full accounting breakdown."
  - "Click 'Download PDF' to obtain an official tax-compliant invoice for accounting audits."
notes:
  - "Official invoices are issued by PT. Premium Fast Network, the registered operating legal entity."
  - "Invoices in Open status can be settled instantly using organization balance or payment gateways."
  - "Line items clearly itemize subscription charges, usage consumption, discounts, and applicable taxes."
---

# Invoices, Billing History & Tax Receipts

The **Invoices** console (`/console/billing/invoices`) provides a permanent, searchable accounting archive of all service charges, subscription renewals, balance top-ups, and official payment receipts.

![Invoices Management Dashboard](/kb-assets/billing/invoices/01-invoices-management.png)

---

## 1. Invoices History Table

Navigate to **Console** > **Billing** > **Invoices** (`/console/billing/invoices`).

The invoice archive lists every transaction invoice generated for your organization:

- **Invoice Number**: Official invoice identifier (e.g. `INV-20260829-OLTM` for subscription renewals or `TOP-4FE02F19` for wallet top-ups).
- **Issued Date**: Date the invoice was posted and rendered due.
- **Amount**: Net billing sum in Indonesian Rupiah (IDR) or USD.
- **Status Badges**:
  - `Paid`: Payment successfully settled and credited.
  - `Open / Pending`: Awaiting payment confirmation.
  - `Void / Cancelled`: Revoked or adjusted billing records.
- **PDF Action**: Direct **"Download PDF"** button for instantaneous tax receipt exports.

---

## 2. Itemized Invoice Breakdown

Click any invoice row to inspect the comprehensive invoice details (`/console/billing/invoices/[id]`):

![Invoice Detail & Official PDF View](/kb-assets/billing/invoices/02-invoice-detail.png)

### Official Legal Entity & Issuer Information:
All commercial invoices state the registered operating entity:
- **Entity**: `PT. Premium Fast Network`
- **Address**: `Jl. Bungurasih Tengah No 70, Waru, Sidoarjo, Jawa Timur 61256`
- **Support Contacts**: `Email: support@pfnapp.id | WhatsApp: +6281216667996`

### Detailed Billing Elements:
1. **Invoice Metadata**:
   - Issue Date and Due Date.
   - Billed Organization Name and administrative contact email.
   - Billed Service Period (e.g. `Aug 29, 2026 — Sep 30, 2026`).
2. **Itemized Line Items Table**:
   - **Description**: Specific product and tier descriptor (e.g. `APP_HOSTING SMALL subscription` or `WhatsApp Private Tier`).
   - **Category**: Product category grouping.
   - **Quantity (Qty)**: Total units or license instances.
   - **Amount**: Raw base price per line item.
3. **Financial Summary**:
   - **Subtotal**: Aggregate before taxes and discounts.
   - **Tax**: Calculated statutory VAT/PPN where applicable.
   - **Discount**: Promotional credits or coupon reductions applied.
   - **Total**: Final net payable or settled balance amount.

---

## 3. Official Tax-Compliant PDF Invoices

Click **"Download PDF"** on any invoice page to generate an official PDF document formatted for enterprise accounting audits, tax filing, and corporate reimbursement.
