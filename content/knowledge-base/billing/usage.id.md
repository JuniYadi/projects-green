---
path: /billing/usage
locale: id
title: Penggunaan & Analitik Biaya
category: Billing
purpose: Pantau metrik penggunaan sumber daya, breakdown biaya per produk, dan tren pemakaian harian.
howTo:
  - "Buka Console > Billing > Usage (/console/billing/usage)."
  - "Pilih rentang waktu (7 hari terakhir, bulan ini, kuartal ini)."
  - "Periksa grafik tren pemakaian WhatsApp messages, CPU container, dan bandwidth."
  - "Analisis perincian biaya per lini produk untuk optimalisasi anggaran."
notes:
  - Data penggunaan di-update secara berkala mendekati waktu nyata (near real-time).
  - Penggunaan di luar kuota paket langganan akan dikenakan tarif pay-as-you-go.
---

Panduan ini menjelaskan cara memantau konsumsi sumber daya dan menganalisis biaya penggunaan layanan di organisasi Anda.

---

## 1. Ikhtisar Halaman Penggunaan (Usage Analytics)

Halaman **Penggunaan** (`/console/billing/usage`) memberikan wawasan mendalam mengenai alokasi dan konsumsi sumber daya komputasi serta panggilan API.

![Halaman Penggunaan & Analitik](/kb-assets/billing/06-billing-usage.png)

### Metrik yang Dilacak:

- **WhatsApp Cloud API**: Jumlah pesan keluar (template & session messages), biaya per kategori pesan (marketing, utility, authentication, service), serta kuota perangkat aktif.
- **App Hosting Compute**: Jam komputasi container (vCPU-hours), alokasi memori (RAM-GB-hours), dan transfer data keluar (egress bandwidth).
- **WireGuard VPN**: Total transfer data terenkripsi dan jumlah peer aktif.

---

## 2. Analisis Biaya & Optimalisasi

1. **Grafik Tren Harian**: Identifikasi lonjakan lalu lintas (_traffic spikes_) atau penggunaan tak terduga.
2. **Breakdown Biaya per Layanan**: Ketahui secara presisi layanan mana yang berkontribusi terbesar terhadap tagihan organisasi Anda.
3. **Pemberitahuan Kuota**: Pastikan konsumsi tetap berada dalam batas rencana anggaran bulanan.
