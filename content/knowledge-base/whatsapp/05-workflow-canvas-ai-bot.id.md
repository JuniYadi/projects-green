---
path: /whatsapp/workflows
locale: id
title: "Panduan Visual Canvas & Alur AI Bot WhatsApp"
category: WhatsApp
purpose: Panduan lengkap merancang, menguji, dan mempublikasikan alur chatbot otomatis, AI Copilot fallback, dan integrasi webhook percakapan WhatsApp.
howTo:
  - "Membuat dan mengelola alur bot visual di Visual Canvas & AI Bot Builder."
  - "Menghubungkan Trigger Node, Prompt Input, Logic Branching, HTTP Request, dan AI Generative Node."
  - "Mengikat nomor WhatsApp ke profil AI Agent atau alur otomatis."
  - "Menangani fallback CS manual dan escalation handoff."
notes:
  - "Alur bot otomatis hanya merespons pesan masuk dalam jendela sesi 24 jam interaksi pelanggan."
  - "Node HTTP Request mendukung autentikasi Bearer, API Key, dan mapping variabel dinamis."
  - "AI Generative Node memanfaatkan model LLM dengan guardrails dan audit jejak keamanan."
---

# Panduan Visual Canvas & Alur AI Bot WhatsApp

Fitur **AI & Bot Builder** (`/console/whatsapp/workflows`) memungkinkan organisasi merancang chatbot cerdas, sistem ticketing otomatis, FAQ interaktif, dan router percakapan tanpa perlu menulis kode backend yang rumit.

---

## 1. Memulai: Membuka Visual Canvas

1. Masuk ke **Console** > **WhatsApp** > **AI & Bot Builder** (`/console/whatsapp/workflows`).
2. Klik tombol **"+ Buat Alur Canvas Baru"** atau **"✦ Buka Visual Canvas & AI Copilot"**.
3. Beri nama alur Anda (misalnya `Customer Support Triage` atau `Lead Qualification Bot`).

---

## 2. Jenis Node yang Tersedia

Visual Canvas menyediakan 6 jenis node modular:

| Tipe Node | Fungsi Utama | Contoh Penggunaan |
| :--- | :--- | :--- |
| **Trigger Node** | Titik awal alur saat pesan masuk diterima | Filter kata kunci pesan (e.g. `menu`, `bantuan`, `order`) |
| **Send Message Node** | Mengirim balasan teks, media, atau pesan interaktif | Mengirim daftar menu tombol atau template notifikasi |
| **Prompt Input Node** | Menunggu dan menangkap input teks pelanggan | Meminta nomor invoice, alamat email, atau keluhan |
| **Condition Node** | Percabangan logika berdasarkan kondisi | Jika `input === "1"` arahkan ke CS, jika `"2"` ke FAQ |
| **HTTP Request Node** | Memanggil API eksternal secara real-time | Cek resi pengiriman, cek saldo akun, buat order di CRM |
| **AI Generate Node** | Menjawab pertanyaan pelanggan dengan AI Copilot | RAG pengetahuan dokumen perusahaan & respon ramah |

---

## 3. Menghubungkan Nomor WhatsApp ke AI Agent

Untuk mengaktifkan AI Copilot otomatis pada nomor WhatsApp:
1. Buka **Console** > **WhatsApp** > **Devices** (`/console/whatsapp/devices`).
2. Pilih perangkat WhatsApp Anda, lalu buka tab **AI Agent Binding**.
3. Pilih profil AI Agent yang telah dikonfigurasi di AI Studio.
4. Simpan perubahan. Seluruh pesan masuk yang tidak tertangani oleh alur statis akan dijawab secara cerdas oleh AI.

---

## 4. Pengujian & Publikasi

- Gunakan drawer **Test Simulator** di pojok kanan atas canvas untuk melakukan simulasi percakapan langsung sebelum dipublikasikan.
- Klik **Publikasikan Versi** untuk menerapkan alur ke nomor WhatsApp aktif secara live.
