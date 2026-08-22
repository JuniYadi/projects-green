import { describe, expect, it, beforeEach } from "bun:test"
import { portalStorageRoutes } from "./portal-storage.route"

describe("modules/storage/api/portal-storage.route", () => {
  beforeEach(() => {
    process.env.APP_KEY = "test_master_secret_32_bytes_long_123456"
  })

  it("returns 401 when unauthenticated", async () => {
    const res = await portalStorageRoutes.handle(
      new Request("http://localhost/portal/storage/metrics", {
        method: "GET",
      })
    )
    expect(res.status).toBe(401)
  })
})
