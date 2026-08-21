---
path: /whatsapp/overview
title: WhatsApp Console, Workflows & API Integration Guide
category: WhatsApp
purpose: Comprehensive guide for WhatsApp Console navigation, template creation, message sending, lifecycle tracking, and API integration.
howTo:
  - "Navigate WhatsApp Console sidebar menus (Dashboard, API Keys, Templates, Messages, Devices, Webhook Logs, Audit Logs)."
  - "Follow Journey 1: Create Template > Send Message > Track Message Delivery & Webhooks."
  - "Follow Journey 2: Generate API Key > Explore OpenAPI Spec > Switch Code Examples > Test API Calls."
notes:
  - Templates must be synced and approved by Meta before being sent out.
  - Plaintext API Key secret is visible only once upon generation or rotation.
  - Webhook Logs and Audit Logs provide immutable delivery auditing and reconciliation records.
---

# WhatsApp Console, Workflows & API Integration Guide

This documentation provides an end-to-end guide for managing WhatsApp business messaging via the PFNApp Console, covering every sidebar navigation menu and two primary implementation journeys:
1. **Business Workflow Journey**: Create Template $\rightarrow$ Send Message $\rightarrow$ Track Message Delivery & Status.
2. **Developer & Integration Journey**: Generate API Key $\rightarrow$ Read OpenAPI Spec $\rightarrow$ Switch Code Examples $\rightarrow$ Test API Calls.

---

## 1. WhatsApp Console Sidebar Navigation Overview

The WhatsApp Console sidebar provides full operational control over messaging channels, API security, and billing metrics.

![WhatsApp Dashboard](/kb-assets/whatsapp/guides/01-whatsapp-dashboard.png)

### Sidebar Menus Summary

| Menu | Path | Function & Scope |
| :--- | :--- | :--- |
| **Dashboard** | `/console/whatsapp/dashboard` | Overview of active devices, connected health status, total conversations, and recent chat history. |
| **API Keys** | `/console/whatsapp/api-keys` | Organization-level static API keys for backend service authentication, rotation, and revocation. |
| **Usage** | `/console/whatsapp/usage` | Analytics on sent/received messages, quota consumption, and breakdown per template category. |
| **Ledger** | `/console/whatsapp/ledger` | Detailed transactional accounting for message balance deductions, credits, and refunds. |
| **Pricing** | `/console/whatsapp/pricing` | Tiered pricing rates across template categories (Marketing, Utility, Authentication, Service). |
| **Devices** | `/console/whatsapp/devices` | Registered WhatsApp phone numbers, connection status, QR code pairing, and Meta Cloud tokens. |
| **Templates** | `/console/whatsapp/templates` | Create, sync, edit, and preview Meta-approved WhatsApp Message Templates. |
| **Messages** | `/console/whatsapp/messages` | Interactive chat composer, active conversation inbox, and manual message dispatch. |
| **Broadcasts** | `/console/whatsapp/broadcasts` | Bulk messaging campaigns targeting contact lists or customer segments. |
| **Contacts** | `/console/whatsapp/contacts` | Address book, custom attributes, tags, and audience segmentation. |
| **Catalogs** | `/console/whatsapp/catalogs` | Product catalog integration for interactive commerce and shopping messages. |
| **Webhook Logs** | `/console/whatsapp/webhook-logs` | Inbound & outbound webhook delivery logs, retry attempts, payloads, and response codes. |
| **Audit Logs** | `/console/whatsapp/audit-logs` | Security and compliance audit trail tracking user actions, key rotations, and status changes. |
| **API Reference** | `/api/openapi` | Interactive OpenAPI documentation, interactive request tester, and multi-language code snippets. |

---

## 2. Journey 1: Create Template $\rightarrow$ Send Message $\rightarrow$ Track Message

This journey guides marketing and operations teams through drafting a new message template, dispatching it to recipients, and tracking message delivery milestones.

```mermaid
graph LR
    A[1. Create Template] --> B[2. Meta Review & Sync]
    B --> C[3. Send Message]
    C --> D[4. Track Status / Webhooks]
```

