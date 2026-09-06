---
path: /billing/transactions
locale: id
title: Riwayat Transaksi & Rekening Koran Saldo
category: Billing
purpose: Tinjau buku besar audit lengkap mutasi saldo, deposit isi ulang (top-up), pemotongan biaya langganan, pelacakan saldo akhir, dan tautan faktur resmi.
howTo:
  - "Buka menu Console > Billing > Transactions (/id/console/billing/transactions)."
  - "Pantau Saldo Saat Ini, Total Saldo Masuk (+), dan Total Penggunaan Keluar (−)."
  - "Periksa tabel Rekening Koran Saldo (Debit/Credit) untuk kalkulasi saldo berjalan (ending balance)."
  - "Klik nomor faktur terkait (TOP-* atau INV-*) untuk melihat rincian transaksi lengkap."
  - "Saring riwayat berdasarkan tanggal atau cari deskripsi mutasi tertentu."
notes:
  - "Seluruh pergerakan saldo dicatat dalam buku besar keuangan audit yang tidak dapat diubah (immutable)."
  - "Pemotongan saldo langganan memuat referensi ID pesanan dan faktur pajak terkait."
  - "Saldo Akhir (Ending Balance) mencerminkan saldo akun yang terekonsiliasi seketika setelah transaksi selesai."
---

# Riwayat Transaksi & Rekening Koran Saldo

Menu **Transaksi (Transactions)** (`/console/billing/transactions`) menyajikan laporan mutasi rekening koran saldo real-time yang merinci seluruh dana masuk (top-up), pemotongan langganan berkala, klaim voucher promosi, serta saldo akhir setelah transaksi.

![Riwayat Transaksi & Rekening Koran Saldo](/kb-assets/billing/08-billing-transactions.png)

---

## 1. Kartu Ringkasan Likuiditas Saldo

Bagian atas dasbor menampilkan indikator likuiditas finansial organisasi Anda:

- **Saldo Saat Ini (Current Balance)**: Total deposit aktif yang siap digunakan untuk autodebet perpanjangan (contoh: `IDR 14.312.580,66`).
- **Total Saldo Masuk / Inflow (+)**: Akumulasi dana masuk melalui transfer bank, virtual account, QRIS, atau voucher (contoh: `+IDR 14.950.000`).
- **Total Penggunaan / Outflow (−)**: Akumulasi pemotongan saldo untuk paket langganan aktif dan pemakaian Pay-As-You-Go (contoh: `−IDR 637.419`).
- **Tombol Isi Saldo (Top-Up Balance)**: Pintasan cepat untuk membuat faktur pengisian deposit baru.
- **Tautan Faktur Lengkap**: Pintasan langsung ke menu faktur untuk mengunduh bukti pembayaran resmi.

---

## 2. Tabel Rekening Koran Saldo (Debit/Credit)

Tabel mutasi ini beroperasi persis seperti rekening koran perbankan korporasi:

| Kolom | Penjelasan | Contoh Nyata |
| :--- | :--- | :--- |
| **Aktivitas Saldo** | Konteks jelas mengenai sumber dana masuk atau pemotongan pesanan layanan | `Subscription order cmtdt6q...` atau `Manual mark paid: TOP-4FE02F19` |
| **Referensi Faktur** | Tautan langsung ke dokumen tagihan resmi | [`INV-20260829-OLTM`](/console/billing/invoices/cmtdt6qgl0004yk4cjwr05jtr) atau [`TOP-4FE02F19`](/console/billing/invoices/cmtgyomlr0047017cipvzb2cg) |
| **Status (Tipe)** | `Credit (+)` untuk deposit/refund; `Debit (−)` untuk pemotongan biaya | `Credit (+)` atau `Debit (−)` |
| **Nominal** | Jumlah selisih dana yang diterapkan ke wallet organisasi | `+ IDR 4.500.000` atau `− IDR 21.935` |
| **Saldo Akhir** | Saldo berjalan akun seketika setelah transaksi berhasil | `IDR 14.312.581` |
| **Waktu Transaksi** | Catatan tanggal dan jam dengan presisi menit | `Aug 31, 2026, 03:13 PM` |

---

## 3. Rekonsiliasi & Audit Pembukuan

1. **Klaim Voucher Promo**: Kredit promosi yang diklaim akan tercatat sebagai transaksi `Credit (+)` beserta kode kupon terkait (contoh: `Voucher redemption: J2PZBO29`).
2. **Biaya Langganan Terjadwal**: Perpanjangan otomatis paket memotong saldo deposit dan langsung menautkan nomor faktur resmi.
3. **Keterlacakan Transparan**: Setiap rupiah yang masuk dan keluar memiliki jejak audit end-to-end antara bukti transfer bank hingga konsumsi kuota layanan.
