---
path: /whatsapp/developer-api
title: WhatsApp API Developer Guide & OpenAPI Reference
category: WhatsApp
purpose: Developer guide for static API key authentication, OpenAPI specification exploration, multi-language code snippets, and API testing.
howTo:
  - "Generate an organization API Key in Console > WhatsApp > API Keys (/console/whatsapp/api-keys)."
  - "Explore endpoints and request schemas at /api/openapi."
  - "Switch between code examples (cURL, TypeScript, Python, Go, PHP) for your preferred stack."
  - "Execute authenticated requests using Authorization: Bearer <API_KEY>."
notes:
  - "Plaintext API secret is displayed only once upon creation."
  - "Endpoints support both x-api-key and Authorization: Bearer <API_KEY> headers."
---

# WhatsApp API Developer Guide & OpenAPI Reference

This developer guide walks through integrating WhatsApp Business Platform APIs into your custom backend systems.

---

## 1. Authentication & API Key Lifecycle

To make authenticated API calls, generate an organization static API Key.

1. Navigate to **Console** > **WhatsApp** > **API Keys** (`/console/whatsapp/api-keys`).
2. Click **Generate API key** and copy the one-time secret.

![API Keys Management](/kb-assets/whatsapp/guides/07-journey2-api-keys.png)

Pass the key in your HTTP requests:
```http
Authorization: Bearer pfn_wa_sec_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```
or
```http
x-api-key: pfn_wa_sec_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 2. Interactive OpenAPI Specification

Visit `/api/openapi` to access the interactive OpenAPI documentation with schema definitions, required parameters, and response models.

![OpenAPI Reference](/kb-assets/whatsapp/guides/08-journey2-openapi-reference.png)

### Key WhatsApp Endpoints:
- `POST /api/whatsapp/messages` — Send template, text, or interactive messages.
- `GET /api/whatsapp/devices` — List connected WhatsApp sender numbers.
- `GET /api/whatsapp/templates` — List registered templates and dynamic parameters.

---

## 3. Switching Code Examples

The API Reference provides ready-to-use code snippets in multiple languages:

![OpenAPI Code Example](/kb-assets/whatsapp/guides/09-journey2-openapi-code-example.png)

---

## 4. Code Examples

### cURL

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

### TypeScript / Node.js

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

const data = await response.json()
console.log("API Response:", data)
```

### Python

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

res = requests.post(url, json=payload, headers=headers)
print(res.status_code, res.json())
```
