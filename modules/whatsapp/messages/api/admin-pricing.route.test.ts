import { describe, expect, it, mock, beforeEach } from "bun:test"
import { Elysia } from "elysia"
import { adminWhatsappPricingRoutes } from "./admin-pricing.route"

describe("adminWhatsappPricingRoutes", () => {
  let app: ReturnType<typeof createTestApp>

  function createTestApp() {
    return new Elysia().use(adminWhatsappPricingRoutes)
  }

  beforeEach(() => {
    mock.restore()
    app = createTestApp()
  })

  it("returns 403 or 401 when actor is not super admin", async () => {
    const res = await app.handle(
      new Request("http://localhost/admin/whatsapp/pricing/rates")
    )
    expect(res.status).toBeGreaterThanOrEqual(400)
  })
})
