---
path: /whatsapp
locale: id
title: Ikhtisar WhatsApp & Manajemen Perangkat Terhubung
category: WhatsApp
purpose: Gambaran umum platform WhatsApp Business, dasbor metrik, kesehatan perangkat, pengelolaan profil resmi Meta, dan pemantauan percakapan.
howTo:
  - "Buka menu Console > WhatsApp > Dashboard (/id/console/whatsapp/dashboard)."
  - "Pantau koneksi perangkat aktif, volume percakapan, metrik pengiriman pesan, dan umpan obrolan langsung."
  - "Kelola perangkat WhatsApp terverifikasi, profil bisnis resmi Meta, dan limit pesan harian (/id/console/whatsapp/devices)."
  - "Jelajahi modul terbaru: Analitik & Rekonsiliasi, Visual Bot Workflows, Template & Ask P Copilot, Log Interaktif, dan Kalkulator Harga."
notes:
  - "Statistik dasbor mencerminkan perangkat aktif real-time dan pemrosesan pesan di seluruh organisasi Anda."
  - "Dukungan multi-perangkat memungkinkan penautan beberapa nomor telepon bisnis dalam satu akun organisasi."
  - "Profil bisnis resmi menyinkronkan nama tampilan terverifikasi, logo, situs web, dan kategori bisnis langsung dari Meta."
---

# Ikhtisar WhatsApp & Manajemen Perangkat Terhubung

Konsol **WhatsApp** berfungsi sebagai pusat kendali terpadu untuk operasional pesan WhatsApp, koneksi perangkat bisnis, alur otomasi AI, serta analitik percakapan organisasi Anda.

![Dasbor WhatsApp](/kb-assets/whatsapp/guides/01-whatsapp-dashboard.png)

---

## 1. Kartu Status & Metrik Utama

Dasbor menyajikan indikator kesehatan operasional secara seketika:

- **Perangkat Aktif (Active Devices)**: Total nomor WhatsApp bisnis yang terhubung dan siap mengirim serta menerima pesan.
- **Total Percakapan (Total Conversations)**: Jumlah percakapan unik pelanggan yang telah ditangani.
- **Pesan Terkirim (Messages Sent)**: Jumlah pesan keluar yang berhasil terkirim pada periode berjalan.
- **Kesehatan Perangkat (Device Health)**: Stabilitas koneksi socket real-time dan pemantauan heartbeat ke Meta Cloud API.

---

## 2. Manajemen Perangkat Terhubung & Profil Resmi Meta

Buka menu **Console** > **WhatsApp** > **Devices** (`/id/console/whatsapp/devices`) dan klik perangkat aktif untuk melihat halaman manajemen detail:

![Detail Perangkat WhatsApp Terhubung](/kb-assets/whatsapp/guides/10-menu-devices-detail.png)

### Parameter Utama Perangkat:
1. **Profil Resmi WhatsApp Business**: Pratinjau tersinkronisasi dari profil bisnis Meta terverifikasi, mencakup foto profil, status nama tampilan (**Approved**), kategori bisnis, email bantuan, dan tautan web resmi.
2. **Pengukur Konsumsi Kuota (Quota Gauge)**: Penghitung kuota pesan terpakai dibandingkan kuota dasar (contoh: `10.5 / 1.000` dengan info sisa pesan aktif).
3. **Limit Pengiriman Harian (Daily Limit)**: Batas kecepatan pengiriman pesan harian sesuai tier nomor Meta (contoh: `1.000 msgs / day` hingga unlimited).
4. **Riwayat & Sinkronisasi**: Catatan tanggal registrasi nomor dan tombol satu-klik sinkronisasi ulang profil langsung dari Meta Graph API.

---

## 3. Panduan Modul & Fitur Terbaru

Pelajari dokumentasi lengkap untuk setiap modul yang telah ditingkatkan:

- [**Visual Canvas & Workflow Bot AI**](/docs/whatsapp/workflows): Rancang alur chatbot multi-langkah dengan prompt input, integrasi API katalog langsung, jawaban generatif LLM, dan simulator chat interaktif.
- [**Template Pesan & Asisten "Ask P" AI Copilot**](/docs/whatsapp/templates): Buat template pesan WhatsApp terverifikasi dan gunakan asisten Ask P untuk mencegah penolakan kategori dari Meta.
- [**Log WhatsApp, Webhook & Riwayat Pesan (Message Journey)**](/docs/whatsapp/webhooks-and-audits): Investigasi bukti pengiriman dengan tombol salin cepat WhatsApp Message ID (wamid) dan visualisasi linimasa riwayat pesan end-to-end.
- [**Tarif WhatsApp, Harga & Ledger Transaksi**](/docs/whatsapp/pricing): Simulasikan estimasi biaya bulanan menggunakan kalkulator interaktif dan audit pemotongan kredit kuota pesan secara transparan.