---

### Step 1: Create a WhatsApp Message Template

1. Navigate to **Console** > **WhatsApp** > **Templates** (`/console/whatsapp/templates`).
2. Review existing templates and their sync status (`SYNCED`, `APPROVED`, `REJECTED`, or `PENDING`).

![Templates List](/kb-assets/whatsapp/guides/02-journey1-templates-list.png)

3. Click **"Create Template"** (or **"Buat Template"**) to launch the template creation dialog.
4. Fill in the template details:
   - **Template Name**: Unique lowercase identifier (e.g. `order_status_update`).
   - **Category**: Select `UTILITY`, `MARKETING`, or `AUTHENTICATION`.
   - **Language**: Choose target languages (e.g. `Indonesian (id)`, `English (en-US)`).
   - **Header** *(Optional)*: Text, Image, Video, or Document.
   - **Body**: Message body with parameter placeholders (e.g., `Hello {{1}}, your order #{{2}} is on its way!`).
   - **Footer & Buttons** *(Optional)*: Quick reply or Call-to-Action (URL / Phone) buttons.

![Create Template Dialog](/kb-assets/whatsapp/guides/03-journey1-create-template-dialog.png)

5. Click **Submit**. Once Meta approves the template, click **"Sync Templates"** to synchronize approval status.

---

### Step 2: Send Template Message

1. Navigate to **Console** > **WhatsApp** > **Messages** (`/console/whatsapp/messages`).
2. Select an active connected WhatsApp Device from the device selector.
3. Choose the recipient contact or input the destination phone number (e.g., `+6281234567890`).
4. Select your approved template from the template dropdown.
5. Populate required dynamic variable parameters (`{{1}}`, `{{2}}`).
6. Click **Send Message**.

![Send Message](/kb-assets/whatsapp/guides/04-journey1-send-message.png)

---

### Step 3: Track Message Delivery & Webhook Logs

Every message transitions through lifecycle states: `PENDING` $\rightarrow$ `SENT` $\rightarrow$ `DELIVERED` $\rightarrow$ `READ` (or `FAILED`).

1. **Webhook Logs (`/console/whatsapp/webhook-logs`)**:
   - Inspect raw inbound status callbacks sent by Meta.
   - Verify delivery timestamps, HTTP status codes, and payload bodies.
   - Retry failed webhooks if your external endpoint was temporarily unreachable.

![Webhook Logs](/kb-assets/whatsapp/guides/05-journey1-webhook-logs.png)

2. **Audit Logs (`/console/whatsapp/audit-logs`)**:
   - View immutable security audit logs of who triggered the dispatch and related balance changes.

![Audit Logs](/kb-assets/whatsapp/guides/06-journey1-audit-logs.png)

---

## 3. Journey 2: API Key $\rightarrow$ OpenAPI $\rightarrow$ Switch Code Example $\rightarrow$ API Call

This journey guides developers through programmatic API integration using the REST API.

```mermaid
graph LR
    A[1. Generate API Key] --> B[2. Explore OpenAPI Spec]
    B --> C[3. Select Language Snippet]
    C --> D[4. Execute API Call]
```

---

### Step 1: Generate API Key

1. Navigate to **Console** > **WhatsApp** > **API Keys** (`/console/whatsapp/api-keys`).
2. Click **"Generate API key"**.
3. **Copy the one-time API secret immediately**. The secret is hashed with SHA-256 and will never be shown again after leaving the page.

![API Keys Management](/kb-assets/whatsapp/guides/07-journey2-api-keys.png)

---

### Step 2: Explore OpenAPI Spec & Interactive Reference

1. Open the **API Reference** link from the sidebar or navigate directly to `/api/openapi`.
2. Browse the **WhatsApp** endpoint group:
   - `POST /api/whatsapp/messages` — Send template, text, interactive, or media messages.
   - `GET /api/whatsapp/devices` — List connected WhatsApp sender numbers.
   - `GET /api/whatsapp/templates` — List approved templates and variables.

