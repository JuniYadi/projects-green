---
path: /billing/invoices
locale: id
title: Faktur, Riwayat Tagihan & Bukti Pembayaran Pajak
category: Billing
purpose: Pantau riwayat pembayaran invoice, periksa rincian item layanan (line items), identitas entitas legal resmi, dan unduh faktur PDF yang sah untuk perpajakan.
howTo:
  - "Buka menu Console > Billing > Invoices (/id/console/billing/invoices)."
  - "Saring riwayat tagihan berdasarkan status (All, Paid, Open, Void) atau cari nomor invoice."
  - "Klik nomor faktur (contoh: INV-20260829-OLTM) untuk melihat rincian akuntansi lengkap."
  - "Klik 'Download PDF' untuk mengunduh faktur resmi bagi kebutuhan audit keuangan dan pajak."
notes:
  - "Faktur resmi diterbitkan oleh PT. Premium Fast Network, badan hukum operasional yang terdaftar."
  - "Invoice dengan status Open dapat dibayar seketika menggunakan saldo deposit organisasi atau payment gateway."
  - "Line items merinci biaya langganan, pemakaian kuota, diskon, dan pajak PPN secara transparan."
---

# Faktur, Riwayat Tagihan & Bukti Pembayaran Pajak

Menu **Faktur (Invoices)** (`/console/billing/invoices`) menyediakan arsip permanen dan dapat dicari untuk seluruh tagihan layanan, perpanjangan langganan, pengisian saldo deposit (top-up), serta bukti pembayaran resmi.

![Dasbor Riwayat Faktur Penagihan](/kb-assets/billing/invoices/01-invoices-management.png)

---

## 1. Tabel Riwayat Faktur Penagihan

Buka menu **Console** > **Billing** > **Invoices** (`/id/console/billing/invoices`).

Tabel riwayat faktur mencatat setiap transaksi pembayaran organisasi:

- **Nomor Faktur (Invoice #)**: Nomor unik faktur penagihan resmi (contoh: `INV-20260829-OLTM` untuk langganan atau `TOP-4FE02F19` untuk isi saldo).
- **Tanggal Diterbitkan (Issued Date)**: Waktu faktur dibuat dan jatuh tempo.
- **Jumlah Tagihan (Amount)**: Nilai nominal bersih dalam mata uang Rupiah (IDR) atau USD.
- **Lencana Status**:
  - `Paid`: Tagihan telah lunas dibayarkan dan dicatat pada sistem.
  - `Open / Pending`: Menunggu penyelesaian pembayaran.
  - `Void / Cancelled`: Faktur dibatalkan atau disesuaikan.
- **Aksi PDF**: Tombol cepat **"Download PDF"** untuk mengunduh berkas faktur resmi kapan saja.

---

## 2. Rincian Akuntansi Faktur (Invoice Detail)

Klik baris faktur mana pun untuk melihat rincian kalkulasi akuntansi lengkap (`/console/billing/invoices/[id]`):

![Rincian Faktur & Bukti PDF Resmi](/kb-assets/billing/invoices/02-invoice-detail.png)

### Informasi Badan Hukum Penerbit Resmi:
Seluruh faktur komersial memuat identitas legal entitas operasional resmi:
- **Nama Perusahaan**: `PT. Premium Fast Network`
- **Alamat Kantor**: `Jl. Bungurasih Tengah No 70, Waru, Sidoarjo, Jawa Timur 61256`
- **Kontak Bantuan**: `Email: support@pfnapp.id | WhatsApp: +6281216667996`

### Komponen Rincian Penagihan:
1. **Metadata Faktur**:
   - Tanggal Penerbitan dan Tanggal Jatuh Tempo.
   - Nama Organisasi Penerima Tagihan (Billed To) dan alamat email admin.
   - Periode Masa Aktif Layanan (contoh: `Aug 29, 2026 — Sep 30, 2026`).
2. **Tabel Rincian Item Layanan (Line Items)**:
   - **Deskripsi**: Nama produk dan paket spesifik (contoh: `APP_HOSTING SMALL subscription` atau `Paket WhatsApp Private`).
   - **Kategori**: Pengelompokan jenis layanan.
   - **Jumlah (Qty)**: Total unit atau lisensi layanan.
   - **Nominal (Amount)**: Harga dasar per item layanan.
3. **Ringkasan Finansial**:
   - **Subtotal**: Total nominal sebelum pajak dan diskon.
   - **Pajak (Tax)**: Perhitungan PPN/pajak resmi yang berlaku.
   - **Diskon**: Potongan voucher promo atau penyesuaian harga khusus.
   - **Total**: Jumlah akhir yang telah dibayar atau harus dilunasi.

---

## 3. Unduh Faktur PDF Resmi (Tax-Compliant)

Klik tombol **"Download PDF"** pada halaman rincian faktur untuk menghasilkan dokumen PDF resmi siap cetak yang memenuhi standar pembukuan perusahaan, laporan pajak, dan klaim reimbursement korporasi.
