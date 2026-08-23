---
path: /whatsapp/developer-api
locale: id
title: Developer API WhatsApp & OpenAPI
category: WhatsApp
purpose: Panduan developer untuk otentikasi API key statis, eksplorasi spesifikasi OpenAPI, contoh kode multi-bahasa, dan pengujian API.
howTo:
  - "Buat API Key organisasi di menu Console > WhatsApp > API Keys (/console/whatsapp/api-keys)."
  - "Pelajari spesifikasi endpoint dan schema request di /api/openapi."
  - "Pilih contoh kode pemrograman (cURL, TypeScript, Python, Go, PHP) sesuai stack backend Anda."
  - "Jalankan request terotentikasi menggunakan header Authorization: Bearer <API_KEY>."
notes:
  - "Secret API Key hanya ditampilkan satu kali saat pembuatan atau rotasi."
  - "Endpoint mendukung autentikasi via header x-api-key maupun Authorization: Bearer <API_KEY>."
---

# Panduan Integrasi WhatsApp API & Referensi OpenAPI

Panduan pengembang (_developer guide_) ini menjelaskan langkah integrasi WhatsApp Business Platform API ke dalam sistem backend kustom Anda.

---

## 1. Otentikasi & Pengelolaan API Key

Untuk melakukan pemanggilan API terotentikasi, buat API Key statis organisasi terlebih dahulu:

1. Buka menu **Console** > **WhatsApp** > **API Keys** (`/console/whatsapp/api-keys`).
2. Klik tombol **Generate API key** dan salin secret yang diberikan.

![Manajemen API Key](/kb-assets/whatsapp/guides/07-journey2-api-keys.png)

Kirimkan token tersebut pada header HTTP request Anda:

```http
Authorization: Bearer pfn_wa_sec_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

atau

```http
x-api-key: pfn_wa_sec_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 2. Referensi Interaktif Spesifikasi OpenAPI

Buka `/api/openapi` untuk mengakses dokumentasi interaktif OpenAPI lengkap dengan skema parameter, model data, dan format respons JSON.

![Referensi OpenAPI](/kb-assets/whatsapp/guides/08-journey2-openapi-reference.png)

### Endpoint Utama WhatsApp:

- `POST /api/whatsapp/messages` — Mengirimkan pesan template, teks bebas, atau pesan interaktif.
- `GET /api/whatsapp/devices` — Mengambil daftar perangkat WhatsApp yang terhubung.
- `GET /api/whatsapp/templates` — Mengambil daftar template pesan dan struktur parameternya.

---

## 3. Beralih Contoh Bahasa Pemrograman

Halaman referensi API menyediakan cuplikan kode siap pakai untuk berbagai bahasa pemrograman populer:

![Contoh Kode OpenAPI](/kb-assets/whatsapp/guides/09-journey2-openapi-code-example.png)

---

## 4. Contoh Pemanggilan API

### cURL

```bash
curl -X POST "https://pfnapp.id/api/whatsapp/messages" \
  -H "Authorization: Bearer pfn_wa_sec_xxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+6281234567890",
    "type": "template",
    "template": {
      "name": "notifikasi_status_pesanan",
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
const response = await fetch("https://pfnapp.id/api/whatsapp/messages", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.PFN_WHATSAPP_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    to: "+6281234567890",
    type: "template",
    template: {
      name: "notifikasi_status_pesanan",
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
console.log("Respons API:", data)
```

### Python

```python
import os
import requests

url = "https://pfnapp.id/api/whatsapp/messages"
headers = {
    "Authorization": f"Bearer {os.getenv('PFN_WHATSAPP_API_KEY')}",
    "Content-Type": "application/json",
}
payload = {
    "to": "+6281234567890",
    "type": "template",
    "template": {
        "name": "notifikasi_status_pesanan",
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
print("Status Code:", res.status_code)
print("Response JSON:", res.json())
```
