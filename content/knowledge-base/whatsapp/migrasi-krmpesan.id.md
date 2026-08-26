---
path: /whatsapp/migrasi-krmpesan
locale: id
title: Migrasi dari krmpesan.app
category: WhatsApp
purpose: Panduan lengkap langkah migrasi integrasi API dari krmpesan.app legacy ke platform baru.
howTo:
  - "Buat API Key organisasi di menu Console > WhatsApp > API Keys (/console/whatsapp/api-keys)."
  - "Ubah Base URL endpoint dari api.krmpesan.app ke pfnapp.id/api/whatsapp."
  - "Sesuaikan format Authorization header menjadi Bearer <API_KEY> atau x-api-key."
  - "Kirimkan request menggunakan payload legacy atau format standar baru."
notes:
  - "API baru sepenuhnya backward-compatible terhadap payload template krmpesan lama."
  - "Pesan teks bebas memerlukan sesi 24 jam aktif (customer service window) sesuai ketentuan Meta."
---

# Migrasi dari krmpesan.app

Panduan ini berisi langkah-langkah praktis untuk memigrasikan integrasi sistem backend Anda dari layanan **krmpesan.app** versi lama ke platform WhatsApp Business API yang baru.

---

## 1. Ringkasan Perubahan (Overview)

Platform baru dirancang dengan **kompatibilitas mundur (backward-compatibility)**. Anda tidak perlu langsung merombak format JSON payload lama Anda. Cukup perbarui **Base URL** dan **API Key**.

| Komponen | krmpesan.app (Lama) | Platform Baru | Catatan |
| :--- | :--- | :--- | :--- |
| **Base URL** | `https://api.krmpesan.app/` | `https://pfnapp.id/api/whatsapp/` | Prefix `/api/whatsapp` |
| **Autentikasi** | `Authorization: Bearer <userToken>` | `Authorization: Bearer <API_KEY>` atau `x-api-key: <API_KEY>` | Gunakan Static Org API Key |
| **Kirim Pesan** | `POST /messages` | `POST /api/whatsapp/messages` | Mendukung payload lama & baru |
| **Daftar Pesan** | `GET /messages` | `GET /api/whatsapp/messages` | Riwayat pesan dan status |
| **Daftar Template** | `GET /templates` | `GET /api/whatsapp/templates` | Sinkronisasi template Meta |
| **Daftar Kontak** | `GET /contacts` | `GET /api/whatsapp/contacts` | Manajemen kontak audiens |
| **Webhook Status** | `POST /webhooks` | `GET /api/whatsapp/webhooks/events` | Log event & status pengiriman |

---

## 2. Autentikasi & API Key Baru

Pada platform baru, autentikasi menggunakan **Organization API Key** yang dapat digenerate melalui Console:

1. Masuk ke **Console** > **WhatsApp** > **API Keys** (`/console/whatsapp/api-keys`).
2. Klik tombol **Generate API key** dan simpan token rahasia yang muncul (berawalan `pfn_wa_sec_` atau `wa_live_`).
3. Tambahkan token ke header permintaan HTTP Anda:

```http
Authorization: Bearer pfn_wa_sec_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
Content-Type: application/json
```

*Atau menggunakan header kustom:*

```http
x-api-key: pfn_wa_sec_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
Content-Type: application/json
```

---

## 3. Komparasi Payload & Contoh Pengiriman

### A. Pengiriman Pesan Template

#### 1. Format Legacy krmpesan (Drop-in Replacement)
Anda dapat tetap menggunakan struktur JSON payload lama Anda tanpa perubahan kode logika:

```bash
curl -X POST "https://pfnapp.id/api/whatsapp/messages" \
  -H "Authorization: Bearer pfn_wa_sec_xxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "081234567890",
    "template_name": "notifikasi_tagihan",
    "template_language": "id",
    "template": {
      "body": ["Budi Santoso", "INV-2026-001", "Rp 150.000"]
    }
  }'
```

#### 2. Format Standar Baru (OpenAPI / Meta Cloud Architecture)
Format baru yang direkomendasikan untuk mendukung parameter dinamis header (gambar/dokumen/video) serta tombol interaktif:

```bash
curl -X POST "https://pfnapp.id/api/whatsapp/messages" \
  -H "Authorization: Bearer pfn_wa_sec_xxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+6281234567890",
    "type": "template",
    "template": {
      "name": "notifikasi_tagihan",
      "language": {
        "code": "id"
      },
      "components": [
        {
          "type": "body",
          "parameters": [
            { "type": "text", "text": "Budi Santoso" },
            { "type": "text", "text": "INV-2026-001" },
            { "type": "text", "text": "Rp 150.000" }
          ]
        }
      ]
    }
  }'
```

---

### B. Pengiriman Pesan Teks Bebas (Session Message)

> **Ketentuan Meta:** Pesan teks bebas (non-template) hanya dapat dikirim jika pelanggan telah mengirim pesan ke nomor WhatsApp Anda dalam kurun waktu 24 jam terakhir.

```bash
curl -X POST "https://pfnapp.id/api/whatsapp/messages" \
  -H "Authorization: Bearer pfn_wa_sec_xxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "081234567890",
    "type": "text",
    "message": "Halo Budi, customer support kami sedang meninjau pertanyaan Anda."
  }'
```

---

### C. Pengiriman Pesan Media (Gambar / Dokumen)

```bash
curl -X POST "https://pfnapp.id/api/whatsapp/messages" \
  -H "Authorization: Bearer pfn_wa_sec_xxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "081234567890",
    "type": "image",
    "mediaUrl": "https://assets.domain.com/invoices/inv-001.jpg",
    "caption": "Lampiran Bukti Transaksi #INV-2026-001"
  }'
```

---

## 4. Contoh Integrasi Kode

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
      template_name: "notifikasi_tagihan",
      template_language: "id",
      template: {
        body: ["Budi Santoso", "INV-2026-001", "Rp 150.000"],
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
    "template_name" => "notifikasi_tagihan",
    "template_language" => "id",
    "template" => [
        "body" => ["Budi Santoso", "INV-2026-001", "Rp 150.000"]
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

## 5. Checklist Langkah Migrasi

- [ ] **Langkah 1:** Buat API Key baru di Console WhatsApp (`/console/whatsapp/api-keys`).
- [ ] **Langkah 2:** Perbarui konfigurasi environment aplikasi (`WHATSAPP_API_BASE_URL` dan `WHATSAPP_API_KEY`).
- [ ] **Langkah 3:** Uji coba pengiriman pesan template ke nomor pengujian.
- [ ] **Langkah 4:** Pastikan nama template dan urutan variabel body sesuai dengan template yang disetujui di Meta.
- [ ] **Langkah 5:** Hubungkan webhook callback untuk memantau status pesan masuk dan delivery report (`sent`, `delivered`, `read`, `failed`).
