---
path: /whatsapp/workflow-otp
locale: id
title: "Workflow: Mengirim Kode OTP & Verifikasi 2FA"
category: WhatsApp
purpose: "Panduan integrasi pengiriman kode OTP aman dan verifikasi dua langkah (2FA) menggunakan template resmi WhatsApp Authentication."
howTo:
  - "Buat template pesan dengan kategori AUTHENTICATION di menu Console > WhatsApp > Templates."
  - "Tambahkan tombol resmi jenis Copy Code (Salin Kode) pada template."
  - "Panggil endpoint POST /api/whatsapp/messages dengan menyertakan kode OTP di parameter body dan button."
  - "Simpan token OTP di sisi backend dengan masa berlaku (TTL) 3 hingga 5 menit."
notes:
  - "Template AUTHENTICATION memiliki tarif pesan terendah dan prioritas delivery tinggi."
  - "Jangan pernah menyertakan tautan klik bebas (open link) di dalam body template OTP untuk mematuhi kebijakan Meta."
---

# Workflow: Mengirim Kode OTP & Verifikasi 2FA

Panduan ini menjelaskan arsitektur dan langkah pengiriman kode verifikasi satu kali (_One-Time Password_) ke WhatsApp pelanggan secara otomatis saat proses registrasi, login, atau transaksi sensitif.

---

## 1. Pratinjau Pesan OTP di Layar Pengguna

Tampilan template resmi kategori `AUTHENTICATION` dengan tombol _Salin Kode_:

```
┌──────────────────────────────────────────────┐
│ 🔐 Kode Keamanan Akun                        │
│                                              │
│ Kode verifikasi PFNApp Anda adalah: *492019* │
│ Berlaku selama 5 menit. Jangan berikan kode  │
│ ini kepada siapa pun, termasuk pihak kami.   │
│                                              │
│ ──────────────────────────────────────────── │
│ [ 📋 Salin Kode: 492019 ]                    │
│ 14:20 ✓✓                                     │
└──────────────────────────────────────────────┘
```

---

## 2. Persiapan Template & Kebutuhan (1 Menit)

1. Buka menu **Console > WhatsApp > Templates** (`/console/whatsapp/templates`).
2. Klik **Buat Template**:
   - **Nama Template**: `otp_auth_code`
   - **Kategori**: `AUTHENTICATION`
   - **Bahasa**: Indonesian (`id`)
   - **Tipe Tombol**: `OTP / COPY_CODE`
3. Simpan dan tunggu status template disetujui (umumnya instan).

![Daftar Template](/kb-assets/whatsapp/guides/02-journey1-templates-list.png)

---

## 3. Contoh Implementasi Pengiriman OTP

Kirimkan HTTP POST ke `/api/whatsapp/messages` dengan parameter template `otp_auth_code`:

### Node.js / TypeScript (Next.js / Express Backend)

```typescript
interface SendOtpOptions {
  phoneNumber: string
  otpCode: string
}

export async function sendWhatsAppOtp({
  phoneNumber,
  otpCode,
}: SendOtpOptions) {
  const response = await fetch("https://pfnapp.id/api/whatsapp/messages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.PFN_WHATSAPP_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: phoneNumber, // contoh: "+6281234567890"
      type: "template",
      template: {
        name: "otp_auth_code",
        language: { code: "id" },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: otpCode }, // Variabel {{1}} di body teks
            ],
          },
          {
            type: "button",
            sub_type: "copy_code",
            index: "0",
            parameters: [
              { type: "text", text: otpCode }, // Parameter kode pada tombol Salin Kode
            ],
          },
        ],
      },
    }),
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(`Gagal mengirim OTP: ${JSON.stringify(errorData)}`)
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
                    'language' => ['code' => 'id'],
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
            "language": {"code": "id"},
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

## 4. Rekomendasi Keamanan & Best Practices

1. **Masa Berlaku Kode (TTL)**: Simpan hash kode OTP di memory cache (Redis) dengan TTL maksimal **5 menit**.
2. **Pembatasan Upaya (Rate Limiting)**: Batasi request pengiriman OTP maksimal 3 kali per nomor dalam rentang waktu 10 menit untuk mencegah spam dan tagihan tak terduga.
3. **Format Nomor E.164**: Pastikan backend Anda menormalisasi input pengguna (misal: otomatis mengubah `0812...` menjadi `+62812...` sebelum request dikirim).
