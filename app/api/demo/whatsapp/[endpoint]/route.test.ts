import { describe, expect, it } from "bun:test"
import { GET, POST } from "./route"
describe("GET /api/demo/whatsapp/[endpoint]", () => {
  it("returns pricing catalog data for pricing endpoint", async () => {
    const req = new Request("https://pfnapp.my.id/api/demo/whatsapp/pricing")
    const res = await GET(req, {
      params: Promise.resolve({ endpoint: "pricing" }),
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.status).toBe("success")
    expect(data.packages.length).toBe(3)
    expect(data.packages[0].name).toBe("Paket Starter")
  })

  it("returns tracking information with custom resi query", async () => {
    const req = new Request(
      "https://pfnapp.my.id/api/demo/whatsapp/tracking?resi=JNT998877"
    )
    const res = await GET(req, {
      params: Promise.resolve({ endpoint: "tracking" }),
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.status).toBe("success")
    expect(data.trackingNumber).toBe("JNT998877")
    expect(data.courier).toBe("J&T Express")
  })

  it("returns filtered products for products endpoint", async () => {
    const req = new Request(
      "https://pfnapp.my.id/api/demo/whatsapp/products?q=gateway"
    )
    const res = await GET(req, {
      params: Promise.resolve({ endpoint: "products" }),
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.status).toBe("success")
    expect(data.products.length).toBe(1)
    expect(data.products[0].id).toBe("prod-1")
  })

  it("returns 404 for unknown endpoint", async () => {
    const req = new Request("https://pfnapp.my.id/api/demo/whatsapp/unknown")
    const res = await GET(req, {
      params: Promise.resolve({ endpoint: "unknown" }),
    })
    expect(res.status).toBe(404)
    const data = await res.json()
    expect(data.status).toBe("error")
  })
})
describe("POST /api/demo/whatsapp/[endpoint]", () => {
  it("processes leads and returns lead ID with forwarded context", async () => {
    const req = new Request(
      "https://pfnapp.my.id/api/demo/whatsapp/process-lead",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variables: {
            customer_name: "Budi",
            customer_need: "WhatsApp Broadcast",
          },
          session: { phone_number: "+62812345678" },
        }),
      }
    )
    const res = await POST(req, {
      params: Promise.resolve({ endpoint: "process-lead" }),
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.status).toBe("success")
    expect(data.leadId).toBeDefined()
    expect(data.receivedData.capturedVariables.customer_name).toBe("Budi")
  })

  it("handles orders creation with payment link", async () => {
    const req = new Request("https://pfnapp.my.id/api/demo/whatsapp/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        variables: { package_id: "pro" },
      }),
    })
    const res = await POST(req, {
      params: Promise.resolve({ endpoint: "orders" }),
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.status).toBe("success")
    expect(data.paymentLink).toBeDefined()
  })

  it("returns 404 for unknown POST endpoint", async () => {
    const req = new Request(
      "https://pfnapp.my.id/api/demo/whatsapp/invalid-endpoint",
      {
        method: "POST",
      }
    )
    const res = await POST(req, {
      params: Promise.resolve({ endpoint: "invalid-endpoint" }),
    })
    expect(res.status).toBe(404)
    const data = await res.json()
    expect(data.status).toBe("error")
  })
})
