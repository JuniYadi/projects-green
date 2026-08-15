import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"
import type { MetaAppsService } from "../meta-apps.service"

// Mock leaf infrastructure before importing route (the production singleton imports these).
mock.module("@/lib/prisma", () => ({ prisma: {} }))
mock.module("@/lib/whatsapp/crypto", () => ({
  encryptWithAppKey: mock(async (value: string) => `encrypted:${value}`),
  decryptWithAppKey: mock(async (value: string) => value),
}))

// Dynamic import is intentional: Bun module mocks must be registered first.
const { createAdminMetaAppsRoutes } = await import("./meta-apps.route")
const appRecord = {
  id: "meta-1",
  name: "Primary",
  metaAppId: "12345",
  webhookKey: "webhook-key",
  active: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  callbackPath: "/api/whatsapp/meta-webhook/webhook-key",
}

const admin = {
  ok: true as const,
  userId: "admin-1",
  platformRole: "super_admin" as const,
}
const unauthorized = (set: { status?: number | string }) => {
  set.status = 401
  return {
    ok: false as const,
    error: "UNAUTHORIZED",
    message: "You must be signed in.",
  }
}
const forbidden = (set: { status?: number | string }) => {
  set.status = 403
  return {
    ok: false as const,
    error: "FORBIDDEN",
    message: "Super admin required.",
  }
}

const mockGuard = mock(async () => admin)
const mockList = mock(async () => [appRecord])
const mockGet = mock(async (): Promise<typeof appRecord | null> => appRecord)
const mockCreate = mock(async (input: unknown) => appRecord)
const mockUpdate = mock(async (id: string, input: unknown) => appRecord)
const mockDelete = mock(async (id: string) => appRecord)

const service = {
  list: mockList,
  get: mockGet,
  create: mockCreate,
  update: mockUpdate,
  delete: mockDelete,
}

function createTestApp(guard = mockGuard) {
  return new Elysia().use(
    createAdminMetaAppsRoutes({
      requireSuperAdmin: guard,
      service: service as unknown as MetaAppsService,
    })
  )
}

const BASE = "http://localhost/admin/whatsapp/meta-apps"
const json = (value: unknown): RequestInit => ({
  headers: { "content-type": "application/json" },
  body: JSON.stringify(value),
})

beforeEach(() => {
  mockGuard.mockImplementation(async () => admin)
  mockList.mockImplementation(async () => [appRecord])
  mockGet.mockImplementation(async () => appRecord)
  mockCreate.mockImplementation(async () => appRecord)
  mockUpdate.mockImplementation(async () => appRecord)
  mockDelete.mockImplementation(async () => appRecord)
  mockGuard.mockClear()
  mockList.mockClear()
  mockGet.mockClear()
  mockCreate.mockClear()
  mockUpdate.mockClear()
  mockDelete.mockClear()
})

