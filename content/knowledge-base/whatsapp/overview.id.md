---
path: /whatsapp/overview
locale: id
title: Panduan Lengkap Console WhatsApp, Alur Kerja & Integrasi API
category: WhatsApp
purpose: Panduan menyeluruh navigasi menu sidebar WhatsApp Console, pembuatan template, pengiriman pesan, pelacakan siklus pesan, dan integrasi REST API.
howTo:
  - "Gunakan menu sidebar WhatsApp Console (Dashboard, API Keys, Templates, Messages, Devices, Webhook Logs, Audit Logs)."
  - "Ikuti Journey 1: Buat Template > Kirim Pesan > Pantau Pengiriman & Webhook Logs."
  - "Ikuti Journey 2: Generate API Key > Buka Spesifikasi OpenAPI > Pilih Contoh Kode > Uji Coba Panggilan API."
notes:
  - Template pesan harus disinkronkan dan disetujui oleh Meta sebelum dapat dikirimkan ke pengguna.
  - Token API Key secret hanya ditampilkan satu kali pada saat pembuatan atau rotasi.
  - Webhook Logs dan Audit Logs mencatat audit pengiriman serta penyesuaian saldo secara immutable.
---

# Panduan Lengkap Console WhatsApp, Alur Kerja & Integrasi API

Dokumentasi ini menyajikan panduan lengkap pengelolaan pesan bisnis WhatsApp melalui Console PFNApp, mencakup seluruh menu navigasi pada sidebar serta dua alur utama (*journey*):
1. **Business Workflow Journey**: Buat Template $\rightarrow$ Kirim Pesan $\rightarrow$ Pantau Status Pengiriman & Webhook.
2. **Developer & Integration Journey**: Buat API Key $\rightarrow$ Pelajari Spesifikasi OpenAPI $\rightarrow$ Pilih Contoh Bahasa Pemrograman $\rightarrow$ Uji Panggilan API.

---

## 1. Ikhtisar Navigasi Menu Sidebar WhatsApp Console

Sidebar WhatsApp Console menyediakan kontrol penuh atas operasional kanal perpesanan, keamanan API, dan metrik penagihan.

![Dasbor WhatsApp](/kb-assets/whatsapp/guides/01-whatsapp-dashboard.png)

### Ringkasan Menu Sidebar

| Menu | Path | Fungsi & Cakupan |
| :--- | :--- | :--- |
| **Dashboard** | `/console/whatsapp/dashboard` | Ringkasan perangkat aktif, status koneksi, total percakapan, dan riwayat obrolan terkini. |
| **API Keys** | `/console/whatsapp/api-keys` | Pengelolaan static API key tingkat organisasi untuk autentikasi backend, rotasi, dan pencabutan akses. |
| **Usage** | `/console/whatsapp/usage` | Analitik volume pesan terkirim/diterima, konsumsi kuota, dan breakdown per kategori template. |
| **Ledger** | `/console/whatsapp/ledger` | Pembukuan transaksi pemotongan saldo pesan, pengembalian dana (*refund*), dan deposit kredit. |
| **Pricing** | `/console/whatsapp/pricing` | Daftar tarif biaya per kategori pesan (Marketing, Utility, Authentication, Service). |
| **Devices** | `/console/whatsapp/devices` | Pendaftaran nomor telepon WhatsApp, status koneksi, pairing QR code, dan token Meta Cloud. |
| **Templates** | `/console/whatsapp/templates` | Pembuatan, sinkronisasi, penyuntingan, dan preview template pesan yang disetujui Meta. |
| **Messages** | `/console/whatsapp/messages` | Komposer pesan interaktif, kotak masuk percakapan aktif, dan pengiriman pesan manual. |
| **Broadcasts** | `/console/whatsapp/broadcasts` | Kampanye pesan massal terjadwal atau instan ke daftar kontak dan segmen audiens. |
| **Contacts** | `/console/whatsapp/contacts` | Buku alamat kontak, atribut kustom, tag, dan manajemen segmentasi pelanggan. |
| **Catalogs** | `/console/whatsapp/catalogs` | Integrasi katalog produk e-commerce untuk pesan belanja dan produk interaktif. |
| **Webhook Logs** | `/console/whatsapp/webhook-logs` | Log pengiriman webhook masuk/keluar, status respons HTTP, payload, dan percobaan ulang (*retry*). |
| **Audit Logs** | `/console/whatsapp/audit-logs` | Jejak audit keamanan kepatuhan atas aktivitas pengguna, rotasi key, dan perubahan status. |
| **API Reference** | `/api/openapi` | Dokumentasi interaktif OpenAPI, pengujian request langsung, dan contoh kode multi-bahasa. |

