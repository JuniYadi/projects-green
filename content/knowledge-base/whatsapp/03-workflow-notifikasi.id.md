---
path: /whatsapp/workflow-notifikasi
locale: id
title: "Workflow: Notifikasi Pesanan, Invoice, dan Pengingat"
category: WhatsApp
purpose: "Panduan pengiriman notifikasi transaksional otomatis seperti konfirmasi invoice, nomor resi pengiriman, dan reminder jadwal menggunakan template UTILITY."
howTo:
  - "Buat template UTILITY di Console > WhatsApp > Templates dengan parameter dinamis {{1}}, {{2}}, dst."
  - "Tambahkan tombol Quick Reply atau Tautan (CTA URL) untuk mempermudah aksi pelanggan."
  - "Kirim data variabel dinamis melalui array components.parameters pada payload API."
  - "Gunakan webhook notifikasi status untuk mencatat waktu pesan dibaca oleh pembeli."
notes:
  - "Kategori UTILITY digunakan khusus untuk pesan transaksional terikat pesanan atau layanan aktif."
  - "Pastikan urutan parameter di payload JSON sesuai persis dengan urutan placeholder {{1}}, {{2}} pada template."
---

# Workflow: Notifikasi Pesanan, Invoice, dan Pengingat

Panduan ini mencakup integrasi pengiriman notifikasi transaksional otomatis, mulai dari ringkasan invoice baru, konfirmasi pembayaran, hingga update nomor resi ekspedisi.

---

## 1. Pratinjau Pesan Invoice di Layar Pengguna

Tampilan template transaksi dengan tombol tautan pembayaran instan:

```
┌──────────────────────────────────────────────┐
│ 🛍️ PFN Store: Tagihan Pesanan                │
│                                              │
│ Halo *Budi Setiawan*,                        │
│ Pesanan *#INV-2026-0891* telah dibuat!       │
│                                              │
│ • Total Tagihan: *Rp 150.000*                │
│ • Jatuh Tempo  : 24 Agustus 2026, 23:59 WIB  │
│                                              │
│ Silakan lakukan pembayaran melalui tautan di │
│ bawah ini:                                   │
│ ──────────────────────────────────────────── │
│ [ 💳 Bayar Sekarang ]                        │
│ 10:15 ✓✓                                     │
└──────────────────────────────────────────────┘
```

---

## 2. Persiapan Template (1 Menit)

1. Buka menu **Console > WhatsApp > Templates** (`/console/whatsapp/templates`).
2. Buat template dengan spesifikasi:
   - **Nama Template**: `order_invoice_update`
   - **Kategori**: `UTILITY`
   - **Bahasa**: `id`
   - **Isi Body**:
     ```
     Halo *{{1}}*,
     Pesanan *#{{2}}* telah dibuat!

     • Total Tagihan: *{{3}}*
     • Jatuh Tempo : {{4}}

     Silakan lakukan pembayaran melalui tautan di bawah ini:
     ```
   - **Tombol**: URL Button `https://pfnapp.my.id/pay/{{1}}`

![Daftar Template](/kb-assets/whatsapp/guides/02-journey1-templates-list.png)

---

## 3. Contoh Implementasi Pengiriman

Kirimkan HTTP POST ke `/api/whatsapp/messages` membawa nilai parameter dinamis:

### Node.js / TypeScript (Next.js / Express)

```typescript
interface InvoiceNotificationPayload {
  customerPhone: string
  customerName: string
  invoiceNumber: string
  totalAmount: string
  dueDate: string
  invoiceSlug: string
}

export async function sendInvoiceNotification(data: InvoiceNotificationPayload) {
  const response = await fetch("https://pfnapp.my.id/api/whatsapp/messages", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.PFN_WHATSAPP_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: data.customerPhone,
      type: "template",
      template: {
        name: "order_invoice_update",
        language: { code: "id" },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: data.customerName },   // {{1}}
              { type: "text", text: data.invoiceNumber },  // {{2}}
              { type: "text", text: data.totalAmount },    // {{3}}
              { type: "text", text: data.dueDate },        // {{4}}
            ],
          },
          {
            type: "button",
            sub_type: "url",
            index: "0",
            parameters: [
              { type: "text", text: data.invoiceSlug },    // Akhiran URL tombol bayar
            ],
          },
        ],
      },
    }),
  })

  return await response.json()
}
```

### PHP / Laravel (Payment Event Listener)

```php
namespace App\Listeners;

use App\Events\OrderCreated;
use Illuminate\Support\Facades\Http;

class SendWhatsAppInvoiceNotification
{
    public function handle(OrderCreated $event): void
    {
        $order = $event->order;

        Http::withToken(config('services.pfn.whatsapp_key'))
            ->post('https://pfnapp.my.id/api/whatsapp/messages', [
                'to' => $order->customer_phone,
                'type' => 'template',
                'template' => [
                    'name' => 'order_invoice_update',
                    'language' => ['code' => 'id'],
                    'components' => [
                        [
                            'type' => 'body',
                            'parameters' => [
                                ['type' => 'text', 'text' => $order->customer_name],
                                ['type' => 'text', 'text' => $order->invoice_number],
                                ['type' => 'text', 'text' => 'Rp ' . number_format($order->total_amount, 0, ',', '.')],
                                ['type' => 'text', 'text' => $order->due_date_formatted],
                            ],
                        ],
                        [
                            'type' => 'button',
                            'sub_type' => 'url',
                            'index' => '0',
                            'parameters' => [
                                ['type' => 'text', 'text' => $order->id],
                            ],
                        ],
                    ],
                ],
            ]);
    }
}
```

### Python (Celery / Background Worker)

```python
import os
import requests

def dispatch_invoice_whatsapp(phone: str, name: str, inv_no: str, total: str, due: str, inv_id: str):
    url = "https://pfnapp.my.id/api/whatsapp/messages"
    payload = {
        "to": phone,
        "type": "template",
        "template": {
            "name": "order_invoice_update",
            "language": {"code": "id"},
            "components": [
                {
                    "type": "body",
                    "parameters": [
                        {"type": "text", "text": name},
                        {"type": "text", "text": inv_no},
                        {"type": "text", "text": total},
                        {"type": "text", "text": due},
                    ],
                },
                {
                    "type": "button",
                    "sub_type": "url",
                    "index": "0",
                    "parameters": [{"type": "text", "text": inv_id}],
                },
            ],
        },
    }
    
    headers = {
        "Authorization": f"Bearer {os.getenv('PFN_WHATSAPP_API_KEY')}",
        "Content-Type": "application/json",
    }
    
    res = requests.post(url, json=payload, headers=headers)
    return res.json()
```

---

## 4. Tips & Penanganan Masalah

1. **Jumlah Parameter Harus Sama**: Jika di template terdapat 4 placeholder `{{1}}` s/d `{{4}}`, array `parameters` wajib berisi tepat 4 elemen. Kurang atau lebih akan menyebabkan error validasi Meta.
2. **Karakter Khusus**: Hindari karakter tabulasi atau baris baru berlebih di dalam parameter teks tunggal.
