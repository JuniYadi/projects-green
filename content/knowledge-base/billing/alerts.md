---
path: /billing/alerts
locale: en
title: Balance Thresholds & Quota Alerts Guide
category: Billing
purpose: Set up low balance alerts and automated quota notifications to ensure uninterrupted service delivery.
howTo:
  - "Navigate to Console > Billing > Alerts (/console/billing/alerts)."
  - "Toggle on the Low Balance Alert feature."
  - "Set the threshold trigger amount (e.g. IDR 100,000 or USD $10.00)."
  - "Configure target email addresses or webhooks and save changes."
notes:
  - Notifications are triggered immediately when organization balance falls below threshold.
  - Multi-tier thresholds (warning vs critical) can be set to alert different operational stakeholders.
---

This guide explains how to configure automated early-warning alerts for organization deposit balances and service quotas.

---

## 1. Importance of Billing Alerts

Automated operations like container renewal and WhatsApp Cloud API message metering depend on available deposit funds. If balance reaches zero:
- Recurring subscriptions risk suspension.
- Real-time WhatsApp API outbound messages will be rejected due to insufficient credits.

Configuring **Billing Alerts** (`/console/billing/alerts`) ensures your finance and engineering teams are notified well in advance of depletion.

---

## 2. Setting Alert Thresholds

Navigate to **Console** > **Billing** > **Alerts**.

![Billing Alerts Configuration](/kb-assets/billing/07-billing-alerts.png)

### Setup Steps:
1. **Low Balance Threshold**: Enter the minimum balance amount that triggers an automated alert.
2. **Notification Targets**: Route alert emails to Organization Admins or dedicated Billing Contacts.
3. **Notification Cadence**: Select reminder intervals (daily digest vs event-driven triggers).
4. Click **"Save Changes"** to activate alerting policies.
