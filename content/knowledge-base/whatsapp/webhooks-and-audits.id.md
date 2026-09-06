---
path: /whatsapp/webhooks-and-audits
locale: id
title: Log WhatsApp, Webhook & Riwayat Pesan
category: WhatsApp
purpose: Pantau bukti pengiriman pesan masuk dan keluar, payload webhook interaktif, penanganan error, serta siklus hidup pesan end-to-end (Message Journey).
howTo:
  - "Buka menu Console > WhatsApp > Logs (/id/console/whatsapp/logs)."
  - "Saring log pengiriman berdasarkan status (SENT, DELIVERED, READ, RECEIVED) atau nomor tujuan."
  - "Klik 'Details →' pada baris log untuk membuka drawer investigasi cepat."
  - "Klik 'View Message Journey' untuk melihat linimasa lengkap pesan dari inisiasi hingga tagihan."
  - "Buka tab Activity Logs untuk mengaudit aksi pengguna, rotasi API key, dan perubahan perangkat."
notes:
  - "Log interaktif menyediakan tombol salin cepat WhatsApp Message ID (wamid)."
  - "Visualizer Message Journey menampilkan pratinjau balon chat realistis dan linimasa pengiriman bertingkat."
  - "Pesan yang gagal dikirimkan dilengkapi kode error transparan serta pelacakan pengembalian kuota otomatis."
---

# Log WhatsApp, Webhook & Riwayat Pesan

Konsol **Logs & Activity Trail** (`/console/whatsapp/logs`) memberikan visibilitas real-time bagi tim teknis dan operasional untuk melacak status pengiriman pesan, payload event webhook, serta audit riwayat perjalanan tiap pesan.

![Log Pesan & Webhook Interaktif](/kb-assets/whatsapp/logs/01-interactive-webhook-logs.png)

---

## 1. Log Pesan & Status Pengiriman

Buka menu **Console** > **WhatsApp** > **Logs** (`/id/console/whatsapp/logs`).

Tab **Message Logs** mencatat setiap perubahan status yang dilaporkan oleh Meta dan perangkat pelanggan:

- **Perangkat Pengirim (Sender Device)**: Menampilkan nomor WhatsApp bisnis yang memproses percakapan.
- **Kontak Penerima (Recipient Contact)**: Nomor telepon tujuan dalam format standar internasional E.164 (contoh: `+62 851-6143-2124`).
- **Status Pengiriman**:
  - `SENT`: Pesan berhasil diserahkan ke server Meta Cloud API.
  - `DELIVERED`: Pesan berhasil diterima di perangkat ponsel pelanggan.
  - `READ`: Centang dua biru yang menandakan pelanggan telah membuka dan membaca pesan.
  - `RECEIVED`: Pesan balasan dari pelanggan diterima dan diteruskan ke webhook atau inbox konsol.

---

## 2. Drawer Investigasi Cepat (Details Drawer)

Klik tombol **"Details →"** pada baris log untuk membuka drawer investigasi:

- **Aksi Cepat (Quick Actions)**:
  - **View Message Journey**: Membuka linimasa lengkap siklus hidup pesan tersebut.
  - **Open in Inbox**: Langsung menuju ke obrolan aktif pada menu percakapan.
- **Informasi Perangkat & Pengiriman**: Nomor pengirim, nomor penerima, dan ID log unik.
- **WhatsApp Message ID**: Tombol satu-klik **Copy ID** untuk menyalin string Meta `wamid` lengkap (contoh: `wamid.HBgNNjI4N...`) untuk kebutuhan audit di Meta Business Manager atau eskalasi teknis.

---

## 3. Linimasa Perjalanan Pesan (Unified Message Journey)

Klik **"View Message Journey"** (dapat diakses pada `/console/whatsapp/messages/[wamid]`) untuk melihat linimasa audit forensik lengkap dari sebuah pesan:

![Linimasa Riwayat Pesan WhatsApp](/kb-assets/whatsapp/logs/02-unified-message-journey.png)

### Tahapan Perjalanan Pesan:
1. **Pencatatan Kuota & Tagihan**: Menampilkan reservasi kredit awal dan klasifikasi kategori (contoh: `AUTHENTICATION · Status: CONFIRMED`).
2. **Inisiasi Pesan (Message Initiated)**: Mencatat timestamp pengiriman dan sumber pemicu (seperti *API Key Request* atau *Visual Bot Workflow*).
3. **Progresi Status Pengiriman**: Konfirmasi bertahap status `SENT` dan `DELIVERED` dengan presisi milidetik.
4. **Pratinjau Pesan (Message Preview)**: Balon chat WhatsApp realistis yang menampilkan teks lengkap, variabel yang terisi, dan teks footer yang diterima pelanggan.
5. **Rincian Teknis**: Arah pesan (`OUTBOX`/`INBOX`), tipe pesan (`template`/`text`), perangkat pengirim, operator inisiasi, dan status konfirmasi ledger tagihan.

---

## 4. Log Aktivitas (Activity Logs) & Audit Keamanan

Beralih ke tab **Activity Logs** untuk meninjau rekaman aksi administratif:
- Pembuatan, rotasi, dan pencabutan API key.
- Pembuatan template baru, pengeditan, dan sinkronisasi dengan Meta Graph API.
- Pemasangan perangkat baru, pembaruan token koneksi, dan pelepasan nomor.
- Penyesuaian saldo kuota dan pengembalian kredit pesan otomatis (refund).
