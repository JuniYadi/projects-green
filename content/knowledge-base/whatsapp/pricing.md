---
path: /whatsapp/pricing
locale: en
title: WhatsApp Pricing, Rates & Transaction Ledger
category: WhatsApp
purpose: Comprehensive guide to WhatsApp conversation pricing tiers, in-quota allowance deductions, Pay-As-You-Go overage policies, and itemized transaction ledgers.
howTo:
  - "Navigate to Console > WhatsApp > Pricing & Costs (/console/whatsapp/pricing)."
  - "Use the Interactive Message Cost Estimator to forecast monthly expenses across volume tiers."
  - "Compare rate differences across categories: Marketing, Utility, Authentication, and Service."
  - "Switch to Transaction History tab to audit real-time per-message quota credit deductions."
  - "Filter transaction records by recipient phone number, status, category, or device."
notes:
  - "In-quota messages deduct from your active plan credit allowance before prepaid wallet charges apply."
  - "Marketing conversations deduct 2.0 credits, Authentication 1.5 credits, Utility 1.0 credits, and Service 1.0 credits."
  - "Messages rejected by Meta are automatically refunded and recorded in the deduction ledger."
---

# WhatsApp Pricing, Rates & Transaction Ledger

The **Pricing & Costs** console (`/console/whatsapp/pricing`) provides complete transparency into WhatsApp per-conversation pricing, multi-tier volume discounts, and an itemized real-time deduction ledger.

![WhatsApp Category Rates & Calculator](/kb-assets/whatsapp/pricing/01-pricing-rates.png)

---

## 1. Interactive Message Cost Estimator

Simulate your organization’s projected monthly costs across different messaging volumes:

- **Tier Selectors**: Compare standard **BASE** rates with enterprise volume discounts (**TIER 1**, **TIER 2**, and **TIER 3★**).
- **Volume Sliders**:
  - **Marketing Broadcasts**: Promotional campaigns, newsletters, and announcements (e.g. 2,500 msg @ Rp 770/msg).
  - **Utility & Alerts**: Transactional receipts, shipment notices, and invoices (e.g. 1,000 msg @ Rp 469/msg).
  - **Auth & OTP Codes**: One-time login pins and 2FA authentication codes (e.g. 500 msg @ Rp 469/msg).
- **Live Monthly Calculation**: Displays real-time estimated totals and direct links to subscribe or upgrade your plan.

---

## 2. Category Rates & Tier Matrix

WhatsApp charges conversation sessions based on intent:

| Category | In-Quota Multiplier | BASE Rate | TIER 1 Rate | TIER 2 Rate | TIER 3 Rate |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`MARKETING`** | **2.0 Credits** | Rp 770 | Rp 741 | Rp 711 | Rp 682 |
| **`UTILITY`** | **1.0 Credit** | Rp 469 | Rp 451 | Rp 433 | Rp 415 |
| **`AUTHENTICATION`** | **1.5 Credits** | Rp 469 | Rp 451 | Rp 433 | Rp 415 |
| **`SERVICE`** | **1.0 Credit** | Rp 393 | Rp 378 | Rp 363 | Rp 348 |

### Quota Deduction vs PAYG Overage:
1. **In-Quota Allowance**: Dispatched messages deduct credit units from your monthly subscription allowance first.
2. **PAYG Fallback**: Once your monthly allowance is exhausted, messages automatically continue dispatching via Pay-As-You-Go deducted from your organization wallet balance.

---

## 3. Transaction & Deduction Ledger

Click the **"Transaction History"** tab to inspect the audit ledger of all quota movements:

![WhatsApp Deduction Ledger](/kb-assets/whatsapp/pricing/02-ledger-statement.png)

### Summary Cards:
- **Total Deducted Credits**: Aggregate quota credits reserved or debited across all dispatches.
- **Refunded / Reverted**: Quota credits returned due to network timeouts or Meta delivery rejections.
- **Net Billed Credits**: Confirmed delivered quota charges.

### Itemized Audit Table:
Filter by phone number, message category, delivery status, or device to inspect:
- Timestamp with minute-level precision.
- Recipient phone number and sender device identifier.
- Category classification (**AUTHENTICATION**, **UTILITY**, **MARKETING**, **SERVICE**).
- Status (**Confirmed**, **Pending**, **Refunded**).
- Exact credit deductions (e.g. `-1.5 credits`, `-1 credits`, `-2 credits`).
