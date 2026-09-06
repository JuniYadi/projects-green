---
path: /whatsapp/analytics
locale: id
title: Analitik WhatsApp & Rekonsiliasi Biaya
category: WhatsApp
purpose: Pantau metrik pesan Meta, bandingkan data pengiriman lokal dengan statistik Meta, serta lakukan rekonsiliasi biaya percakapan.
howTo:
  - "Buka menu Console > WhatsApp > Analitik (/id/console/whatsapp/analytics)."
  - "Pilih perangkat pengirim WhatsApp aktif dan rentang tanggal analisis."
  - "Klik 'Sync from Meta' untuk mengambil data analitik resmi dari Meta Graph API."
  - "Beralih antara tab 'Comparison' dan 'Cost Reconciliation' untuk memantau status percakapan berbayar."
  - "Klik 'Run Reconciliation' untuk mengaudit catatan ledger internal dengan tagihan resmi Meta."
notes:
  - "Sinkronisasi analitik membutuhkan nomor bisnis yang aktif terhubung ke WhatsApp Cloud API."
  - "Rekonsiliasi biaya mencocokkan kategori percakapan Meta (Marketing, Utility, Authentication, Service) dengan pemotongan kuota internal."
  - "Laporan dapat diekspor untuk audit keuangan bulanan dan perhitungan margin operasional."
---

# Analitik WhatsApp & Rekonsiliasi Biaya

Modul **Analitik WhatsApp** menghadirkan visibilitas menyeluruh antara data pengiriman pesan internal platform dengan laporan resmi penagihan Meta Graph API.

Akses menu ini melalui **Console** > **WhatsApp** > **Analitik** (`/id/console/whatsapp/analytics` atau `/en/console/whatsapp/analytics`).

![Ikhtisar Analitik WhatsApp](/kb-assets/whatsapp/analytics/01-whatsapp-analytics-overview.png)

---

## 1. Filter Perangkat & Rentang Tanggal

Gunakan panel kontrol atas untuk menyaring data:

1. **Pilihan Perangkat (Sender Device)**: Pilih nomor bisnis WhatsApp tertentu (contoh: `+6283138855774`) atau tinjau seluruh nomor organisasi sekaligus.
2. **Rentang Tanggal (Date Range)**: Tentukan tanggal mulai dan selesai atau pilih siklus bulanan untuk kebutuhan pembukuan.
3. **Sinkronisasi dari Meta (Sync from Meta)**: Melakukan sinkronisasi langsung dengan server Meta Cloud API untuk memverifikasi kategori percakapan dan status pengiriman final.

---

## 2. Tampilan Komparasi (Comparison)

Tab **Comparison** membandingkan volume pesan dari dua sumber data:
- **Catatan Lokal (Local Records)**: Pesan masuk dan keluar yang tercatat melalui API Key dan Webhook PFNApp.
- **Telemetri Resmi Meta (Meta-Reported Telemetry)**: Timestamp pengiriman dan status percakapan yang diakui oleh Meta Graph API.

Perbedaan status seperti keterlambatan konfirmasi jaringan atau pesan gagal dikirim akan ditandai secara transparan untuk mempermudah investigasi.

---

## 3. Rekonsiliasi Biaya & Ledger Transaksi

Klik tab **"Cost Reconciliation"** untuk masuk ke mode audit keuangan:

- **Jalankan Rekonsiliasi (Run Reconciliation)**: Mencocokkan setiap pesan yang terkirim dengan ledger transaksi organisasi.
- **Verifikasi Kategori Meta**: Memastikan apakah Meta menagihkan percakapan sebagai Utility, Authentication, Service, atau Marketing.
- **Analisis Biaya & Margin**: Memastikan pemotongan kuota atau saldo wallet sesuai dengan tier tarif aktif.
- **Pengecekan Pengembalian Otomatis (Refund)**: Memverifikasi bahwa pesan yang ditolak oleh Meta otomatis dikembalikan (revert) ke kuota atau saldo akun Anda.
