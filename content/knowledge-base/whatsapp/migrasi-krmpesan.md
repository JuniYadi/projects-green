---
path: /whatsapp/migrasi-krmpesan
title: Migration from krmpesan.app
category: WhatsApp
purpose: Comprehensive migration guide for integrating backend systems from legacy krmpesan.app to the new WhatsApp API platform.
howTo:
  - "Generate an Organization API Key under Console > WhatsApp > API Keys (/console/whatsapp/api-keys)."
  - "Update the base URL from api.krmpesan.app to pfnapp.id/api/whatsapp."
  - "Set the Authorization header to Bearer <API_KEY> or x-api-key."
  - "Send requests using either legacy payload structure or new standard OpenAPI schemas."
notes:
  - "The new platform is fully backward-compatible with legacy krmpesan template payloads."
  - "Free-form text messages require an active 24-hour customer service window per Meta policies."
---

# Migration from krmpesan.app

This guide provides practical steps to migrate your backend systems and integrations from the legacy **krmpesan.app** service to the new WhatsApp Business Platform.

---

## 1. Overview & Compatibility

The new platform is built with **backward-compatibility** in mind. You do not need to immediately refactor your existing JSON payloads. Upgrading only requires changing your **Base URL** and **API Key**.

| Component | Legacy krmpesan.app | New Platform | Notes |
| :--- | :--- | :--- | :--- |
| **Base URL** | `https://api.krmpesan.app/` | `https://pfnapp.id/api/whatsapp/` | Base prefix `/api/whatsapp` |
| **Authentication** | `Authorization: Bearer <userToken>` | `Authorization: Bearer <API_KEY>` or `x-api-key: <API_KEY>` | Use Static Org API Key |
| **Send Message** | `POST /messages` | `POST /api/whatsapp/messages` | Supports legacy & new payloads |
| **List Messages** | `GET /messages` | `GET /api/whatsapp/messages` | Message history & status |
| **List Templates** | `GET /templates` | `GET /api/whatsapp/templates` | Meta template synchronization |
| **List Contacts** | `GET /contacts` | `GET /api/whatsapp/contacts` | Audience contact management |
| **Webhook Status** | `POST /webhooks` | `GET /api/whatsapp/webhooks/events` | Delivery status & event logs |

---

## 2. Authentication & New API Keys

Authentication now uses an **Organization API Key** managed directly in the Console:

1. Go to **Console** > **WhatsApp** > **API Keys** (`/console/whatsapp/api-keys`).
2. Click **Generate API key** and copy the secret key (`pfn_wa_sec_...` or `wa_live_...`).
3. Include the key in your HTTP request headers:

```http
Authorization: Bearer pfn_wa_sec_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
Content-Type: application/json
```

*Or via the alternative custom header:*

```http
x-api-key: pfn_wa_sec_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
Content-Type: application/json
```

---

## 3. Payload Comparison & Examples

### A. Template Messages

#### 1. Legacy krmpesan Format (Drop-in Replacement)
You can continue using your existing JSON payload structure without changing application business logic:

```bash
curl -X POST "https://pfnapp.id/api/whatsapp/messages" \
  -H "Authorization: Bearer pfn_wa_sec_xxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "081234567890",
    "template_name": "invoice_reminder",
    "template_language": "id",
    "template": {
      "body": ["Budi Santoso", "INV-2026-001", "$150"]
    }
  }'
```

#### 2. New Standard Format (OpenAPI / Meta Cloud Architecture)
The recommended standard schema supporting dynamic media headers and interactive buttons:

```bash
curl -X POST "https://pfnapp.id/api/whatsapp/messages" \
  -H "Authorization: Bearer pfn_wa_sec_xxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+6281234567890",
    "type": "template",
    "template": {
      "name": "invoice_reminder",
      "language": {
        "code": "id"
      },
      "components": [
        {
          "type": "body",
          "parameters": [
            { "type": "text", "text": "Budi Santoso" },
            { "type": "text", "text": "INV-2026-001" },
            { "type": "text", "text": "$150" }
          ]
        }
      ]
    }
  }'
```

---

### B. Free-form Text Messages (Session Messages)

> **Meta Policy:** Free-form text messages (non-template) can only be sent if the customer contacted your WhatsApp Business number within the last 24 hours.

```bash
curl -X POST "https://pfnapp.id/api/whatsapp/messages" \
  -H "Authorization: Bearer pfn_wa_sec_xxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "081234567890",
    "type": "text",
    "message": "Hello Budi, our support team is reviewing your ticket."
  }'
```

---

### C. Media Messages (Images / Documents)

```bash
curl -X POST "https://pfnapp.id/api/whatsapp/messages" \
  -H "Authorization: Bearer pfn_wa_sec_xxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "081234567890",
    "type": "image",
    "mediaUrl": "https://assets.domain.com/invoices/inv-001.jpg",
    "caption": "Attached Invoice #INV-2026-001"
  }'
```

---

## 4. Code Integration Examples

### Node.js / TypeScript

```typescript
async function sendWhatsAppNotification() {
  const response = await fetch("https://pfnapp.id/api/whatsapp/messages", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.WHATSAPP_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      phone: "081234567890",
      template_name: "invoice_reminder",
      template_language: "id",
      template: {
        body: ["Budi Santoso", "INV-2026-001", "$150"],
      },
    }),
  })

  const result = await response.json()
  console.log("Response:", result)
}
```

### PHP (cURL / Guzzle)

```php
<?php

$curl = curl_init();

$payload = [
    "phone" => "081234567890",
    "template_name" => "invoice_reminder",
    "template_language" => "id",
    "template" => [
        "body" => ["Budi Santoso", "INV-2026-001", "$150"]
    ]
];

curl_setopt_array($curl, [
    CURLOPT_URL => "https://pfnapp.id/api/whatsapp/messages",
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => json_encode($payload),
    CURLOPT_HTTPHEADER => [
        "Authorization: Bearer " . getenv("WHATSAPP_API_KEY"),
        "Content-Type: application/json"
    ],
]);

$response = curl_exec($curl);
curl_close($curl);

echo $response;
```

---

## 5. Migration Checklist

- [ ] **Step 1:** Generate a new API Key in Console (`/console/whatsapp/api-keys`).
- [ ] **Step 2:** Update your application's environment variables (`WHATSAPP_API_BASE_URL` and `WHATSAPP_API_KEY`).
- [ ] **Step 3:** Test sending a template message to your test number.
- [ ] **Step 4:** Ensure template names and parameter order match approved Meta templates.
- [ ] **Step 5:** Configure Webhook URL in Console to receive real-time delivery reports (`sent`, `delivered`, `read`, `failed`).
