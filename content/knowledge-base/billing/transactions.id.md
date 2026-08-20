---
path: /billing/transactions
locale: id
title: Panduan Riwayat Transaksi & Mutasi Saldo
category: Billing
purpose: Telusuri seluruh riwayat mutasi kredit/debit saldo, top-up deposit, dan audit log finansial organisasi.
howTo:
  - "Buka Console > Billing > Transactions (/console/billing/transactions)."
  - "Filter transaksi berdasarkan tipe (Topup, Debit Layanan, Refund, Penyesuaian Admin)."
  - "Periksa nomor referensi, timestamp, dan saldo akhir setelah transaksi."
  - "Ekspor data riwayat transaksi untuk rekonsiliasi pembukuan."
notes:
  - Seluruh mutasi saldo dicatat secara permanen (*immutable*) untuk audit trail finansial.
  - Setiap pemotongan otomatis menyertakan metadata rincian layanan terkait.
---

Panduan ini menjelaskan cara memverifikasi riwayat mutasi saldo organisasi, bukti transaksi top-up, dan audit trail penagihan.

---

## 1. Memahami Mutasi Saldo Organisasi

Halaman **Riwayat Transaksi** (`/console/billing/transactions`) menyajikan buku besar (*ledger*) seluruh pergerakan dana di akun organisasi Anda.

![Riwayat Transaksi & Mutasi Saldo](/kb-assets/billing/08-billing-transactions.png)

### Jenis-Jenis Transaksi:
- **CREDIT (Top-up & Deposit)**: Penambahan saldo dari pembayaran invoice top-up atau pemberian kredit kompensasi.
- **DEBIT (Pemotongan Layanan)**: Pemotongan dana untuk pembayaran langganan periodik atau penggunaan pay-as-you-go.
- **REFUND**: Pengembalian saldo akibat pembatalan layanan sesuai kebijakan yang berlaku.
- **ADJUSTMENT**: Penyesuaian saldo manual oleh tim finansial atau sistem rekonsiliasi.

---

## 2. Audit Trail & Rekonsiliasi

Setiap baris transaksi menyertakan:
1. **ID Transaksi**: Pengenal unik untuk pelacakan tiket dukungan (*support ticket*).
2. **Waktu Transaksi**: Waktu presisi saat mutasi dana dieksekusi.
3. **Deskripsi Layanan**: Rincian tagihan (misal: *Renewal App Hosting Pro*, *Top-up Saldo via BCA VA*).
4. **Saldo Akhir (Running Balance)**: Posisi saldo akun setelah transaksi berhasil dibukukan.