---

## 2. Journey 1: Buat Template $\rightarrow$ Kirim Pesan $\rightarrow$ Lacak Pengiriman

Alur ini memandu tim operasional dan pemasaran untuk merancang template pesan baru, mengirimkannya ke penerima, serta melacak status pengiriman.

```mermaid
graph LR
    A[1. Buat Template] --> B[2. Review & Sinkronisasi Meta]
    B --> C[3. Kirim Pesan]
    C --> D[4. Lacak Status / Webhook]
```

---

### Langkah 1: Buat Template Pesan WhatsApp

1. Buka menu **Console** > **WhatsApp** > **Templates** (`/console/whatsapp/templates`).
2. Periksa daftar template yang sudah ada beserta status sinkronisasinya (`SYNCED`, `APPROVED`, `REJECTED`, atau `PENDING`).

![Daftar Template](/kb-assets/whatsapp/guides/02-journey1-templates-list.png)

3. Klik tombol **"Buat Template"** (atau **"Create Template"**) untuk membuka modal pembuatan template.
4. Lengkapi formulir template:
   - **Nama Template**: Identifier unik huruf kecil tanpa spasi (contoh: `notifikasi_status_pesanan`).
   - **Kategori**: Pilih `UTILITY`, `MARKETING`, atau `AUTHENTICATION`.
   - **Bahasa**: Pilih bahasa target (contoh: `Indonesian (id)`, `English (en-US)`).
   - **Header** *(Opsional)*: Teks, Gambar, Video, atau Dokumen.
   - **Body (Isi Pesan)**: Teks pesan dengan parameter variabel (contoh: `Halo {{1}}, pesanan Anda dengan nomor #{{2}} sedang dikirim!`).
   - **Footer & Tombol** *(Opsional)*: Tombol Balas Cepat (*Quick Reply*) atau *Call-to-Action* (Tautan URL / Nomor Telepon).

![Dialog Pembuatan Template](/kb-assets/whatsapp/guides/03-journey1-create-template-dialog.png)

5. Klik **Kirim / Submit**. Setelah Meta menyetujui template tersebut, klik tombol **"Sinkronisasi Template"** agar status terbaru masuk ke sistem.

---

### Langkah 2: Kirim Pesan Template

1. Buka menu **Console** > **WhatsApp** > **Messages** (`/console/whatsapp/messages`).
2. Pilih nomor pengirim WhatsApp yang berstatus terhubung (*Connected*) dari pemilih perangkat.
3. Pilih kontak tujuan atau masukkan nomor telepon penerima (contoh: `+6281234567890`).
4. Pilih template pesan yang telah disetujui dari dropdown template.
5. Isi nilai variabel dinamis yang dibutuhkan (`{{1}}`, `{{2}}`).
6. Klik **Kirim Pesan**.

![Kirim Pesan](/kb-assets/whatsapp/guides/04-journey1-send-message.png)

---

### Langkah 3: Pantau Pengiriman Pesan & Webhook Logs

Setiap pesan akan melewati siklus status: `PENDING` $\rightarrow$ `SENT` (Terkirim) $\rightarrow$ `DELIVERED` (Sampai) $\rightarrow$ `READ` (Dibaca) atau `FAILED` (Gagal).

1. **Webhook Logs (`/console/whatsapp/webhook-logs`)**:
   - Pantau callback status pengiriman pesan yang dikirimkan oleh Meta Cloud API secara real-time.
   - Periksa stempel waktu, status HTTP code, payload data, dan error jika pengiriman gagal.
   - Lakukan percobaan ulang (*retry*) jika endpoint server tujuan Anda sempat mengalami kendala jaringan.

![Log Webhook](/kb-assets/whatsapp/guides/05-journey1-webhook-logs.png)

2. **Audit Logs (`/console/whatsapp/audit-logs`)**:
   - Tinjau catatan audit sistem terkait pengguna yang memicu pengiriman pesan dan mutasi biaya saldo yang menyertainya.

![Log Audit](/kb-assets/whatsapp/guides/06-journey1-audit-logs.png)

---

## 3. Journey 2: API Key $\rightarrow$ OpenAPI $\rightarrow$ Pilih Contoh Kode $\rightarrow$ Panggilan API

Alur ini memandu pengembang software (*developers*) untuk melakukan integrasi backend secara terprogram menggunakan REST API.

```mermaid
graph LR
    A[1. Buat API Key] --> B[2. Buka Spesifikasi OpenAPI]
    B --> C[3. Pilih Bahasa Pemrograman]
    C --> D[4. Jalankan Panggilan API]
```

---

### Langkah 1: Buat API Key Organisasi