![OpenAPI Reference](/kb-assets/whatsapp/guides/08-journey2-openapi-reference.png)

---

### Step 3: Switch Code Examples

Use the interactive code generator on `/api/openapi` to switch between programming languages (cURL, JavaScript / TypeScript, Python, Go, PHP).

![OpenAPI Code Example](/kb-assets/whatsapp/guides/09-journey2-openapi-code-example.png)

---

### Step 4: Testing API Calls

#### cURL Example

```bash
curl -X POST "https://pfnapp.my.id/api/whatsapp/messages" \
  -H "Authorization: Bearer pfn_wa_sec_xxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+6281234567890",
    "type": "template",
    "template": {
      "name": "order_status_update",
      "language": {
        "code": "id"
      },
      "components": [
        {
          "type": "body",
          "parameters": [
            { "type": "text", "text": "Budi" },
            { "type": "text", "text": "INV-2026-001" }
          ]
        }
      ]
    }
  }'
```

#### TypeScript / Node.js (fetch) Example

```typescript
const response = await fetch("https://pfnapp.my.id/api/whatsapp/messages", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${process.env.PFN_WHATSAPP_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    to: "+6281234567890",
    type: "template",
    template: {
      name: "order_status_update",
      language: { code: "id" },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: "Budi" },
            { type: "text", text: "INV-2026-001" },
          ],
        },
      ],
    },
  }),
})

const result = await response.json()
console.log("Message response:", result)
```

#### Python Example

```python
import os
import requests

url = "https://pfnapp.my.id/api/whatsapp/messages"
headers = {
    "Authorization": f"Bearer {os.getenv('PFN_WHATSAPP_API_KEY')}",
    "Content-Type": "application/json",
}
payload = {
    "to": "+6281234567890",
    "type": "template",
    "template": {
        "name": "order_status_update",
        "language": {"code": "id"},
        "components": [
            {
                "type": "body",
                "parameters": [
                    {"type": "text", "text": "Budi"},
                    {"type": "text", "text": "INV-2026-001"},
                ],
            }
        ],
    },
}

response = requests.post(url, json=payload, headers=headers)
print(response.status_code, response.json())
```

---

## 4. Other WhatsApp Console Management Menus

### Devices (`/console/whatsapp/devices`)
Manage your physical and cloud WhatsApp accounts, pair via QR code, configure Meta tokens, and inspect live socket connection health.

![Devices Management](/kb-assets/whatsapp/guides/10-menu-devices.png)

---

### Broadcast Campaigns (`/console/whatsapp/broadcasts`)
Create scheduled or instant bulk messaging campaigns, select target audience tags, and track campaign completion percentage and delivery analytics.

![Broadcasts Management](/kb-assets/whatsapp/guides/11-menu-broadcasts.png)

---

### Contacts (`/console/whatsapp/contacts`)
Maintain customer contacts, import CSV phone lists, assign custom tags, and manage opt-out preferences.

![Contacts Management](/kb-assets/whatsapp/guides/12-menu-contacts.png)

---

### Product Catalogs (`/console/whatsapp/catalogs`)
Synchronize e-commerce product catalogs with Meta to send interactive single-product and multi-product cart messages directly in WhatsApp chats.

![Catalogs Management](/kb-assets/whatsapp/guides/13-menu-catalogs.png)

---

### Usage & Cost Analytics (`/console/whatsapp/usage`)
Analyze daily message volume, track conversation tier distributions (Utility vs Marketing), and monitor quota allowances.

![Usage Analytics](/kb-assets/whatsapp/guides/14-menu-usage.png)

---

### Financial Ledger (`/console/whatsapp/ledger`)
Audit immutable credit/debit transaction records, auto-refunds for failed deliveries, and subscription renewal fees.

![Ledger Accounting](/kb-assets/whatsapp/guides/15-menu-ledger.png)

---

### Pricing Table (`/console/whatsapp/pricing`)
Review destination-specific per-conversation fees across all Meta message categories.

![Pricing Reference](/kb-assets/whatsapp/guides/16-menu-pricing.png)
