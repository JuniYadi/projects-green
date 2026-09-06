---
path: /whatsapp/analytics
locale: en
title: WhatsApp Analytics & Cost Reconciliation
category: WhatsApp
purpose: Monitor Meta message analytics, compare local delivery data against Meta-reported statistics, and perform cost reconciliation.
howTo:
  - "Navigate to Console > WhatsApp > Analytics (/console/whatsapp/analytics)."
  - "Select your active WhatsApp sender device and date range."
  - "Click 'Sync from Meta' to fetch verified analytics directly from Meta Graph API."
  - "Switch between 'Comparison' view and 'Cost Reconciliation' to inspect billed conversations."
  - "Click 'Run Reconciliation' to audit local message ledger records against Meta billing."
notes:
  - "Analytics sync requires an active phone number registered on the WhatsApp Cloud API."
  - "Cost reconciliation matches Meta conversation categories (Marketing, Utility, Authentication, Service) against internal quota deductions."
  - "Generate exportable reports for monthly financial auditing and margin calculation."
---

# WhatsApp Analytics & Cost Reconciliation

The **WhatsApp Analytics** module provides unified financial and operational reconciliation between your internal application delivery records and Meta’s official Graph API billing metrics.

Access this section via **Console** > **WhatsApp** > **Analytics** (`/en/console/whatsapp/analytics` or `/id/console/whatsapp/analytics`).

![WhatsApp Analytics Overview](/kb-assets/whatsapp/analytics/01-whatsapp-analytics-overview.png)

---

## 1. Multi-Device Filter & Date Range Selection

Use the top control toolbar to filter analytics by:

1. **Sender Device**: Select specific connected business phone numbers (e.g. `+6283138855774`) or evaluate organization-wide aggregate metrics.
2. **Date Range**: Customize starting and ending dates or select monthly periods for accounting reconciliations.
3. **Sync from Meta**: Triggers real-time synchronization with Meta Cloud API servers to retrieve confirmed conversation categories and delivery states.

---

## 2. Comparison View

The **Comparison** view evaluates message counts across two primary sources:
- **Local Application Records**: Inbound and outbound messages logged through PFNApp API keys and webhooks.
- **Meta-Reported Telemetry**: Official delivery timestamps and conversation status reported by Meta Graph API.

Discrepancies such as delayed network acknowledgments or rejected messages are flagged for transparent auditing.

---

## 3. Cost Reconciliation & Ledger Verification

Click **"Cost Reconciliation"** to switch into financial audit mode:

- **Run Reconciliation**: Matches each dispatched message against the organization transaction ledger.
- **Category Verification**: Confirms whether Meta billed the conversation as Utility, Authentication, Service, or Marketing.
- **Margin & Profit Analysis**: Ensures that quota deductions and wallet charges match active tier pricing rules.
- **Automated Refund Checking**: Flags messages that failed Meta delivery and verifies that allocated quota credits were returned to your balance.