describe("admin MetaApp routes", () => {
  it("rejects unauthenticated requests before service access", async () => {
    const app = createTestApp(unauthorized as unknown as typeof mockGuard)
    const response = await app.handle(new Request(`${BASE}/`))
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body).toMatchObject({ ok: false, error: "UNAUTHORIZED" })
    expect(mockList).not.toHaveBeenCalled()
  })

  it("rejects non-super-admin requests", async () => {
    const app = createTestApp(forbidden as unknown as typeof mockGuard)
    const response = await app.handle(new Request(`${BASE}/`))
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body).toMatchObject({ ok: false, error: "FORBIDDEN" })
  })

  it("lists active and inactive metadata without credentials", async () => {
    const app = createTestApp()
    const response = await app.handle(new Request(`${BASE}/`))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ ok: true, data: [appRecord] })
    expect(mockList).toHaveBeenCalledWith({ activeOnly: false })
    expect(JSON.stringify(body)).not.toContain("appSecret")
    expect(JSON.stringify(body)).not.toContain("verifyToken")
    expect(JSON.stringify(body)).not.toContain("Encrypted")
  })

  it("returns 404 for missing MetaApp", async () => {
    mockGet.mockImplementation(async () => null)
    const response = await createTestApp().handle(
      new Request(`${BASE}/missing`)
    )
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body).toMatchObject({ ok: false, error: "NOT_FOUND" })
  })

  it("creates MetaApp through service and returns redacted metadata", async () => {
    const input = {
      name: " Primary ",
      metaAppId: "12345",
      appSecret: "secret-value",
      verifyToken: "verify-value",
      active: true,
    }
    const response = await createTestApp().handle(
      new Request(`${BASE}/`, { method: "POST", ...json(input) })
    )
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body).toEqual({ ok: true, data: appRecord })
    expect(mockCreate).toHaveBeenCalledWith(
      { ...input, name: "Primary" },
      "admin-1"
    )
    expect(JSON.stringify(body)).not.toContain("secret-value")
    expect(JSON.stringify(body)).not.toContain("verify-value")
  })

  it("returns field errors for invalid create body", async () => {
    const response = await createTestApp().handle(
      new Request(`${BASE}/`, {
        method: "POST",
        ...json({ name: "", metaAppId: "x" }),
      })
    )
    const body = await response.json()

    expect(response.status).toBe(422)
    expect(body).toMatchObject({ ok: false, error: "VALIDATION_ERROR" })
    expect(body.fieldErrors).toHaveProperty("name")
    expect(body.fieldErrors).toHaveProperty("appSecret")
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it("updates metadata and rotates credentials through service", async () => {
    const input = {
      name: "Renamed",
      appSecret: "new-secret",
      verifyToken: "new-token",
    }
    const response = await createTestApp().handle(
      new Request(`${BASE}/meta-1`, { method: "PATCH", ...json(input) })
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ ok: true, data: appRecord })
    expect(mockUpdate).toHaveBeenCalledWith("meta-1", input, "admin-1")
    expect(JSON.stringify(body)).not.toContain("new-secret")
    expect(JSON.stringify(body)).not.toContain("new-token")
  })

  it("maps attached-device conflicts to 409 for update and delete", async () => {
    const conflict = { code: "META_APP_HAS_DEVICES" }
    mockUpdate.mockImplementation(async () => {
      throw conflict
    })
    let response = await createTestApp().handle(
      new Request(`${BASE}/meta-1`, {
        method: "PATCH",
        ...json({ active: false }),
      })
    )
    expect(response.status).toBe(409)
    expect((await response.json()).error).toBe("CONFLICT")

    mockDelete.mockImplementation(async () => {
      throw conflict
    })
    response = await createTestApp().handle(
      new Request(`${BASE}/meta-1`, { method: "DELETE" })
    )
    expect(response.status).toBe(409)
    expect((await response.json()).error).toBe("CONFLICT")
  })

  it("maps duplicate and unexpected service errors safely", async () => {
    mockCreate.mockImplementation(async () => {
      throw { code: "P2002", meta: { target: ["metaAppId"] } }
    })
    let response = await createTestApp().handle(
      new Request(`${BASE}/`, {
        method: "POST",
        ...json({
          name: "Primary",
          metaAppId: "12345",
          appSecret: "secret-value",
          verifyToken: "verify-value",
        }),
      })
    )
    expect(response.status).toBe(409)
    expect((await response.json()).error).toBe("CONFLICT")

    mockGet.mockImplementation(async () => {
      throw new Error("secret-value should not leak")
    })
    response = await createTestApp().handle(new Request(`${BASE}/meta-1`))
    const body = await response.json()
    expect(response.status).toBe(500)
    expect(body).toEqual({
      ok: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred.",
    })
    expect(JSON.stringify(body)).not.toContain("secret-value")
  })

  it("deletes MetaApp when no devices are attached", async () => {
    const response = await createTestApp().handle(
      new Request(`${BASE}/meta-1`, { method: "DELETE" })
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ ok: true, data: appRecord })
    expect(mockDelete).toHaveBeenCalledWith("meta-1", "admin-1")
  })
})
