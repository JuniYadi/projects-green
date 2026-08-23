---
path: /whatsapp/quickstart
locale: id
title: "Panduan Memulai: Kirim Pesan Pertama dalam 5 Menit"
category: WhatsApp
purpose: "Panduan cepat dan langkah demi langkah untuk mengintegrasikan WhatsApp Business API dan mengirim pesan uji coba pertama."
howTo:
  - "Buat API Key organisasi pada menu Console > WhatsApp > API Keys."
  - "Pastikan nomor penerima menggunakan format internasional E.164 (contoh: +6281234567890)."
  - "Kirim HTTP POST request ke /api/whatsapp/messages membawa Bearer Token dan payload pesan."
  - "Pantau status pengiriman pada menu Console > WhatsApp > Log Pesan."
notes:
  - "API Key bersifat rahasia dan hanya ditampilkan satu kali saat pembuatan."
  - "Format nomor telepon tidak boleh menggunakan awalan 08 atau tanda hubung/spasi."
---

# Panduan Memulai: Kirim Pesan WhatsApp dalam 5 Menit

Panduan praktis ini dirancang agar Anda dapat mengirimkan pesan WhatsApp pertama dari sistem backend ke nomor ponsel Anda dalam hitungan menit.

---

## 1. Pratinjau Pesan di Layar Pengguna

Pesan teks sederhana yang akan diterima oleh nomor tujuan di aplikasi WhatsApp:

```
┌──────────────────────────────────────────────┐
│ 🟢 PFNApp Official                           │
│                                              │
│ Halo! Ini adalah pesan uji coba pertama      │
│ yang dikirim melalui WhatsApp Business API.  │
│                                              │
│ 10:45 ✓✓                                     │
└──────────────────────────────────────────────┘
```

---

## 2. Persiapan Cepat (1 Menit)

Sebelum melakukan pemanggilan API, siapkan dua hal berikut:

1. **API Key Organisasi**: Buka menu **Console > WhatsApp > API Keys** (`/console/whatsapp/api-keys`), klik **Generate API Key**, lalu simpan kunci rahasia Anda.
2. **Format Nomor Tujuan (E.164)**: Selalu gunakan format internasional diawali tanda plus (`+`) dan kode negara tanpa angka `0` di depan.
   - ✅ Benar: `+6281234567890`
   - ❌ Salah: `081234567890`, `62812-3456-7890`

![Daftar API Key](/kb-assets/whatsapp/guides/07-journey2-api-keys.png)

---

## 3. Kirim Pesan Uji Coba (Pilih Bahasa Anda)

Endpoint pengiriman pesan berada di `POST https://pfnapp.my.id/api/whatsapp/messages`.

### cURL

```bash
curl -X POST "https://pfnapp.my.id/api/whatsapp/messages" \
  -H "Authorization: Bearer pfn_wa_sec_YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+6281234567890",
    "type": "text",
    "text": {
      "body": "Halo! Ini adalah pesan uji coba pertama yang dikirim melalui WhatsApp Business API."
    }
  }'
```

### Node.js / TypeScript (Fetch API)

```typescript
const API_KEY = process.env.PFN_WHATSAPP_API_KEY || "pfn_wa_sec_YOUR_API_KEY"

async function sendQuickMessage() {
  const response = await fetch("https://pfnapp.my.id/api/whatsapp/messages", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: "+6281234567890",
      type: "text",
      text: {
        body: "Halo! Ini adalah pesan uji coba pertama yang dikirim melalui WhatsApp Business API.",
      },
    }),
  })

  const result = await response.json()
  console.log("Hasil Pengiriman:", result)
}

sendQuickMessage()
```

### PHP / Laravel (Http Client)

```php
use Illuminate\Support\Facades\Http;

$response = Http::withToken(config('services.pfn.whatsapp_key'))
    ->post('https://pfnapp.my.id/api/whatsapp/messages', [
        'to' => '+6281234567890',
        'type' => 'text',
        'text' => [
            'body' => 'Halo! Ini adalah pesan uji coba pertama yang dikirim melalui WhatsApp Business API.',
        ],
    ]);

if ($response->successful()) {
    $data = $response->json();
    logger()->info("Pesan berhasil dikirim dengan ID: " . $data['id']);
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
        "body": "Halo! Ini adalah pesan uji coba pertama yang dikirim melalui WhatsApp Business API."
    }
}

response = requests.post(
    "https://pfnapp.my.id/api/whatsapp/messages",
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

## 4. Memeriksa Status Pengiriman

Setelah pesan terkirim, Anda dapat memantau status pesan di antarmuka Console:

1. Buka menu **Console > WhatsApp > Messages** (`/console/whatsapp/messages`).
2. Periksa badge status pesan:
   - **SENT**: Pesan berhasil diterima oleh server WhatsApp.
   - **DELIVERED**: Pesan sudah masuk ke perangkat penerima (centang dua abu-abu).
   - **READ**: Pesan telah dibuka dan dibaca oleh penerima (centang dua biru).
   - **FAILED**: Pengiriman gagal (misal: nomor tidak terdaftar atau saldo deposit habis).

![Log Pesan Terkirim](/kb-assets/whatsapp/guides/04-journey1-send-message.png)
