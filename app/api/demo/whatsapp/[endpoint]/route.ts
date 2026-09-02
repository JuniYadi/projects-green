import { NextResponse } from "next/server"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ endpoint: string }> }
) {
  const { endpoint } = await params
  const { searchParams } = new URL(request.url)

  if (endpoint === "pricing") {
    return NextResponse.json({
      status: "success",
      catalog: "PFNApp WhatsApp Business Suite",
      currency: "IDR",
      packages: [
        {
          id: "starter",
          name: "Paket Starter",
          priceMonthly: 149000,
          benefits: [
            "1 Nomor WhatsApp",
            "1.000 Pesan Broadcast / bulan",
            "Auto-Reply Standar",
            "Dashboard Analytics",
          ],
        },
        {
          id: "pro",
          name: "Paket Pro (Paling Populer)",
          priceMonthly: 499000,
          benefits: [
            "3 Nomor WhatsApp",
            "10.000 Pesan Broadcast / bulan",
            "AI Sales Agent Auto-Closing",
            "Visual Workflow Canvas",
            "Integrasi Webhook & API",
          ],
        },
        {
          id: "enterprise",
          name: "Paket Enterprise",
          priceMonthly: 1499000,
          benefits: [
            "Unlimited Nomor WhatsApp",
            "Unlimited Broadcast Quota",
            "Custom AI Knowledge Base (RAG)",
            "Dedicated Account Manager 24/7",
            "Custom ERP / CRM Integration",
          ],
        },
      ],
    })
  }

  if (endpoint === "tracking") {
    const resi = searchParams.get("resi") || "RES-DEMO-12345"
    return NextResponse.json({
      status: "success",
      trackingNumber: resi,
      courier: "J&T Express",
      sender: "Gudang Pusat Surabaya",
      receiver: "Bpk. Budi - Jakarta Selatan",
      currentStatus: "Dalam Perjalanan (Out for Delivery)",
      lastLocation: "Hub Transit Cakung DC, Jakarta",
      estimatedDelivery: "Hari ini (sebelum 18:00 WIB)",
    })
  }

  if (endpoint === "products") {
    const query = (searchParams.get("q") || "").toLowerCase()
    const allProducts = [
      {
        id: "prod-1",
        name: "WhatsApp API Gateway Cloud",
        category: "API",
        price: "Rp 149.000 / bln",
        stock: "Ready",
      },
      {
        id: "prod-2",
        name: "AI Bot Workflow Engine (Canvas)",
        category: "AI Agent",
        price: "Rp 499.000 / bln",
        stock: "Ready",
      },
      {
        id: "prod-3",
        name: "Dedicated Cloud Server Proxy",
        category: "Infrastructure",
        price: "Rp 850.000 / bln",
        stock: "Ready",
      },
    ]

    const filtered = query
      ? allProducts.filter(
          (p) =>
            p.name.toLowerCase().includes(query) ||
            p.category.toLowerCase().includes(query)
        )
      : allProducts

    return NextResponse.json({
      status: "success",
      total: filtered.length,
      products: filtered,
    })
  }

  return NextResponse.json(
    {
      status: "error",
      message: `Unknown demo endpoint '${endpoint}'. Available: 'pricing', 'tracking', 'products'`,
    },
    { status: 404 }
  )
}
