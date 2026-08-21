---
path: /whatsapp/api-keys
locale: id
title: Pengelolaan WhatsApp API Key
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

Panduan ini menjelaskan cara membuat, melakukan rotasi, dan menggunakan
WhatsApp API key organisasi Anda secara aman untuk mengintegrasikan layanan
## 1. Apa itu WhatsApp API Key?

WhatsApp API Key adalah **token rahasia** (seperti kata sandi) yang digunakan oleh aplikasi backend, server, atau skrip Anda untuk mengirim pesan WhatsApp secara aman.

### Aturan Keamanan Utama:
- **Hanya Ditampilkan Sekali**: Saat membuat atau merotasi key, token rahasia hanya diperlihatkan satu kali. Segera simpan di password manager atau file konfigurasi server (`.env`).
- **Satu Key Aktif**: Setiap organisasi memiliki 1 API key aktif dalam satu waktu.
- **Aman untuk Audit**: Prefix key (contoh: `wa_key_...`) aman dibagikan ke tim tanpa membocorkan rahasia token sebenarnya.
  Rotated, Revoked, Last Used) dapat dibagikan dengan aman untuk kebutuhan
  audit log tanpa membocorkan token rahasia.

---

## 2. Membuat API Key Baru

### Langkah 1: Buka Menu WhatsApp API Key di Console

Arahkan ke **Console** > **WhatsApp** > **API Key**
(`/console/whatsapp/api-keys`).

Jika organisasi Anda belum memiliki API key yang aktif, lencana status akan
menampilkan **Not generated**.

![Status Awal Belum Dibuat](/kb-assets/whatsapp/api-keys/01-initial-empty-state.png)

---

### Langkah 2: Generate API Key

1. Klik tombol **"Generate API key"**.
2. Sistem akan langsung memproses dan menampilkan kartu **One-time API
   secret**.
3. Klik tombol **"Copy secret"** untuk menyalin token ke password manager atau
   vault konfigurasi backend Anda.

![API Key Berhasil Dibuat](/kb-assets/whatsapp/api-keys/02-key-generated-with-secret.png)

> ⚠️ **Penting:**
> Setelah Anda berpindah halaman atau me-refresh browser, token secret tidak
> dapat ditampilkan kembali. Jika Anda kehilangan token, Anda harus melakukan
> rotasi key.

---

## 3. Pengelolaan Siklus Hidup Key (Lifecycle)

### Melakukan Rotasi API Key (Rotate)

Jika token API key Anda diduga bocor atau kebijakan keamanan mengharuskan
penggantian berkala:

1. Klik tombol **"Rotate API key"**.
2. Perhatikan dialog konfirmasi: **Key saat ini akan langsung berhenti
   berfungsi dan tidak dapat digunakan lagi**.
3. Konfirmasi rotasi untuk menerbitkan API key baru dan mendapatkan token
   secret baru.

![Dialog Konfirmasi Rotasi API Key](/kb-assets/whatsapp/api-keys/03-rotate-key-dialog.png)

---

### Mencabut API Key (Revoke)

Untuk mematikan seluruh akses integrasi API seketika tanpa menerbitkan key
baru:

1. Klik tombol **"Revoke API key"**.
2. Konfirmasi pada dialog pencabutan.
3. Status key akan berubah menjadi **Revoked**, dan seluruh panggilan API
   menggunakan key tersebut akan menerima respon `401 Unauthorized`.

![Dialog Konfirmasi Pencabutan API Key](/kb-assets/whatsapp/api-keys/04-revoke-key-dialog.png)

---

## 4. Otentikasi Panggilan API

Sertakan API key Anda pada header standar `Authorization: Bearer <API_KEY>`
atau header `x-api-key`.

### Contoh: Memeriksa Status Perangkat WhatsApp (Device Check)

Lakukan verifikasi API key dan periksa status koneksi nomor WhatsApp
terdaftar:

```bash
curl -X GET "https://api.pfnapp.my.id/api/whatsapp/devices/" \
  -H "Authorization: Bearer pfn_wa_sec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

### Spesifikasi OpenAPI & Referensi SDK

Untuk rincian skema request/response, parameter filter, kode status error, dan
SDK generator untuk berbagai bahasa pemrograman (TypeScript, Python, Go, Java,
dll.), silakan kunjungi dokumentasi interaktif OpenAPI:

- [Referensi OpenAPI WhatsApp Devices](/api/openapi#tag/whatsapp-devices/GET/api/whatsapp/devices/)

---

## 5. Audit & Kepatuhan Keamanan

Seluruh aktivitas siklus hidup API key dicatat pada audit log yang tidak dapat
diubah (immutable):

- `ORGANIZATION_API_KEY_GENERATED`
- `ORGANIZATION_API_KEY_ROTATED`
- `ORGANIZATION_API_KEY_REVOKED`

Administrator organisasi dapat meninjau log aktivitas dan data fingerprint
melalui tab **Audit Logs** di management console.
