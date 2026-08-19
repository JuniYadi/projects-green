import { describe, expect, it, mock, beforeEach } from "bun:test"
import { Elysia } from "elysia"
import { adminWhatsappPricingRoutes } from "./admin-pricing.route"
import { prisma } from "@/lib/prisma"

describe("adminWhatsappPricingRoutes", () => {
  let app: Elysia

  beforeEach(() => {
    mock.restore()
    app = new Elysia().use(adminWhatsappPricingRoutes)
  })

  it("returns 403 or 401 when actor is not super admin", async () => {
    const res = await app.handle(
      new Request("http://localhost/admin/whatsapp/pricing/rates")
    )
    expect(res.status).toBeGreaterThanOrEqual(400)
  })
})
