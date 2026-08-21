---
path: /whatsapp/webhooks-and-audits
title: WhatsApp Webhooks & Security Audits
category: WhatsApp
purpose: Inspect inbound and outbound webhook event logs, payload delivery receipts, error retries, and immutable audit logs.
howTo:
  - "Navigate to Console > WhatsApp > Webhook Logs (/console/whatsapp/webhook-logs)."
  - "Filter webhook events by status (DELIVERED, FAILED, RETRYING) or event type."
  - "Inspect raw JSON payloads, response status codes, and execution latency."
  - "Navigate to Console > WhatsApp > Audit Logs (/console/whatsapp/audit-logs) to review user activities."
notes:
  - "Failed outbound webhooks are automatically retried with exponential backoff."
  - "Audit logs are immutable records created for security compliance and billing reconciliation."
---

# WhatsApp Webhook Logs & Security Audit Trail

This guide covers real-time message delivery monitoring and compliance tracking via **Webhook Logs** and **Audit Logs**.

---

## 1. Webhook Logs (`/console/whatsapp/webhook-logs`)

Webhook Logs capture all raw events received from Meta Cloud API (inbound messages, status updates) and outgoing webhook dispatches to your registered webhook endpoints.

![Webhook Logs](/kb-assets/whatsapp/guides/05-journey1-webhook-logs.png)

### Key Event Types:

- `message.received`: Inbound text, media, or button response sent by a customer.
- `message.sent`: Dispatch confirmation from Meta.
- `message.delivered`: Delivery receipt confirmation.
- `message.read`: Read receipt timestamp.
- `message.failed`: Delivery failure callback with Meta error codes.

### Inspecting Webhook Payloads:

Click on any webhook log entry to expand the full JSON request and response payloads, HTTP status codes, latency in milliseconds, and retry attempt counters.

---

## 2. Audit Logs (`/console/whatsapp/audit-logs`)

The Audit Logs console provides an immutable security ledger recording administrative and operational actions across your organization.

![Audit Logs](/kb-assets/whatsapp/guides/06-journey1-audit-logs.png)

### Tracked Actions:

- API Key generation, rotation, and revocation.
- Template creation, modifications, and sync operations.
- Device pairings, token updates, and disconnections.
- Bulk broadcast dispatch triggers.
- Financial quota debits and refund credits.
