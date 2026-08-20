---
path: /billing/settings
locale: id
title: Panduan Pengaturan Penagihan, Mata Uang & Pajak
category: Billing
purpose: Kelola identitas legal perusahaan, nomor NPWP, alamat faktur resmi, dan konfigurasi mata uang penagihan default.
howTo:
  - "Buka Console > Billing > Settings (/console/billing/settings)."
  - "Lengkapi data legal: Nama Resmi Perusahaan, Alamat Penagihan, dan Nomor NPWP/Tax ID."
  - "Pilih mata uang utama penagihan (IDR atau USD)."
  - "Simpan pengaturan untuk menerapkan identitas legal pada setiap berkas PDF invoice."
notes:
  - Informasi legal yang tersimpan akan dicetak pada kepala faktur invoice resmi untuk keperluan kepatuhan pajak.
  - Perubahan mata uang penagihan akan berlaku untuk siklus invoice dan checkout baru berikutnya.
---

Panduan ini menjelaskan cara mengonfigurasi pengaturan legal perusahaan, NPWP, dan preferensi mata uang penagihan.

---

## 1. Identitas Legal & Pengaturan Pajak

Halaman **Billing Settings** (`/console/billing/settings`) memungkinkan Anda menyesuaikan informasi korporat yang muncul pada berkas faktur dan tanda terima resmi.

![Pengaturan Penagihan & Pajak](/kb-assets/billing/11-billing-settings.png)

### Bagian Pengaturan:
1. **Nama Legal Perusahaan**: Nama entitas bisnis resmi yang tercatat di dokumen hukum.
2. **NPWP / Tax Identification Number**: Nomor pokok wajib pajak untuk pelaporan pajak pertambahan nilai (PPN).
3. **Alamat Lengkap Penagihan**: Alamat kantor resmi yang tertera pada faktur.
4. **Mata Uang Default (Billing Currency)**: Tentukan mata uang dasar akun (Rupiah `IDR` atau Dollar `USD`).

---

## 2. Menyimpan & Memperbarui Data

Pastikan seluruh data yang dimasukkan telah akurat sebelum disimpan, karena data tersebut digunakan secara langsung oleh mesin pembuat PDF invoice (*invoice rendering engine*) untuk penerbitan dokumen hukum keuangan.
