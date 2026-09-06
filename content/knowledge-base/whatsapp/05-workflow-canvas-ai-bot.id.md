---
path: /whatsapp/workflows
locale: id
title: "Visual Canvas & Workflow Bot AI WhatsApp"
category: WhatsApp
purpose: Panduan lengkap merancang visual bot, pengujian simulator interaktif, dan deployment alur percakapan otomatis WhatsApp berbasis AI.
howTo:
  - "Buka menu Console > WhatsApp > AI & Bot Builder (/id/console/whatsapp/workflows)."
  - "Buat workflow baru atau klik 'Open canvas' pada otomasi yang telah dibuat."
  - "Tarik, hubungkan, dan atur langkah: Tanya Input, Tarik Data HTTP API, Keputusan AI Generate, dan Kondisi Percabangan."
  - "Klik 'Simulate test' untuk menguji alur percakapan bot secara langsung pada simulator interaktif."
  - "Aktifkan alur kerja ke nomor pelanggan live dengan klik 'Save and deploy'."
notes:
  - "Visual canvas mendukung variabel dinamis menggunakan sintaks template (contoh: {{variables.nama_variabel}})."
  - "Node HTTP Request dapat mengambil data katalog live dari API dan meneruskan respons JSON langsung ke prompt AI."
  - "Garis penghubung (edge) antar node dapat dipilih dan dihapus dengan konfirmasi visual."
---

# Visual Canvas & Workflow Bot AI WhatsApp

Fitur **AI & Bot Builder** (`/console/whatsapp/workflows`) memungkinkan organisasi merancang chatbot interaktif multi-langkah, triase bantuan pelanggan otomatis, pengecekan data katalog langsung, serta agen penjualan bertenaga AI tanpa perlu mengelola server backend yang rumit.

![Daftar Workflow WhatsApp](/kb-assets/whatsapp/workflows/01-workflows-list.png)

---

## 1. Ikhtisar & Manajemen Workflow

Pada halaman utama **AI & Bot Workflows**:
- **Daftar Otomasi Aktif**: Pantau seluruh bot yang terpasang, jumlah node, dan nomor WhatsApp yang ditugaskan.
- **Indikator Pemicu (Trigger)**: Tinjau pemicu alur (contoh: `whatsapp_inbound` pada nomor `+6283138855774`).
- **Buat Workflow Baru**: Mulai kanvas alur dari awal atau duplikasi template yang ada.
- **Buka Kanvas (Open Canvas)**: Masuk ke visual drag-and-drop workflow editor.

---

## 2. Visual Canvas Builder Interaktif

Klik **"Open canvas"** (`/console/whatsapp/workflows/[id]/canvas`) untuk membuka ruang kerja visual layar penuh.

![Visual Workflow Canvas](/kb-assets/whatsapp/workflows/02-workflow-visual-canvas.png)

### Kontrol & Toolbar Kanvas:
- **Nama & Status Workflow**: Ubah nama alur dan periksa status deployment (**Live** / **Draft**).
- **Toolbar "ADD A STEP"**:
  - **AI Assist**: Generate langkah alur secara otomatis menggunakan AI Copilot.
  - **Send message**: Kirim pesan teks atau media WhatsApp langsung ke pelanggan.
  - **Ask for input**: Tanya teks/angka ke pelanggan dan simpan hasilnya dalam variabel khusus (contoh: `customer_need`).
  - **Condition**: Buat percabangan alur berdasarkan nilai variabel.
  - **Interactive buttons**: Tampilkan tombol pilihan cepat (Quick Reply) atau menu list.
  - **AI response**: Jalankan prompt LLM menggunakan konteks percakapan dan data eksternal.
  - **HTTP request**: Lakukan panggilan API GET/POST real-time ke sistem backend atau API katalog harga.
- **Deletable Edges (Penghubung Interaktif)**: Hubungkan port output ke port input node berikutnya. Klik garis penghubung untuk menampilkan tombol **Delete edge**.
- **Navigasi Layar**: Zoom in/out, geser kanvas, dan klik **Fit View** untuk melihat keseluruhan alur dalam satu tampilan.

### Penggunaan Variabel Dinamis:
Data antar node dialirkan menggunakan tag template:
- `{{variables.<nama_variabel>}}`: Nilai yang disimpan dari langkah **Ask for input**.
- `{{steps.<node_id>.body}}`: Data JSON yang dikembalikan oleh langkah **HTTP request**.

---

## 3. Simulator Bot Interaktif

Sebelum merilis perubahan ke nomor WhatsApp produksi, uji logika percakapan secara menyeluruh menggunakan simulator bawaan.

Klik tombol **"Simulate test"** pada header kanvas untuk membuka dialog simulator:

![Simulator Bot WhatsApp](/kb-assets/whatsapp/workflows/03-workflow-simulator-dialog.png)

- **Pratinjau Percakapan Nyata**: Menampilkan balon percakapan bot persis seperti tampilan di aplikasi WhatsApp pengguna.
- **Input Chat Interaktif**: Ketik pesan simulasi pelanggan untuk menguji respon AI dan pengambilan data dari HTTP API.
- **Reset Session**: Bersihkan sesi chat untuk menguji ulang alur dari langkah pertama.

---

## 4. Rilis ke Produksi (Save and Deploy)

Setelah alur bot terverifikasi di simulator:
1. Klik tombol **"Save and deploy"** di bilah atas.
2. Workflow akan segera dikompilasi dan aktif otomatis untuk setiap pesan masuk pada nomor WhatsApp terkait.
