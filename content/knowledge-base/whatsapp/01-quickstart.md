---
path: /whatsapp/quickstart
locale: en
title: "Getting Started: Send Your First WhatsApp Message in 5 Minutes"
category: WhatsApp
purpose: "A fast, step-by-step guide to integrate the WhatsApp Business API and dispatch your first test message."
howTo:
  - "Generate an organization API Key in Console > WhatsApp > API Keys."
  - "Ensure recipient numbers follow the international E.164 format (e.g., +6281234567890)."
  - "Send an HTTP POST request to /api/whatsapp/messages with Bearer Token and message payload."
  - "Track delivery status in Console > WhatsApp > Messages."
notes:
  - "The API Key secret is shown only once upon creation."
  - "Phone numbers must start with country code (+) and omit leading zeros."
---

# Getting Started: Send Your First WhatsApp Message in 5 Minutes

This guide walks you through sending your first WhatsApp message from your backend system to your mobile device in just a few minutes.

---

## 1. Message Preview on Mobile

Here is how the test message appears on the recipient's WhatsApp screen:

```
┌──────────────────────────────────────────────┐
│ 🟢 PFNApp Official                           │
│                                              │
│ Hello! This is your first test message sent  │
│ via the WhatsApp Business API.               │
│                                              │
│ 10:45 ✓✓                                     │
└──────────────────────────────────────────────┘
```

---

## 2. Quick Setup (1 Minute)

Before making your first API call, prepare the following:

1. **Organization API Key**: Go to **Console > WhatsApp > API Keys** (`/console/whatsapp/api-keys`), click **Generate API Key**, and securely save your token.
2. **Recipient Number Format (E.164)**: Always use the international format starting with a plus sign (`+`) and country code without leading zeros.
   - ✅ Correct: `+6281234567890`
   - ❌ Incorrect: `081234567890`, `62812-3456-7890`

![API Keys List](/kb-assets/whatsapp/guides/07-journey2-api-keys.png)

---

## 3. Dispatch Test Message (Select Your Stack)

The message dispatch endpoint is `POST https://pfnapp.id/api/whatsapp/messages`.

### cURL

```bash
curl -X POST "https://pfnapp.id/api/whatsapp/messages" \
  -H "Authorization: Bearer pfn_wa_sec_YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+6281234567890",
    "type": "text",
    "text": {
      "body": "Hello! This is your first test message sent via the WhatsApp Business API."
    }
  }'
```

### Node.js / TypeScript (Fetch API)

```typescript
const API_KEY = process.env.PFN_WHATSAPP_API_KEY || "pfn_wa_sec_YOUR_API_KEY"

async function sendQuickMessage() {
  const response = await fetch("https://pfnapp.id/api/whatsapp/messages", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: "+6281234567890",
      type: "text",
      text: {
        body: "Hello! This is your first test message sent via the WhatsApp Business API.",
      },
    }),
  })

  const result = await response.json()
  console.log("Dispatch Result:", result)
}

sendQuickMessage()
```

### PHP / Laravel (Http Client)

```php
use Illuminate\Support\Facades\Http;

$response = Http::withToken(config('services.pfn.whatsapp_key'))
    ->post('https://pfnapp.id/api/whatsapp/messages', [
        'to' => '+6281234567890',
        'type' => 'text',
        'text' => [
            'body' => 'Hello! This is your first test message sent via the WhatsApp Business API.',
        ],
    ]);

if ($response->successful()) {
    $data = $response->json();
    logger()->info("Message dispatched successfully. ID: " . $data['id']);
}
```

### Python (Requests)

```python
import os
import requests

api_key = os.getenv("PFN_WHATSAPP_API_KEY", "pfn_wa_sec_YOUR_API_KEY")

payload = {
    "to": "+6281234567890",
    "type": "text",
    "text": {
        "body": "Hello! This is your first test message sent via the WhatsApp Business API."
    }
}

response = requests.post(
    "https://pfnapp.id/api/whatsapp/messages",
    headers={
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    },
    json=payload,
)

print("Status:", response.status_code)
print("Response:", response.json())
```

---

## 4. Verifying Delivery Status

Once dispatched, track message statuses inside the Console:

1. Navigate to **Console > WhatsApp > Messages** (`/console/whatsapp/messages`).
2. Review status badges:
   - **SENT**: Message accepted by WhatsApp cloud servers.
   - **DELIVERED**: Successfully delivered to the user's device (double gray checkmarks).
   - **READ**: Opened and read by the user (double blue checkmarks).
   - **FAILED**: Dispatch failed (e.g., unregistered phone number or insufficient balance).

![Message Logs](/kb-assets/whatsapp/guides/04-journey1-send-message.png)
