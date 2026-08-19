---
path: /whatsapp/api-keys
locale: id
title: Panduan Pengelolaan & Integrasi WhatsApp API Key
category: WhatsApp
purpose: Buat, rotasi, dan gunakan static API key organisasi Anda dengan aman untuk integrasi WhatsApp Business Platform.
howTo:
  - "Buka Console > WhatsApp > API Key (/console/whatsapp/api-keys)."
  - "Klik Generate API key dan salin rahasia API key (secret) satu kali."
  - "Simpan secret di password manager atau environment secrets backend Anda."
  - "Lakukan otentikasi request menggunakan header Authorization: Bearer <API_KEY>."
notes:
  - Plaintext API secret hanya ditampilkan satu kali saat pembuatan atau rotasi.
  - Setiap organisasi memiliki paling banyak 1 API key yang berstatus ACTIVE.
  - Rotasi API key akan langsung menonaktifkan API key sebelumnya.
---

# Panduan Pengelolaan & Integrasi WhatsApp API Key

Panduan ini menjelaskan cara membuat, melakukan rotasi, dan menggunakan WhatsApp API key organisasi Anda secara aman untuk mengintegrasikan layanan backend dengan WhatsApp Business Platform API.

---

## 1. Ikhtisar & Model Keamanan

WhatsApp API key memungkinkan backend server Anda melakukan otentikasi panggilan API atas nama organisasi Anda.

- **Zero-Trust Token Visibility**: Plaintext API secret **hanya ditampilkan satu kali** saat pertama kali dibuat atau dirotasi. Secret tidak pernah disimpan dalam bentuk plaintext di database dan tidak dapat dilihat kembali setelah halaman ditutup.
- **Single Active Key Model**: Setiap organisasi hanya memiliki satu key aktif (`ACTIVE`) pada satu waktu.
- **Metadata Aman**: Fingerprint (`wa_key_...`) dan riwayat lifecycle (Created, Rotated, Revoked, Last Used) dapat dibagikan dengan aman untuk kebutuhan audit log tanpa membocorkan token rahasia.

---

## 2. Membuat API Key Baru

### Langkah 1: Buka Menu WhatsApp API Key di Console
Arahkan ke **Console** > **WhatsApp** > **API Key** (`/console/whatsapp/api-keys`).

Jika organisasi Anda belum memiliki API key yang aktif, lencana status akan menampilkan **Not generated**.

![Status Awal Belum Dibuat](/kb-assets/whatsapp/api-keys/01-initial-empty-state.png)

---

### Langkah 2: Generate API Key
1. Klik tombol **"Generate API key"**.
2. Sistem akan langsung memproses dan menampilkan kartu **One-time API secret**.
3. Klik tombol **"Copy secret"** untuk menyalin token ke password manager atau vault konfigurasi backend Anda.

![API Key Berhasil Dibuat](/kb-assets/whatsapp/api-keys/02-key-generated-with-secret.png)

> ⚠️ **Penting:**
> Setelah Anda berpindah halaman atau me-refresh browser, token secret tidak dapat ditampilkan kembali. Jika Anda kehilangan token, Anda harus melakukan rotasi key.

---

## 3. Pengelolaan Siklus Hidup Key (Lifecycle)

### Melakukan Rotasi API Key (Rotate)
Jika token API key Anda diduga bocor atau kebijakan keamanan mengharuskan penggantian berkala:
1. Klik tombol **"Rotate API key"**.
2. Perhatikan dialog konfirmasi: **Key saat ini akan langsung berhenti berfungsi dan tidak dapat digunakan lagi**.
3. Konfirmasi rotasi untuk menerbitkan API key baru dan mendapatkan token secret baru.

![Dialog Konfirmasi Rotasi API Key](/kb-assets/whatsapp/api-keys/03-rotate-key-dialog.png)

---

### Mencabut API Key (Revoke)
Untuk mematikan seluruh akses integrasi API seketika tanpa menerbitkan key baru:
1. Klik tombol **"Revoke API key"**.
2. Konfirmasi pada dialog pencabutan.
3. Status key akan berubah menjadi **Revoked**, dan seluruh panggilan API menggunakan key tersebut akan menerima respon `401 Unauthorized`.

![Dialog Konfirmasi Pencabutan API Key](/kb-assets/whatsapp/api-keys/04-revoke-key-dialog.png)

---

## 4. Otentikasi Panggilan API

Sertakan API key Anda pada header standar `Authorization: Bearer <API_KEY>` atau header `x-api-key`.

### Contoh: Mengirim WhatsApp Template Message via cURL

```bash
curl -X POST "https://api.pfnapp.my.id/api/whatsapp/messages" \
  -H "Authorization: Bearer pfn_wa_sec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+6281234567890",
    "type": "template",
    "template": {
      "name": "order_notification",
      "language": {
        "code": "id"
      },
      "components": [
        {
          "type": "body",
          "parameters": [
            { "type": "text", "text": "Budi" },
            { "type": "text", "text": "INV-20260820-001" }
          ]
        }
      ]
    }
  }'
```

### Contoh: Integrasi Node.js / TypeScript

```typescript
const API_KEY = process.env.WHATSAPP_ORG_API_KEY!
const BASE_URL = "https://api.pfnapp.my.id"

async function sendWhatsAppMessage(to: string, templateName: string) {
  const response = await fetch(`${BASE_URL}/api/whatsapp/messages`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: "id" },
      },
    }),
  })

  if (!response.ok) {
    const errorBody = await response.json()
    throw new Error(`API Error [${response.status}]: ${JSON.stringify(errorBody)}`)
  }

  return response.json()
}
```

---

## 5. Audit & Kepatuhan Keamanan

Seluruh aktivitas siklus hidup API key dicatat pada audit log yang tidak dapat diubah (immutable):
- `ORGANIZATION_API_KEY_GENERATED`
- `ORGANIZATION_API_KEY_ROTATED`
- `ORGANIZATION_API_KEY_REVOKED`

Administrator organisasi dapat meninjau log aktivitas dan data fingerprint melalui tab **Audit Logs** di management console.