1. Buka menu **Console** > **WhatsApp** > **API Keys** (`/console/whatsapp/api-keys`).
2. Klik tombol **"Generate API key"**.
3. **Salin rahasia API key (secret) satu kali**. Secret dienkripsi menggunakan algoritma SHA-256 dan tidak akan dapat dilihat kembali setelah Anda meninggalkan halaman tersebut.

![Manajemen API Key](/kb-assets/whatsapp/guides/07-journey2-api-keys.png)

---

### Langkah 2: Buka Spesifikasi OpenAPI & Referensi Interaktif

1. Klik tautan **API Reference** pada sidebar navigasi atau buka langsung `/api/openapi`.
2. Jelajahi grup endpoint **WhatsApp**:
   - `POST /api/whatsapp/messages` — Mengirimkan pesan template, teks, media, atau pesan interaktif.
   - `GET /api/whatsapp/devices` — Mengambil daftar nomor WhatsApp pengirim yang terhubung.
   - `GET /api/whatsapp/templates` — Mengambil daftar template yang disetujui beserta parameternya.

![Referensi OpenAPI](/kb-assets/whatsapp/guides/08-journey2-openapi-reference.png)

---

### Langkah 3: Pilih Contoh Kode Bahasa Pemrograman

Gunakan antarmuka interaktif pada `/api/openapi` untuk beralih antara berbagai bahasa pemrograman populer (cURL, JavaScript / TypeScript, Python, Go, PHP).

![Contoh Kode OpenAPI](/kb-assets/whatsapp/guides/09-journey2-openapi-code-example.png)

---

### Langkah 4: Uji Coba Panggilan API

#### Contoh cURL

```bash
curl -X POST "https://pfnapp.my.id/api/whatsapp/messages" \
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

#### Contoh TypeScript / Node.js (fetch)

```typescript
const response = await fetch("https://pfnapp.my.id/api/whatsapp/messages", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${process.env.PFN_WHATSAPP_API_KEY}`,
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

const result = await response.json()
console.log("Hasil pengiriman pesan:", result)
```

#### Contoh Python

```python
import os
import requests

url = "https://pfnapp.my.id/api/whatsapp/messages"
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

response = requests.post(url, json=payload, headers=headers)
print("Status Code:", response.status_code)
print("Response:", response.json())
```

---

## 4. Menu Pengelolaan WhatsApp Console Lainnya

### Perangkat / Devices (`/console/whatsapp/devices`)
Kelola akun nomor WhatsApp bisnis, lakukan pairing via scan QR code, kelola token autentikasi Meta, dan pantau status koneksi socket real-time.

![Manajemen Perangkat](/kb-assets/whatsapp/guides/10-menu-devices.png)

---

### Pesan Siaran / Broadcasts (`/console/whatsapp/broadcasts`)
Rancang kampanye pesan siaran massal terjadwal atau instan, tentukan target kontak berdasarkan tag, dan pantau persentase keberhasilan pengiriman.

![Manajemen Pesan Siaran](/kb-assets/whatsapp/guides/11-menu-broadcasts.png)

---

### Kontak / Contacts (`/console/whatsapp/contacts`)
Kelola daftar kontak pelanggan, impor file kontak CSV, tambahkan tag khusus, dan kelola preferensi berhenti berlangganan (*opt-out*).

![Manajemen Kontak](/kb-assets/whatsapp/guides/12-menu-contacts.png)

---

### Katalog Produk / Catalogs (`/console/whatsapp/catalogs`)
Integrasikan katalog produk e-commerce dengan Meta Commerce Manager untuk mengirimkan pesan produk tunggal maupun multi-produk interaktif di dalam chat WhatsApp.

![Manajemen Katalog](/kb-assets/whatsapp/guides/13-menu-catalogs.png)

---

### Analitik Penggunaan / Usage (`/console/whatsapp/usage`)
Pantau statistik volume pesan harian, tren distribusi kategori pesan (Utility vs Marketing), dan batas pemakaian kuota organisasi Anda.

![Analitik Penggunaan](/kb-assets/whatsapp/guides/14-menu-usage.png)

---

### Buku Besar / Ledger (`/console/whatsapp/ledger`)
Audit mutasi saldo organisasi, rekonsiliasi pengembalian dana (*refund*) otomatis saat pesan gagal dikirim, dan rincian biaya langganan bulanan.

![Pembukuan Ledger](/kb-assets/whatsapp/guides/15-menu-ledger.png)

---

### Daftar Harga / Pricing (`/console/whatsapp/pricing`)
Lihat daftar tarif biaya resmi per negara tujuan dan kategori percakapan Meta WhatsApp.

![Daftar Harga](/kb-assets/whatsapp/guides/16-menu-pricing.png)
