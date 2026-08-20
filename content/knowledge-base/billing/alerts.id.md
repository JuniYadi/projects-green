---
path: /billing/alerts
locale: id
title: Panduan Konfigurasi Peringatan Saldo & Kuota
category: Billing
purpose: Atur ambang batas peringatan saldo menipis dan notifikasi pemakaian kuota otomatis untuk mencegah gangguan layanan.
howTo:
  - "Buka Console > Billing > Alerts (/console/billing/alerts)."
  - "Aktifkan sakelar Peringatan Saldo Menipis (Low Balance Alert)."
  - "Tentukan batas minimal saldo pemicu (contoh: Rp 100.000 atau $10.00)."
  - "Tentukan alamat email atau webhook tujuan notifikasi dan simpan perubahan."
notes:
  - Notifikasi akan otomatis dikirimkan saat saldo organisasi jatuh di bawah ambang batas yang ditentukan.
  - Anda dapat mengonfigurasi beberapa level peringatan (peringatan awal vs peringatan kritis).
---

Panduan ini menjelaskan cara mengonfigurasi sistem peringatan dini untuk saldo organisasi dan penggunaan kuota layanan.

---

## 1. Mengapa Peringatan Saldo Penting?

Layanan otomatis seperti perpanjangan langganan App Hosting dan pemotongan biaya pesan WhatsApp API mengandalkan saldo deposit organisasi. Jika saldo habis:
- Layanan otomatis dapat ditangguhkan (*suspended*).
- Pengiriman pesan WhatsApp API keluar dapat ditolak karena saldo tidak mencukupi.

Mengaktifkan **Peringatan Saldo (Billing Alerts)** menjamin tim finansial dan teknis Anda mendapatkan notifikasi lebih awal sebelum dana habis.

---

## 2. Mengonfigurasi Ambang Batas Peringatan

Buka **Console** > **Billing** > **Alerts** (`/console/billing/alerts`).

![Konfigurasi Billing Alerts](/kb-assets/billing/07-billing-alerts.png)

### Langkah Konfigurasi:
1. **Low Balance Threshold**: Masukkan angka saldo minimal yang memicu pengiriman email darurat.
2. **Channel Notifikasi**: Pilih pengiriman ke seluruh anggota dengan role Admin, atau ke daftar kontak penagihan khusus.
3. **Frekuensi Notifikasi**: Tentukan jeda pengiriman email pengingat (harian atau per kejadian pemotongan).
4. Klik **"Simpan Perubahan"** untuk menerapkan kebijakan peringatan.
