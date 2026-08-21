---
path: /whatsapp/webhooks-and-audits
locale: id
title: Log Webhook WhatsApp & Jejak Audit Keamanan
category: WhatsApp
purpose: Pantau riwayat event webhook masuk dan keluar, tanda terima pengiriman payload, percobaan ulang error, dan log audit kepatuhan.
howTo:
  - "Buka Console > WhatsApp > Webhook Logs (/console/whatsapp/webhook-logs)."
  - "Filter event webhook berdasarkan status (DELIVERED, FAILED, RETRYING) atau jenis event."
  - "Periksa rincian payload JSON mentah, kode status respons HTTP, dan latensi eksekusi."
  - "Buka Console > WhatsApp > Audit Logs (/console/whatsapp/audit-logs) untuk meninjau aktivitas pengguna."
notes:
  - "Webhook keluar yang gagal dikirim akan dicoba ulang secara otomatis dengan jeda eksponensial (exponential backoff)."
  - "Log audit bersifat permanen (immutable) untuk kepatuhan keamanan dan rekonsiliasi penagihan."
---

# Log Webhook WhatsApp & Jejak Audit Keamanan

Panduan ini menjelaskan cara memantau pengiriman pesan dan kepatuhan sistem melalui **Webhook Logs** dan **Audit Logs**.

---

## 1. Webhook Logs (`/console/whatsapp/webhook-logs`)

Webhook Logs mencatat seluruh event mentah yang diterima dari Meta Cloud API (pesan masuk pelanggan, pembaruan status pesan) serta pengiriman webhook keluar ke server backend Anda.

![Log Webhook](/kb-assets/whatsapp/guides/05-journey1-webhook-logs.png)

### Jenis Event Utama:
- `message.received`: Pesan masuk (teks, media, tombol) yang dikirim oleh pelanggan.
- `message.sent`: Konfirmasi pengiriman pesan dari Meta.
- `message.delivered`: Konfirmasi bahwa pesan telah sampai di perangkat penerima.
- `message.read`: Stempel waktu pesan telah dibuka/dibaca oleh pelanggan.
- `message.failed`: Informasi kegagalan pengiriman beserta kode error dari Meta.

### Memeriksa Rincian Payload Webhook:
Klik baris log webhook untuk melihat payload JSON request dan response secara lengkap, kode status HTTP, latensi jaringan dalam milidetik, dan riwayat percobaan ulang (*retry*).

---

## 2. Audit Logs (`/console/whatsapp/audit-logs`)

Menu Audit Logs menyediakan catatan audit permanen atas tindakan administratif dan operasional yang terjadi di organisasi Anda.

![Log Audit](/kb-assets/whatsapp/guides/06-journey1-audit-logs.png)

### Aktivitas yang Dicatat:
- Pembuatan, rotasi, dan pencabutan akses API Key.
- Pembuatan, perubahan, dan sinkronisasi template pesan.
- Pendaftaran perangkat WhatsApp baru, pembaruan token, atau pemutusan koneksi.
- Pemicuan pengiriman pesan massal (*broadcast*).
- Pemotongan kuota saldo dan pengembalian dana (*refund*).
