---
path: /whatsapp/templates
locale: id
title: Panduan Template Pesan & Alur Persetujuan Meta
category: WhatsApp
purpose: Buat, konfigurasikan, pratinjau, dan sinkronkan template pesan WhatsApp yang disetujui oleh Meta.
howTo:
  - "Buka Console > WhatsApp > Templates (/console/whatsapp/templates)."
  - "Periksa status persetujuan template (APPROVED, PENDING, REJECTED)."
  - "Klik Buat Template untuk mengisi header, variabel body {{1}}, footer, dan tombol CTA."
  - "Klik Sinkronisasi Template untuk memperbarui status persetujuan dari Meta."
notes:
  - "Template pesan wajib disetujui Meta sebelum dapat dikirimkan ke nomor penerima di luar jendela layanan 24 jam."
  - "Nilai variabel dinamis ({{1}}, {{2}}) harus diisi dengan data valid saat pesan dikirim."
---

# Panduan Template Pesan & Alur Persetujuan Meta

Menu **Template** (`/console/whatsapp/templates`) memungkinkan bisnis untuk merancang, mengajukan, dan menyinkronkan template pesan WhatsApp untuk kebutuhan notifikasi transaksi, promosi, dan autentikasi.

![Daftar Template](/kb-assets/whatsapp/guides/02-journey1-templates-list.png)

---

## 1. Ikhtisar & Siklus Status Template

WhatsApp mewajibkan seluruh pesan keluar yang diinisiasi oleh bisnis di luar jendela layanan pelanggan 24 jam menggunakan template resmi yang telah disetujui Meta:

- **SYNCED / APPROVED**: Template telah disetujui Meta dan siap digunakan untuk pengiriman pesan.
- **PENDING**: Sedang dalam proses review oleh Meta.
- **REJECTED**: Ditolak oleh Meta karena tidak memenuhi panduan kebijakan pesan WhatsApp (misalnya salah memilih kategori).

---

## 2. Membuat Template Pesan Baru

1. Klik tombol **"Buat Template"** (atau **"Create Template"**) di atas tabel template.
2. Lengkapi formulir pembuatan template:
   - **Nama Template**: Identifier unik huruf kecil tanpa spasi (contoh: `notifikasi_pengiriman_pesanan`).
   - **Kategori**:
     - `UTILITY`: Notifikasi transaksi, konfirmasi tagihan, info akun.
     - `MARKETING`: Promosi, pengumuman promo, penawaran diskon.
     - `AUTHENTICATION`: Pengiriman kode OTP dan verifikasi akun.
   - **Bahasa**: Pilih kode bahasa (contoh: Indonesia `id`, Inggris `en_US`).
   - **Header** *(Opsional)*: Teks judul, gambar, video, atau dokumen PDF.
   - **Body (Isi Pesan)**: Teks utama dengan placeholder variabel (contoh: `Halo {{1}}, pesanan Anda dengan nomor #{{2}} telah dikirim!`).
   - **Footer & Tombol** *(Opsional)*: Tombol Balas Cepat (*Quick Reply*) atau tautan URL/Nomor Telepon (*Call-to-Action*).

![Dialog Pembuatan Template](/kb-assets/whatsapp/guides/03-journey1-create-template-dialog.png)

3. Klik **Submit** untuk mengirimkan pengajuan template ke Meta Cloud API.

---

## 3. Sinkronisasi Template

Gunakan tombol **"Sinkronisasi Template"** untuk menarik data status persetujuan terbaru dari Meta Cloud ke dalam sistem Console secara otomatis.
