---
path: /whatsapp/workflow-webhook-bot
locale: en
title: "Workflow: Handling Incoming Messages & Auto-Reply Bots"
category: WhatsApp
purpose: "Webhook integration guide to capture incoming customer messages and construct intelligent auto-reply bots on your backend."
howTo:
  - "Register your backend Webhook URL inside Console > WhatsApp > Webhooks."
  - "Verify the HMAC-SHA256 signature in the x-hub-signature-256 header."
  - "Parse sender phone number and message body from the messages.upsert event payload."
  - "Reply instantly to customer questions using the POST /api/whatsapp/messages endpoint."
notes:
  - "Your webhook endpoint must return HTTP 200 OK within 5 seconds to prevent retries."
  - "Replies sent within the 24-hour customer service window do not require pre-approved templates."
---

# Workflow: Handling Incoming Messages & Auto-Reply Bots

This guide covers setting up two-way WhatsApp communication by capturing inbound messages via Webhooks and triggering automated responses from your server.

---

## 1. Mobile Preview of the Two-Way Interaction

Example automated Q&A flow between a user and your backend auto-responder:

```
┌──────────────────────────────────────────────┐
│ 👤 Customer:                                 │
│ "Hi, can I check your menu and pricing?"     │
│ 13:00 ✓✓                                     │
│                                              │
│ 🤖 PFNApp Bot (Automated Reply):             │
│ "Hello! 👋 Thank you for reaching out. Here  │
│ are quick navigation options:                │
│                                              │
│ 1️⃣ Type *PROMO* for today's discount        │
│ 2️⃣ Type *MENU* for product catalog          │
│ 3️⃣ Type *SUPPORT* to reach our team"         │
│ 13:00 ✓✓                                     │
└──────────────────────────────────────────────┘
```

---

## 2. Webhook Setup (1 Minute)

1. Open **Console > WhatsApp > Webhooks** (`/console/whatsapp/webhooks`).
2. Input your public backend webhook endpoint:
   - Example: `https://api.yourdomain.com/api/whatsapp/webhook`
3. Note your **Webhook Secret** for cryptographic signature verification.

![Webhook Logs](/kb-assets/whatsapp/guides/05-journey1-webhook-logs.png)

---

## 3. Inbound Payload Structure

When a customer messages your WhatsApp business number, your webhook endpoint receives a structured JSON payload:

```json
{
  "event": "messages.upsert",
  "data": {
    "from": "+6281234567890",
    "messageId": "wamid.HBgLM...",
    "timestamp": 1771747200,
    "type": "text",
    "text": {
      "body": "Hi, can I check your menu and pricing?"
    }
  }
}
```

---

## 4. Backend Receiver & Auto-Reply Examples

### Node.js / Express (TypeScript)

```typescript
import express from "express"
import crypto from "crypto"

const app = express()
app.use(express.json())

const WEBHOOK_SECRET = process.env.WHATSAPP_WEBHOOK_SECRET || "pfn_whsec_..."
const API_KEY = process.env.PFN_WHATSAPP_API_KEY || "pfn_wa_sec_..."

// 1. Webhook Endpoint Receiver
app.post("/api/whatsapp/webhook", async (req, res) => {
  // A. Optional HMAC Signature Validation
  const signature = req.headers["x-hub-signature-256"] as string
  if (signature) {
    const hmac = crypto
      .createHmac("sha256", WEBHOOK_SECRET)
      .update(JSON.stringify(req.body))
      .digest("hex")
    if (`sha256=${hmac}` !== signature) {
      return res.status(401).send("Invalid signature")
    }
  }

  // B. Return 200 OK immediately
  res.status(200).send("OK")

  const { event, data } = req.body

  // C. Process inbound text message
  if (event === "messages.upsert" && data?.type === "text") {
    const senderPhone = data.from
    const userText = data.text?.body?.toLowerCase() || ""

    // Simple Auto-Reply Logic
    let replyText = "Hello! Type *MENU* to view products or *SUPPORT* for help."

    if (userText.includes("menu") || userText.includes("pricing")) {
      replyText =
        "📋 *Our Product Packages*:\n1. Starter: $10\n2. Pro: $35\n\nType *ORDER* to purchase."
    } else if (userText.includes("support") || userText.includes("help")) {
      replyText =
        "👨‍💼 A customer support agent will join this conversation shortly."
    }

    // D. Send Instant Response (Free-form text message inside 24h window)
    await fetch("https://pfnapp.id/api/whatsapp/messages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: senderPhone,
        type: "text",
        text: { body: replyText },
      }),
    })
  }
})

app.listen(3000, () => console.log("Webhook receiver running on port 3000"))
```

### PHP / Laravel (Route & Controller)

```php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class WhatsAppWebhookController extends Controller
{
    public function handle(Request $request)
    {
        $payload = $request->all();

        // 1. Handle inbound message event
        if (($payload['event'] ?? '') === 'messages.upsert') {
            $sender = $payload['data']['from'] ?? null;
            $text = strtolower($payload['data']['text']['body'] ?? '');

            if ($sender && $text) {
                $reply = "Thank you for contacting us. Type *INFO* for help.";

                if (str_contains($text, 'promo')) {
                    $reply = "🎉 Special offer: Use code *SAVE50* for 50% discount!";
                }

                // 2. Dispatch automated reply
                Http::withToken(config('services.pfn.whatsapp_key'))
                    ->post('https://pfnapp.id/api/whatsapp/messages', [
                        'to' => $sender,
                        'type' => 'text',
                        'text' => ['body' => $reply],
                    ]);
            }
        }

        return response()->json(['status' => 'success'], 200);
    }
}
```

---

## 5. 24-Hour Customer Service Window Rules

- **Active 24h Conversation Window**: Whenever a customer messages your WhatsApp business number first, a 24-hour session opens. You can reply using free-form text messages (`type: "text"`) without pre-approved template limitations.
- **Session Expiry**: Once 24 hours have elapsed without new inbound user messages, subsequent outbound communications must use pre-approved `template` messages.
