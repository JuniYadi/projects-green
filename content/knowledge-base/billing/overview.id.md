---
path: /billing
locale: id
title: Penagihan & Manajemen Saldo Console
category: Billing
purpose: Kelola saldo deposit organisasi, pantau langganan layanan cloud berulang, periksa faktur tagihan terkini, dan akses modul keuangan.
howTo:
  - "Buka menu Console > Billing (/id/console/billing)."
  - "Tinjau Saldo Organisasi, Tanggal Tagihan Berikutnya, dan Estimasi Biaya Bulanan."
  - "Klik Top Up Saldo untuk mengisi dana deposit organisasi."
  - "Periksa langganan layanan aktif, riwayat faktur tagihan, dan unduh faktur PDF resmi."
  - "Akses modul keuangan khusus: Langganan, Faktur, Transaksi, Penggunaan, Peringatan, Voucher, Kontak, dan Pengaturan."
notes:
  - "Saldo deposit organisasi digunakan untuk autodebet perpanjangan paket dan biaya layanan pay-as-you-go."
  - "Faktur dengan status Open dapat dilunasi menggunakan saldo deposit atau payment gateway."
  - "Faktur PDF resmi diterbitkan di bawah badan hukum PT. Premium Fast Network."
---

# Penagihan & Manajemen Saldo Console

Menu **Penagihan (Billing)** menyediakan visibilitas terpadu terhadap likuiditas finansial organisasi, paket langganan berulang, riwayat faktur, dan pengeluaran sumber daya cloud.

Akses menu ini melalui **Console** > **Billing** (`/id/console/billing` atau `/en/console/billing`).

![Dasbor Penagihan Console](/kb-assets/billing/01-billing-overview-id.png)

---

## 1. Metrik Utama Dasbor Penagihan

1. **Saldo Organisasi (Organization Balance)**: Total saldo deposit cair yang siap digunakan untuk autodebet perpanjangan otomatis dan biaya Pay-As-You-Go (contoh: `IDR 14.312.580,66`). Klik **Lihat Mutasi →** untuk melihat rekening koran saldo real-time.
2. **Tanggal Faktur Berikutnya (Next Invoice Date)**: Jadwal tanggal perpanjangan paket aktif terdekat.
3. **Estimasi Biaya Bulanan (Estimated Monthly Cost)**: Proyeksi rata-rata pengeluaran bulanan berdasarkan faktur sebelumnya dan paket aktif.
4. **Biaya & Penggunaan WhatsApp**: Tautan cepat ke analitik konsumsi kuota per perangkat.

---

## 2. Pengisian Saldo Deposit (Top-Up)

Untuk memastikan kelancaran operasional dan mencegah penghentian layanan karena saldo tidak mencukupi, Anda dapat melakukan top up saldo kapan saja.

1. Pada dasbor penagihan, klik tombol **"Isi Saldo" / "Top Up Balance"** (atau buka `/id/console/billing/topup`).
2. Pilih nominal saldo preset (contoh: `Rp 180.000`, `Rp 450.000`, `Rp 4.500.000`) atau masukkan nominal kustom (minimal `Rp 50.000`).
3. Pilih metode pembayaran yang diinginkan (Transfer Bank Manual, Virtual Account, atau QRIS).
4. Selesaikan pembayaran sebelum batas waktu kedaluwarsa. Saldo deposit akan langsung masuk seketika setelah pembayaran terverifikasi.

![Halaman Top Up Saldo](/kb-assets/billing/02-billing-topup.png)

---

## 3. Langganan Layanan Aktif (Subscriptions)

Bagian Langganan menampilkan seluruh layanan cloud berulang (seperti WhatsApp Business Cloud, App Hosting, VPN, dll.) yang terhubung ke organisasi Anda.

![Daftar Langganan Layanan](/kb-assets/billing/subscriptions/01-subscriptions-list.png)

- **Paket & Tier Aktif**: Konfigurasi spesifikasi dan jatah kuota layanan yang sedang berjalan.
- **Siklus Perpanjangan**: Jadwal tanggal perpanjangan dan status autodebet otomatis.
- **Panduan Lengkap**: Pelajari panduan khusus kami di [**Panduan Layanan Langganan**](/docs/billing/subscriptions) untuk melihat data pesanan pendaftaran dan pembatalan perpanjangan otomatis.

---

## 4. Manajemen Faktur & Bukti Pajak (Invoices)

Seluruh faktur layanan dan bukti isi saldo dicatat secara transparan pada tabel **Invoice Terbaru**:

![Daftar Riwayat Faktur](/kb-assets/billing/invoices/01-invoices-management.png)

- **Nomor Faktur**: Kode resmi dokumen (`INV-*` untuk langganan layanan, `TOP-*` untuk isi saldo).
- **Status Pembayaran**: `Paid` (Lunas), `Open` (Menunggu Pembayaran), atau `Void` (Batal).
- **Unduh PDF**: Ekspor instan dokumen faktur resmi yang diterbitkan oleh **PT. Premium Fast Network**.
- **Panduan Lengkap**: Pelajari panduan khusus kami di [**Panduan Faktur & Riwayat Tagihan**](/docs/billing/invoices) untuk melihat rincian item layanan (line items) dan faktur pajak korporasi.

---

## 5. Menu Navigasi Modul Penagihan

Akses menu keuangan lengkap melalui bilah tab atas:
- [**Langganan (Subscriptions)**](/docs/billing/subscriptions): Kelola paket layanan berulang, jadwal perpanjangan, dan status langganan.
- [**Faktur (Invoices)**](/docs/billing/invoices): Cari arsip riwayat tagihan dan unduh berkas PDF resmi.
- [**Transaksi (Transactions)**](/docs/billing/transactions): Laporan rekening koran mutasi saldo yang melacak seluruh dana masuk dan keluar.
- [**Penggunaan (Usage)**](/docs/billing/usage): Rincian konsumsi sumber daya dan grafik per layanan.
- [**Peringatan (Alerts)**](/docs/billing/alerts): Konfigurasi batas saldo minimum untuk notifikasi peringatan otomatis.
- [**Voucher**](/docs/billing/vouchers): Klaim dan gunakan kupon promo serta diskon komersial.
- [**Kontak (Contacts)**](/docs/billing/contacts): Daftarkan alamat email penerima notifikasi penagihan.
- [**Pengaturan (Settings)**](/docs/billing/settings): Atur mata uang akun, identitas legal perusahaan, dan NPWP.
