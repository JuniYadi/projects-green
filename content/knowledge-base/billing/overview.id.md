---
path: /billing
locale: id
title: Penagihan & Saldo Console
category: Billing
purpose: Kelola saldo organisasi, lihat estimasi biaya, pantau invoice, dan kelola langganan layanan di Console Penagihan.
howTo:
  - "Buka Console > Penagihan (/console/billing)."
  - "Pantau ringkasan Saldo Organisasi, Invoice Berikutnya, dan Estimasi Bulanan."
  - "Gunakan tombol Isi Saldo untuk menambah dana deposit organisasi."
  - "Tinjau riwayat transaksi, invoice terbaru, dan unduh berkas PDF invoice."
notes:
  - Saldo organisasi digunakan untuk pemotongan biaya layanan otomatis dan pay-as-you-go.
  - Invoice berstatus DRAFT atau UNPAID dapat dibayar menggunakan saldo atau kanal pembayaran gateway yang tersedia.
  - Riwayat invoice menyediakan dokumen PDF resmi yang dapat diunduh langsung untuk kebutuhan pelaporan keuangan.
---

Panduan ini menjelaskan cara memantau status penagihan, mengelola saldo organisasi, melihat estimasi biaya bulanan, serta mengelola invoice dan langganan aktif melalui Console Penagihan.

---

## 1. Ikhtisar Dasbor Penagihan

Dasbor Penagihan memberikan visibilitas penuh terhadap kondisi finansial akun organisasi Anda dalam satu tampilan terpadu.

Akses menu ini melalui **Console** > **Billing** (`/id/console/billing` atau `/en/console/billing`).

![Dasbor Penagihan Console](/kb-assets/billing/01-billing-overview-id.png)

### Metrik Utama Dasbor:

1. **Saldo (Balance)**: Total dana deposit aktif yang tersedia untuk membayar penggunaan layanan, kuota, atau pembaruan langganan otomatis.
2. **Invoice Berikutnya (Next Billing Date)**: Tanggal jatuh tempo perpanjangan siklus langganan aktif terdekat.
3. **Estimasi Bulanan (Estimated Monthly Cost)**: Proyeksi pengeluaran bulanan rata-rata berdasarkan riwayat penagihan dan beban layanan aktif.
4. **Biaya & Penggunaan Khusus (misal: WhatsApp)**: Akses cepat ke halaman analitik pengeluaran dan kuota per produk spesifik.

---

## 2. Mengisi Saldo Organisasi (Top-Up)

Untuk memastikan kelancaran layanan dan mencegah pemutusan akses akibat kekurangan dana, Anda dapat melakukan pengisian saldo sewaktu-waktu.

### Langkah-Langkah Top-Up Saldo:

1. Dari dasbor penagihan, klik tombol **"Isi Saldo"** (atau buka menu `/console/billing/topup`).
2. Pilih nominal saldo yang diinginkan atau masukkan nominal kustom (minimum pembayaran berlaku sesuai mata uang IDR/USD).
3. Pilih metode pembayaran yang diinginkan (Transfer Bank / Virtual Account / QRIS / Kartu Kredit).
4. Selesaikan pembayaran sebelum batas waktu berakhir. Saldo organisasi akan terupdate secara instan begitu pembayaran terkonfirmasi.

![Halaman Pengisian Saldo](/kb-assets/billing/02-billing-topup.png)

---

## 3. Manajemen Invoice & Pembayaran

Seluruh tagihan layanan yang diterbitkan sistem dicatat secara transparan di tabel **Invoice Terbaru**.

![Daftar Riwayat Invoice](/kb-assets/billing/03-billing-invoices-list.png)

### Status Invoice:

- **PAID**: Tagihan telah berhasil diselesaikan dan dicatat lunas.
- **UNPAID / PENDING**: Menunggu pembayaran dari pengguna sebelum tanggal jatuh tempo.
- **DRAFT**: Tagihan dalam tahap persiapan siklus penagihan sebelum finalisasi.
- **VOID / CANCELLED**: Tagihan yang dibatalkan atau disesuaikan.

### Mengunduh Berkas PDF Invoice:

Pada kolom tindakan di setiap baris invoice, klik tombol **"Download PDF"** untuk mengunduh bukti tanda terima atau faktur tagihan resmi yang sah untuk keperluan pembukuan akuntansi organisasi Anda.

---

## 4. Manajemen Langganan Layanan (Subscriptions)

Menu Langganan menampilkan seluruh layanan aktif (seperti App Hosting, WhatsApp Cloud Services, VPN, dsb.) yang terhubung ke organisasi Anda.

![Manajemen Langganan](/kb-assets/billing/04-billing-subscriptions.png)

- **Tier & Paket Aktif**: Informasi detail paket komputasi atau kuota yang sedang berjalan.
- **Siklus Pembaruan**: Tanggal perpanjangan otomatis (_renewal date_) dan status auto-debit dari saldo organisasi.
- **Upgrade / Downgrade**: Penyesuaian paket layanan dapat dilakukan langsung dengan perhitungan prorata otomatis.

---

## 5. Navigasi Cepat Menu Penagihan

Gunakan bilah menu di bagian atas dasbor untuk berpindah ke fitur penagihan lainnya:

- **Penggunaan (Usage)**: Lacak rincian konsumsi sumber daya dan breakdown biaya per layanan.
- **Peringatan (Alerts)**: Atur ambang batas peringatan (_threshold alerts_) saat saldo menipis agar notifikasi dikirimkan otomatis.
- **Transaksi (Transactions)**: Riwayat debit/kredit saldo yang mendetail dari setiap aktivitas layanan.
- **Vouchers**: Klaim dan terapkan kode promo atau diskon komersial untuk potongan tagihan.
- **Contacts**: Kelola daftar penerima email untuk notifikasi faktur dan invoice organisasi.
- **Settings**: Konfigurasi mata uang default, informasi legal perusahaan, dan data NPWP/pajak penagihan.
