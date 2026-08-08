import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"

import { createAdminCatalogRoutes } from "./catalog.route"

const guard = mock(async (set: { status?: number | string }) => {
  set.status = 200
  return {
    ok: true as const,
    userId: "admin-1",
    platformRole: "super_admin" as const,
  }
})
const service = {
  listProducts: mock(),
  getProduct: mock(),
  saveDraft: mock(),
  publish: mock(),
}
const draft = {
  code: "VPN",
  name: "VPN",
  description: null,
  state: "DRAFT",
  plans: [],
  updatedAt: "2026-01-01T00:00:00.000Z",
}

function app() {
  return new Elysia()
    .use(
      createAdminCatalogRoutes({
        requireSuperAdmin: guard,
        catalogService: service as never,
      })
    )
    .compile()
}

function request(path: string, method = "GET", body?: unknown) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

describe("admin catalog routes", () => {
  beforeEach(() => {
    guard.mockReset()
    guard.mockResolvedValue({
      ok: true,
      userId: "admin-1",
      platformRole: "super_admin",
    })
    for (const fn of Object.values(service)) fn.mockReset()
    service.listProducts.mockResolvedValue([draft])
    service.getProduct.mockResolvedValue(draft)
    service.saveDraft.mockResolvedValue(draft)
    service.publish.mockResolvedValue({ ...draft, state: "PUBLISHED" })
  })

  it("requires super-admin authorization", async () => {
    guard.mockImplementationOnce(async (set: { status?: number | string }) => {
      set.status = 403
      return {
        ok: false,
        error: "FORBIDDEN",
        message: "Super admin access required.",
      }
    })
    const response = await app().handle(request("/admin/catalog"))
    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({
      ok: false,
      error: "FORBIDDEN",
    })
  })

  it("returns explicit DTOs for list and detail", async () => {
    const list = await app().handle(request("/admin/catalog"))
    expect(list.status).toBe(200)
    expect(await list.json()).toEqual({ ok: true, products: [draft] })

    const detail = await app().handle(request("/admin/catalog/VPN"))
    expect(detail.status).toBe(200)
    expect(await detail.json()).toEqual({ ok: true, product: draft })
  })

  it("saves drafts and publishes successfully", async () => {
    const body = { code: "VPN", name: "VPN", description: null, plans: [] }
    const save = await app().handle(request("/admin/catalog", "POST", body))
    expect(save.status).toBe(200)
    expect(service.saveDraft).toHaveBeenCalledWith(body)

    const publish = await app().handle(
      request("/admin/catalog/VPN/publish", "POST")
    )
    expect(publish.status).toBe(200)
    expect((await publish.json()).product.state).toBe("PUBLISHED")
  })
  it("returns not found and validation errors", async () => {
    service.getProduct.mockResolvedValueOnce(null)
    const missing = await app().handle(request("/admin/catalog/MISSING"))
    expect(missing.status).toBe(404)

    service.publish.mockRejectedValueOnce(
      Object.assign(new Error("Missing price cells"), {
        name: "ProductPublishValidationError",
      })
    )
    const invalid = await app().handle(
      request("/admin/catalog/VPN/publish", "POST")
    )
    expect(invalid.status).toBe(422)
  })
})
