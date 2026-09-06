---
path: /whatsapp/templates
locale: id
title: Panduan Template Pesan & Persetujuan Meta
category: WhatsApp
purpose: Panduan ramah pemula untuk merancang, mendaftarkan, dan mengelola template pesan WhatsApp yang disetujui Meta, serta menggunakan Ask P AI Copilot untuk mencegah penolakan kategori.
howTo:
  - "Buat dan daftarkan template WhatsApp dengan mudah melalui template builder interaktif."
  - "Pahami kategori template (Utility, Authentication, Marketing) dengan pratinjau balon chat."
  - "Gunakan 'Ask P' AI Copilot untuk audit kepatuhan kebijakan sebelum template diajukan ke Meta."
  - "Sinkronkan template yang disetujui langsung dari Meta Graph API ke database lokal Anda."
notes:
  - "Seluruh pesan WhatsApp bisnis keluar (outbound notification) wajib menggunakan template yang telah disetujui Meta."
  - "Template Utility murni untuk pesan transaksi tanpa kata promosi atau tautan penawaran."
  - "Pesan Marketing memiliki tarif yang lebih tinggi dibanding pesan Utility atau Authentication."
  - "Ask P AI Copilot memberikan asistensi langsung di halaman untuk menjawab pertanyaan perubahan kategori Meta."
---

# Panduan Template Pesan & Persetujuan Meta

Template Pesan WhatsApp memungkinkan bisnis mengirimkan notifikasi proaktif, pembaruan pesanan, kode verifikasi OTP, dan pesan promosi kepada pelanggan. Demi kenyamanan pengguna WhatsApp, **seluruh template wajib disetujui oleh Meta** sebelum dapat dikirimkan.

![Dasbor Template Pesan WhatsApp](/kb-assets/whatsapp/templates/01-templates-list.png)

---

## 1. Dasbor Manajemen Template

Buka menu **Console** > **WhatsApp** > **Templates** (`/id/console/whatsapp/templates`).

Dasbor ini memberikan visibilitas penuh terhadap seluruh template organisasi Anda:
- **Status Sinkronisasi Meta**: Menampilkan persentase sinkronisasi (contoh: `20 / 20 100% Synced to Meta`).
- **Rincian Kategori**: Ringkasan jumlah template aktif untuk **⚡ Utility** (1.0x), **🔑 Authentication** (1.5x), dan **📢 Marketing** (2.0x).
- **Pencarian & Filter**: Cari nama template atau filter berdasarkan status persetujuan (**Approved**, **Pending**, **Rejected**) dan kategori.
- **Tarik dari Meta (Sync)**: Mengambil status persetujuan dan terjemahan bahasa terbaru langsung dari Meta Graph API.
- **Buat Template (Create Template)**: Membuka perancang template interaktif.

---

## 2. Template Builder Interaktif

Klik tombol **"Create Template"** (`/id/console/whatsapp/templates/new`) untuk merancang template baru.

![Perancang Template WhatsApp](/kb-assets/whatsapp/templates/02-create-template-builder.png)

### Bagian Konfigurasi:
1. **Konfigurasi Umum (General Configuration)**:
   - **Perangkat WhatsApp**: Pilih nomor WhatsApp pengirim yang terhubung.
   - **Nama & Slug Template**: Nama tampilan dan kode unik huruf kecil (contoh: `konfirmasi_pesanan_pelanggan`).
   - **Kategori**: Pilih `Utility`, `Authentication`, atau `Marketing`.
   - **Bahasa**: Tentukan bahasa pesan (contoh: `🇮🇩 Indonesian (id)`, `🇺🇸 English (en-US)`).
2. **Header (Opsional)**:
   - Pilih tipe media: **None**, **TEXT**, **IMAGE**, **VIDEO**, atau **DOCUMENT**.
3. **Isi Pesan & Placeholder Variabel (Body Text)**:
   - Toolbar format teks: **Tebal** (`*teks*`), _Miring_ (`_teks_`), ~Coret~ (`~teks~`), dan Monospace (`` `kode` ``).
   - **Penyisipan Variabel**: Klik tombol **Variable** untuk memasukkan placeholder otomatis (`{{1}}`, `{{2}}`).
   - Penghitung karakter real-time (maksimal 1024 karakter).
4. **Footer (Opsional)**:
   - Teks catatan kaki kecil (maksimal 60 karakter).
5. **Tombol Interaktif (Maksimal 3)**:
   - Tambahkan tombol balasan cepat (**Quick Reply**), tautan web (**URL CTA**), atau panggilan telepon (**Phone**).
6. **Panel Pratinjau Live**:
   - Tinjau tampilan pesan dalam bentuk balon chat (**Bubble**) atau konfigurasi JSON mentah (**Config JSON**).

---

## 3. "Ask P" AI Copilot: Audit Sebelum Submit

PFNApp dilengkapi asisten AI kontekstual bernama **Ask P** untuk membantu Anda terhindar dari penolakan Meta atau penurunan kategori pesan.

Klik tombol **"Ask P"** di sudut kanan atas halaman untuk membuka panel asistensi:

![Asisten Ask P AI Copilot](/kb-assets/whatsapp/templates/03-ask-p-template-copilot.png)

### Kemampuan Ask P:
- **Pra-Audit Kebijakan Template**: Memeriksa draf teks dari kata-kata promosi tersembunyi (seperti *"diskon"*, *"promo"*, *"terbatas"*) yang berisiko membuat Meta menolak template Utility atau mengubahnya menjadi Marketing.
- **Rekomendasi Cepat**: Menjawab pertanyaan lazim seperti *"Mengapa Meta mengubah kategori template saya dari Utility ke Marketing?"* dan *"Bagaimana format OTP yang aman dari penolakan Meta?"*.
- **Tautan Panduan Terkait**: Menghubungkan langsung ke panduan teknis tanpa perlu meninggalkan halaman pembuatan template.

---

## 4. Ringkasan Kategori & Kebijakan Meta

| Kategori | Pengali Kuota | Contoh Penggunaan | Aturan Baku |
| :--- | :--- | :--- | :--- |
| **`UTILITY`** | **1.0x** | Bukti transaksi, resi paket, pengingat tagihan, jadwal janji temu | Bebas dari segala bentuk kata promosi, kupon, atau upsell. |
| **`AUTHENTICATION`** | **1.5x** | Kode One-Time Password (OTP) & verifikasi 2FA | Khusus kode keamanan. Wajib ada CTA salin kode atau disclaimer. |
| **`MARKETING`** | **2.0x** | Promosi produk, voucher diskon, pesan selamat datang | Mendukung gambar, video, emoji, dan link penawaran menarik. |

> ⚠️ **Aturan Konten Campuran (Mixed Content)**: Jika sebuah pesan berisi 90% bukti pembayaran tetapi menyelipkan 10% ajakan belanja lagi, Meta akan **mengklasifikasikan seluruh pesan sebagai MARKETING**.
