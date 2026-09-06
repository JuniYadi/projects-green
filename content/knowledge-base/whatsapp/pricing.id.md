---
path: /whatsapp/pricing
locale: id
title: Tarif WhatsApp, Harga & Ledger Transaksi
category: WhatsApp
purpose: Panduan lengkap skema tarif percakapan WhatsApp, pemotongan kuota langganan, kebijakan overage Pay-As-You-Go, dan ledger transaksi itemized.
howTo:
  - "Buka menu Console > WhatsApp > Tarif & Biaya (/id/console/whatsapp/pricing)."
  - "Gunakan Kalkulator Biaya Pesan Interaktif untuk memperkirakan pengeluaran bulanan berdasarkan volume pesan."
  - "Bandingkan perbedaan tarif per kategori: Marketing, Utility, Authentication, dan Service."
  - "Beralih ke tab Transaction History untuk mengaudit pemotongan kredit kuota per pesan secara real-time."
  - "Saring rekaman transaksi berdasarkan nomor telepon tujuan, status, kategori, atau perangkat pengirim."
notes:
  - "Pesan dalam kuota memotong jatah kredit paket langganan terlebih dahulu sebelum saldo wallet digunakan."
  - "Pesan Marketing memotong 2.0 kredit, Authentication 1.5 kredit, Utility 1.0 kredit, dan Service 1.0 kredit."
  - "Pesan yang ditolak oleh Meta otomatis direfund dan dicatat secara transparan pada ledger transaksi."
---

# Tarif WhatsApp, Harga & Ledger Transaksi

Menu **Tarif & Biaya** (`/console/whatsapp/pricing`) memberikan transparansi penuh terhadap skema biaya percakapan WhatsApp, diskon volume bertingkat (tier pricing), serta ledger pemotongan kuota real-time.

![Kalkulator Biaya & Matriks Tarif WhatsApp](/kb-assets/whatsapp/pricing/01-pricing-rates.png)

---

## 1. Kalkulator Estimasi Biaya Pesan Interaktif

Simulasikan proyeksi pengeluaran bulanan organisasi Anda sesuai volume pengiriman pesan:

- **Pilihan Tier**: Bandingkan tarif reguler **BASE** dengan potongan harga tier volume enterprise (**TIER 1**, **TIER 2**, dan **TIER 3★**).
- **Slider Volume Pesan**:
  - **Broadcast Marketing**: Pesan promosi, katalog produk, dan buletin (contoh: 2.500 pesan @ Rp 770/pesan).
  - **Utility & Notifikasi**: Bukti transaksi, resi pengiriman, dan tagihan (contoh: 1.000 pesan @ Rp 469/pesan).
  - **Kode OTP & Autentikasi**: Kode verifikasi login 2FA dan reset sandi (contoh: 500 pesan @ Rp 469/pesan).
- **Kalkulasi Bulanan Live**: Menampilkan total estimasi pengeluaran bulanan secara real-time dengan tombol cepat untuk memilih atau upgrade paket.

---

## 2. Matriks Tarif Kategori & Tier Volume

Meta mengenakan biaya percakapan berdasarkan kategori niat pesan:

| Kategori | Pengali Kuota | Tarif BASE | Tarif TIER 1 | Tarif TIER 2 | Tarif TIER 3 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`MARKETING`** | **2.0 Kredit** | Rp 770 | Rp 741 | Rp 711 | Rp 682 |
| **`UTILITY`** | **1.0 Kredit** | Rp 469 | Rp 451 | Rp 433 | Rp 415 |
| **`AUTHENTICATION`** | **1.5 Kredit** | Rp 469 | Rp 451 | Rp 433 | Rp 415 |
| **`SERVICE`** | **1.0 Kredit** | Rp 393 | Rp 378 | Rp 363 | Rp 348 |

### Pemotongan Kuota vs Overage PAYG:
1. **Kuota Paket Langganan**: Pesan yang dikirimkan akan memotong jatah unit kredit dari paket langganan bulanan Anda terlebih dahulu.
2. **Fallback Pay-As-You-Go (PAYG)**: Apabila kuota bulanan habis, pesan tetap dapat terkirim lancar dengan tarif PAYG yang dipotong otomatis dari deposit saldo organisasi Anda.

---

## 3. Ledger Transaksi & Pemotongan Kuota

Klik tab **"Transaction History"** untuk memeriksa buku besar audit seluruh pergerakan kuota:

![Ledger Transaksi Pemotongan Kuota WhatsApp](/kb-assets/whatsapp/pricing/02-ledger-statement.png)

### Kartu Ringkasan Metrik:
- **Total Kredit Terpotong (Total Deducted Credits)**: Akumulasi kredit kuota yang direservasi atau didebit dari seluruh pengiriman.
- **Kredit Dikembalikan (Refunded / Reverted)**: Kredit kuota yang otomatis dikembalikan karena gangguan jaringan atau penolakan pengiriman oleh Meta.
- **Kredit Tertagih Bersih (Net Billed Credits)**: Total kuota pesan yang terkonfirmasi berhasil terkirim.

### Tabel Audit Terperinci:
Saring catatan berdasarkan nomor telepon, kategori pesan, status pengiriman, atau perangkat pengirim:
- Waktu transaksi dengan presisi menit.
- Nomor telepon tujuan dan nomor pengirim WhatsApp.
- Klasifikasi kategori (**AUTHENTICATION**, **UTILITY**, **MARKETING**, **SERVICE**).
- Status transaksi (**Confirmed**, **Pending**, **Refunded**).
- Jumlah pemotongan kredit pasti (contoh: `-1.5 credits`, `-1 credits`, `-2 credits`).
