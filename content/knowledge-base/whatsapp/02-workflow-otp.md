---
path: /whatsapp/workflow-otp
locale: en
title: "Workflow: Sending OTP Codes & 2FA Verification"
category: WhatsApp
purpose: "Integration guide for secure one-time password (OTP) dispatch and two-factor authentication (2FA) using official WhatsApp Authentication templates."
howTo:
  - "Create an AUTHENTICATION category message template in Console > WhatsApp > Templates."
  - "Add a Copy Code button component to the template definition."
  - "Dispatch an HTTP POST request to /api/whatsapp/messages supplying the dynamic OTP code."
  - "Enforce an expiry TTL (3-5 minutes) for the OTP token on your backend."
notes:
  - "AUTHENTICATION templates benefit from lowest per-conversation rates and highest delivery priority."
  - "Never include plain URLs in OTP template bodies to maintain compliance with Meta security guidelines."
---

# Workflow: Sending OTP Codes & 2FA Verification

This workflow guide covers automated One-Time Password (OTP) dispatch to customer WhatsApp numbers for registration, login, and sensitive transaction verification.

---

## 1. Mobile Preview of the OTP Message

How the official `AUTHENTICATION` template appears with the *Copy Code* button:

```
┌──────────────────────────────────────────────┐
│ 🔐 Account Security Code                     │
│                                              │
│ Your PFNApp verification code is: *492019*   │
│ Valid for 5 minutes. Do not share this code  │
│ with anyone under any circumstances.         │
│                                              │
│ ──────────────────────────────────────────── │
│ [ 📋 Copy Code: 492019 ]                     │
│ 14:20 ✓✓                                     │
└──────────────────────────────────────────────┘
```

---

## 2. Template Setup (1 Minute)

1. Open **Console > WhatsApp > Templates** (`/console/whatsapp/templates`).
2. Click **Create Template**:
   - **Template Name**: `otp_auth_code`
   - **Category**: `AUTHENTICATION`
   - **Language**: English (`en`) or Indonesian (`id`)
   - **Button Type**: `OTP / COPY_CODE`
3. Save and wait for automatic approval.

![Templates Management](/kb-assets/whatsapp/guides/02-journey1-templates-list.png)

---

## 3. Implementation Code

Send an HTTP POST request to `/api/whatsapp/messages` using template parameters:

### Node.js / TypeScript (Next.js / Express Backend)

```typescript
interface SendOtpOptions {
  phoneNumber: string
  otpCode: string
}

export async function sendWhatsAppOtp({ phoneNumber, otpCode }: SendOtpOptions) {
  const response = await fetch("https://pfnapp.id/api/whatsapp/messages", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.PFN_WHATSAPP_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: phoneNumber, // e.g., "+6281234567890"
      type: "template",
      template: {
        name: "otp_auth_code",
        language: { code: "en" },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: otpCode } // Variable {{1}} in body
            ],
          },
          {
            type: "button",
            sub_type: "copy_code",
            index: "0",
            parameters: [
              { type: "text", text: otpCode } // Copy Code button parameter
            ],
          },
        ],
      },
    }),
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(`Failed to send OTP: ${JSON.stringify(errorData)}`)
  }

  return await response.json()
}
```

### PHP / Laravel (Service Class)

```php
namespace App\Services;

use Illuminate\Support\Facades\Http;

class WhatsAppOtpService
{
    public function sendOtp(string $phoneNumber, string $otpCode): array
    {
        $response = Http::withToken(config('services.pfn.whatsapp_key'))
            ->post('https://pfnapp.id/api/whatsapp/messages', [
                'to' => $phoneNumber,
                'type' => 'template',
                'template' => [
                    'name' => 'otp_auth_code',
                    'language' => ['code' => 'en'],
                    'components' => [
                        [
                            'type' => 'body',
                            'parameters' => [
                                ['type' => 'text', 'text' => $otpCode],
                            ],
                        ],
                        [
                            'type' => 'button',
                            'sub_type' => 'copy_code',
                            'index' => '0',
                            'parameters' => [
                                ['type' => 'text', 'text' => $otpCode],
                            ],
                        ],
                    ],
                ],
            ]);

        return $response->throw()->json();
    }
}
```

### Python (FastAPI / Django Backend)

```python
import os
import requests

def send_whatsapp_otp(phone_number: str, otp_code: str) -> dict:
    url = "https://pfnapp.id/api/whatsapp/messages"
    headers = {
        "Authorization": f"Bearer {os.getenv('PFN_WHATSAPP_API_KEY')}",
        "Content-Type": "application/json",
    }
    payload = {
        "to": phone_number,
        "type": "template",
        "template": {
            "name": "otp_auth_code",
            "language": {"code": "en"},
            "components": [
                {
                    "type": "body",
                    "parameters": [{"type": "text", "text": otp_code}],
                },
                {
                    "type": "button",
                    "sub_type": "copy_code",
                    "index": "0",
                    "parameters": [{"type": "text", "text": otp_code}],
                },
            ],
        },
    }

    res = requests.post(url, json=payload, headers=headers)
    res.raise_for_status()
    return res.json()
```

---

## 4. Security Recommendations & Best Practices

1. **Token Expiry (TTL)**: Store OTP hash inside Redis cache with a strict TTL of **3 to 5 minutes**.
2. **Rate Limiting**: Limit OTP requests to 3 attempts per phone number per 10-minute window to avoid abuse.
3. **E.164 Phone Normalization**: Sanitize user input to international format (e.g., `0812...` to `+62812...`) before dispatch.
