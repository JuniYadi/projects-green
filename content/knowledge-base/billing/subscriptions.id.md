---
path: /billing/subscriptions
locale: id
title: Layanan Langganan & Pengelolaan Paket Berulang
category: Billing
purpose: Kelola langganan layanan cloud berulang, periksa tanggal dan biaya perpanjangan paket, tinjau metadata pesanan, serta atur kebijakan perpanjangan otomatis.
howTo:
  - "Buka menu Console > Billing > Subscriptions (/id/console/billing/subscriptions)."
  - "Cari dan saring langganan berdasarkan produk (WhatsApp, App Hosting, VPN) dan status (Active, Expired, Cancelled)."
  - "Klik baris langganan untuk membuka halaman detail siklus hidup dan pengaturan perpanjangan."
  - "Tinjau tanggal jatuh tempo perpanjangan, biaya siklus rutin, dan aturan pemotongan saldo deposit organisasi."
  - "Atur siklus langganan termasuk opsi pembatalan perpanjangan otomatis."
notes:
  - "Langganan aktif akan diperpanjang secara otomatis pada tanggal jatuh tempo dengan memotong saldo organisasi."
  - "Membatalkan perpanjangan otomatis tetap mempertahankan layanan aktif 100% hingga akhir periode yang telah dibayar."
  - "Setiap langganan terhubung langsung ke konsol produk terkait (seperti Konsol WhatsApp, Profil VPN) dan invoice pesanan awal."
---

# Layanan Langganan & Pengelolaan Paket Berulang

Menu **Langganan (Subscriptions)** (`/console/billing/subscriptions`) mengelola seluruh layanan cloud berulang, paket kuota, dan tier platform yang aktif pada organisasi Anda.

![Dasbor Manajemen Langganan](/kb-assets/billing/subscriptions/01-subscriptions-list.png)

---

## 1. Tabel Ikhtisar Langganan

Buka menu **Console** > **Billing** > **Subscriptions** (`/id/console/billing/subscriptions`).

Tabel ini menampilkan seluruh layanan aktif dalam satu pandangan terpadu:

- **Produk & Paket (Product & Plan)**: Mengidentifikasi lini layanan (contoh: `WHATSAPP`, `VPN`, `APP_HOSTING`) dan tier paket tertentu (contoh: `PRIVATE`, `PRIVATESHARE`, `STANDARD`).
- **Lencana Status**:
  - `Active`: Layanan aktif beroperasi dengan perpanjangan otomatis menyala.
  - `Expiring / Expired`: Masa aktif paket telah berakhir atau perpanjangan dihentikan.
- **Siklus Tagihan (Term)**: Menampilkan jadwal penagihan paket secara **Bulanan (Monthly)**, **Triwulan (Quarterly)**, atau **Tahunan (Annual)**.
- **Tanggal Perpanjangan (Renewal Date)**: Tanggal jadwal penagihan berikutnya atau waktu berakhirnya layanan.
- **Status Invoice**: Bukti bahwa tagihan periode berjalan telah diselesaikan sepenuhnya (**PAID**).
- **Aksi Lanjutan (Next Action)**: Rekomendasi tindakan yang perlu dilakukan (seperti *No action needed* atau *Top up required*).

---

## 2. Detail Langganan & Pengaturan Perpanjangan

Klik baris langganan untuk masuk ke ruang kerja detail perpanjangan (`/console/billing/subscriptions/[id]`):

![Detail & Perpanjangan Langganan](/kb-assets/billing/subscriptions/02-subscription-detail.png)

### Informasi & Fitur yang Dapat Dikelola:
1. **Rincian Langganan & Perpanjangan (Subscription & Renewal Details)**:
   - **Tanggal & Biaya Pesanan Awal**: Waktu aktivasi pertama kali dan total biaya invoice awal.
   - **Tanggal Perpanjangan Berikutnya (Next Renewal Date)**: Jadwal autodebet otomatis dari saldo deposit organisasi.
   - **Biaya Perpanjangan (Renewal Cost)**: Jumlah pasti tagihan per siklus (contoh: `IDR 1.800.000 / quarterly`).
   - **Paket & Siklus (Plan & Cycle)**: Spesifikasi tier aktif dan frekuensi penagihan.
2. **Data Formulir Saat Pendaftaran**:
   - Memeriksa kembali data teknis yang diisi saat pemesanan, seperti nama bisnis resmi WhatsApp terverifikasi, nomor telepon, dan tautan avatar/profil.
3. **Tautan Navigasi Cepat**:
   - **Ke Konsol Layanan (Go to Product Console)**: Beralih langsung ke dasbor operasional (seperti Dasbor WhatsApp).
   - **Lihat Faktur (View Invoice)**: Membuka invoice resmi pembayaran langganan periode terkait.
4. **Pengelolaan Siklus Hidup (Batalkan Perpanjangan Otomatis)**:
   - Klik **"Cancel Renewal"** untuk menghentikan autodebet perpanjangan otomatis di periode mendatang.
   - Layanan akan tetap **aktif beroperasi 100%** hingga tanggal jatuh tempo berakhir, tanpa denda maupun penalti.
