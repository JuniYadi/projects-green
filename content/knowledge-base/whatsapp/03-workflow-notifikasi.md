---
path: /whatsapp/workflow-notifikasi
locale: en
title: "Workflow: Order Notifications, Invoices, and Reminders"
category: WhatsApp
purpose: "Guide to automating transactional WhatsApp notifications including invoice summaries, shipping updates, and booking reminders using UTILITY templates."
howTo:
  - "Create a UTILITY template in Console > WhatsApp > Templates with dynamic placeholders {{1}}, {{2}}, etc."
  - "Attach Call-to-Action (CTA URL) or Quick Reply buttons to simplify customer actions."
  - "Pass dynamic parameter values inside components.parameters in the API request."
  - "Listen to delivery status webhooks to know when customers read their invoices."
notes:
  - "UTILITY templates are reserved for transactional messages tied to active purchases or user accounts."
  - "Parameter count and order in your JSON payload must match placeholder definitions exactly."
---

# Workflow: Order Notifications, Invoices, and Reminders

This guide covers automating transactional WhatsApp alerts, including new invoice dispatches, payment confirmations, and courier tracking updates.

---

## 1. Mobile Preview of the Invoice Message

How a transactional invoice update appears with a direct payment action button:

```
┌──────────────────────────────────────────────┐
│ 🛍️ PFN Store: Order Invoice                  │
│                                              │
│ Hello *Budi Setiawan*,                       │
│ Your order *#INV-2026-0891* has been placed! │
│                                              │
│ • Total Amount: *$120.00*                    │
│ • Due Date    : August 24, 2026, 23:59 UTC   │
│                                              │
│ Please complete payment using the link below:│
│ ──────────────────────────────────────────── │
│ [ 💳 Pay Now ]                               │
│ 10:15 ✓✓                                     │
└──────────────────────────────────────────────┘
```

---

## 2. Template Setup (1 Minute)

1. Navigate to **Console > WhatsApp > Templates** (`/console/whatsapp/templates`).
2. Create a new template:
   - **Template Name**: `order_invoice_update`
   - **Category**: `UTILITY`
   - **Language**: English (`en`)
   - **Body Content**:
     ```
     Hello *{{1}}*,
     Your order *#{{2}}* has been placed!

     • Total Amount: *{{3}}*
     • Due Date : {{4}}

     Please complete payment using the link below:
     ```
   - **Buttons**: URL Button `https://pfnapp.id/pay/{{1}}`

![Templates List](/kb-assets/whatsapp/guides/02-journey1-templates-list.png)

---

## 3. Implementation Code

Send an HTTP POST request to `/api/whatsapp/messages` carrying dynamic parameter values:

### Node.js / TypeScript (Next.js / Express)

```typescript
interface InvoiceNotificationPayload {
  customerPhone: string
  customerName: string
  invoiceNumber: string
  totalAmount: string
  dueDate: string
  invoiceSlug: string
}

export async function sendInvoiceNotification(data: InvoiceNotificationPayload) {
  const response = await fetch("https://pfnapp.id/api/whatsapp/messages", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.PFN_WHATSAPP_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: data.customerPhone,
      type: "template",
      template: {
        name: "order_invoice_update",
        language: { code: "en" },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: data.customerName },   // {{1}}
              { type: "text", text: data.invoiceNumber },  // {{2}}
              { type: "text", text: data.totalAmount },    // {{3}}
              { type: "text", text: data.dueDate },        // {{4}}
            ],
          },
          {
            type: "button",
            sub_type: "url",
            index: "0",
            parameters: [
              { type: "text", text: data.invoiceSlug },    // Appended to CTA URL
            ],
          },
        ],
      },
    }),
  })

  return await response.json()
}
```

### PHP / Laravel (Payment Event Listener)

```php
namespace App\Listeners;

use App\Events\OrderCreated;
use Illuminate\Support\Facades\Http;

class SendWhatsAppInvoiceNotification
{
    public function handle(OrderCreated $event): void
    {
        $order = $event->order;

        Http::withToken(config('services.pfn.whatsapp_key'))
            ->post('https://pfnapp.id/api/whatsapp/messages', [
                'to' => $order->customer_phone,
                'type' => 'template',
                'template' => [
                    'name' => 'order_invoice_update',
                    'language' => ['code' => 'en'],
                    'components' => [
                        [
                            'type' => 'body',
                            'parameters' => [
                                ['type' => 'text', 'text' => $order->customer_name],
                                ['type' => 'text', 'text' => $order->invoice_number],
                                ['type' => 'text', 'text' => '$' . number_format($order->total_amount, 2)],
                                ['type' => 'text', 'text' => $order->due_date_formatted],
                            ],
                        ],
                        [
                            'type' => 'button',
                            'sub_type' => 'url',
                            'index' => '0',
                            'parameters' => [
                                ['type' => 'text', 'text' => $order->id],
                            ],
                        ],
                    ],
                ],
            ]);
    }
}
```

### Python (Celery / Background Worker)

```python
import os
import requests

def dispatch_invoice_whatsapp(phone: str, name: str, inv_no: str, total: str, due: str, inv_id: str):
    url = "https://pfnapp.id/api/whatsapp/messages"
    payload = {
        "to": phone,
        "type": "template",
        "template": {
            "name": "order_invoice_update",
            "language": {"code": "en"},
            "components": [
                {
                    "type": "body",
                    "parameters": [
                        {"type": "text", "text": name},
                        {"type": "text", "text": inv_no},
                        {"type": "text", "text": total},
                        {"type": "text", "text": due},
                    ],
                },
                {
                    "type": "button",
                    "sub_type": "url",
                    "index": "0",
                    "parameters": [{"type": "text", "text": inv_id}],
                },
            ],
        },
    }
    
    headers = {
        "Authorization": f"Bearer {os.getenv('PFN_WHATSAPP_API_KEY')}",
        "Content-Type": "application/json",
    }
    
    res = requests.post(url, json=payload, headers=headers)
    return res.json()
```

---

## 4. Operational Tips

1. **Parameter Count Matching**: If a template contains 4 placeholders `{{1}}` to `{{4}}`, exactly 4 items must be present in `parameters`.
2. **Special Characters**: Avoid inserting unescaped tabs or multiple linebreaks inside a single string parameter.
