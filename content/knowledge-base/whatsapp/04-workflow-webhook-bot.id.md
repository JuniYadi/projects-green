---
path: /whatsapp/workflow-webhook-bot
locale: id
title: "Workflow: Menerima Pesan Masuk & Auto-Reply Bot"
category: WhatsApp
purpose: "Panduan konfigurasi webhook untuk menangkap pesan masuk dari pelanggan dan membangun sistem auto-reply cerdas berbasis backend kustom."
howTo:
  - "Daftarkan URL Webhook backend Anda di menu Console > WhatsApp > Webhooks."
  - "Validasi signature HMAC-SHA256 pada header x-hub-signature-256 untuk memastikan keaslian request."
  - "Ekstrak teks dan nomor pengirim dari payload event messages."
  - "Balas pesan pelanggan secara instan menggunakan endpoint POST /api/whatsapp/messages."
notes:
  - "Endpoint webhook Anda harus merespons HTTP 200 OK dalam waktu kurang dari 5 detik untuk mencegah retry otomatis."
  - "Pesan balasan dalam kurung waktu 24 jam (customer care window) tidak mewajibkan penggunaan template."
---

# Workflow: Menerima Pesan Masuk & Auto-Reply Bot

Panduan ini membahas arsitektur komunikasi dua arah (*two-way conversation*) untuk menangkap pesan masuk dari pelanggan melalui Webhook dan meresponsnya secara otomatis.

---

## 1. Pratinjau Alur Percakapan 2-Arah

Contoh alur tanya-jawab otomatis antara pelanggan dan bot WhatsApp:

```
┌──────────────────────────────────────────────┐
│ 👤 Pelanggan:                                │
│ "Halo, boleh minta info menu dan harga?"     │
│ 13:00 ✓✓                                     │
│                                              │
│ 🤖 PFNApp Bot (Balasan Otomatis):            │
│ "Halo Kak! 👋 Terima kasih telah menghubungi │
│ kami. Berikut pilihan menu cepat:            │
│                                              │
│ 1️⃣ Ketik *PROMO* untuk diskon hari ini       │
│ 2️⃣ Ketik *MENU* untuk katalog lengkap       │
│ 3️⃣ Ketik *CS* untuk bicara dengan tim kami" │
│ 13:00 ✓✓                                     │
└──────────────────────────────────────────────┘
```

---

## 2. Konfigurasi Webhook (1 Menit)

1. Buka menu **Console > WhatsApp > Webhooks** (`/console/whatsapp/webhooks`).
2. Masukkan URL endpoint backend Anda yang dapat diakses publik:
   - Contoh: `https://api.domainanda.com/api/whatsapp/webhook`
3. Salin **Webhook Secret** untuk verifikasi signature keamanan.

![Log Webhook Masuk](/kb-assets/whatsapp/guides/05-journey1-webhook-logs.png)

---

## 3. Struktur Payload Pesan Masuk

Saat pengguna mengirim pesan ke nomor WhatsApp bisnis Anda, webhook akan menerima payload JSON dengan format standar:

```json
{
  "event": "messages.upsert",
  "data": {
    "from": "+6281234567890",
    "messageId": "wamid.HBgLM...",
    "timestamp": 1771747200,
    "type": "text",
    "text": {
      "body": "Halo, boleh minta info menu dan harga?"
    }
  }
}
```

---

## 4. Contoh Backend Receiver & Auto-Reply

### Node.js / Express (TypeScript)

```typescript
import express from "express"
import crypto from "crypto"

const app = express()
app.use(express.json())

const WEBHOOK_SECRET = process.env.WHATSAPP_WEBHOOK_SECRET || "pfn_whsec_..."
const API_KEY = process.env.PFN_WHATSAPP_API_KEY || "pfn_wa_sec_..."

// 1. Endpoint Penerima Webhook
app.post("/api/whatsapp/webhook", async (req, res) => {
  // A. Verifikasi Signature HMAC (Opsional tapi Direkomendasikan)
  const signature = req.headers["x-hub-signature-256"] as string
  if (signature) {
    const hmac = crypto
      .createHmac("sha256", WEBHOOK_SECRET)
      .update(JSON.stringify(req.body))
      .digest("hex")
    if (`sha256=${hmac}` !== signature) {
      return res.status(401).send("Invalid signature")
    }
  }

  // B. Wajib beri respons 200 OK secepatnya
  res.status(200).send("OK")

  const { event, data } = req.body

  // C. Proses pesan masuk tipe teks
  if (event === "messages.upsert" && data?.type === "text") {
    const senderPhone = data.from
    const userText = data.text?.body?.toLowerCase() || ""

    // Logika Auto-Reply Sederhana
    let replyText = "Halo Kak! Ketik *MENU* untuk melihat produk atau *CS* untuk bantuan."

    if (userText.includes("menu") || userText.includes("harga")) {
      replyText = "📋 *Katalog Produk Kami*:\n1. Paket Starter: Rp 50.000\n2. Paket Pro: Rp 150.000\n\nKetik *BELI* untuk memesan."
    } else if (userText.includes("cs") || userText.includes("bantuan")) {
      replyText = "👨‍💼 Tim CS kami akan segera membalas chat Anda dalam 5-10 menit."
    }

    // D. Kirim Balasan Instan (Free-form text message di dalam 24h window)
    await fetch("https://pfnapp.my.id/api/whatsapp/messages", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: senderPhone,
        type: "text",
        text: { body: replyText },
      }),
    })
  }
})

app.listen(3000, () => console.log("Webhook receiver aktif di port 3000"))
```

### PHP / Laravel (Route & Controller)

```php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class WhatsAppWebhookController extends Controller
{
    public function handle(Request $request)
    {
        $payload = $request->all();

        // 1. Tangani event pesan masuk
        if (($payload['event'] ?? '') === 'messages.upsert') {
            $sender = $payload['data']['from'] ?? null;
            $text = strtolower($payload['data']['text']['body'] ?? '');

            if ($sender && $text) {
                $reply = "Terima kasih telah menghubungi kami. Ketik *INFO* untuk bantuan.";
                
                if (str_contains($text, 'promo')) {
                    $reply = "🎉 Promo Spesial: Gunakan voucher *HEMAT50* untuk diskon 50%!";
                }

                // 2. Kirim balasan otomatis
                Http::withToken(config('services.pfn.whatsapp_key'))
                    ->post('https://pfnapp.my.id/api/whatsapp/messages', [
                        'to' => $sender,
                        'type' => 'text',
                        'text' => ['body' => $reply],
                    ]);
            }
        }

        return response()->json(['status' => 'success'], 200);
    }
}
```

---

## 5. Aturan Customer Care Window (24 Jam)

- **Gratis Sesi Chat 24 Jam**: Ketika pelanggan mengirim pesan terlebih dahulu ke nomor bisnis Anda, jendela percakapan 24 jam terbuka. Anda bebas membalas menggunakan pesan teks biasa (`type: "text"`) tanpa perlu persetujuan template.
- **Setelah 24 Jam**: Jika jendela percakapan habis dan Anda ingin menghubungi kembali pelanggan, Anda wajib menggunakan pesan bertipe `template`.
