mock.module("server-only", () => ({}))

import { beforeEach, describe, expect, it, mock } from "bun:test"

const mockAuth = mock(() =>
  Promise.resolve({
    user: { id: "user_test", organizationId: "org_test" },
    organizationId: "org_test",
  })
)
mock.module("@workos-inc/authkit-nextjs", () => ({
  withAuth: mockAuth,
}))

const mockPrisma = {
  aiIntegrationConnection: {
    findMany: mock(async () => []),
    findFirst: mock(async () => null),
    create: mock(async () => ({} as never)),
    update: mock(async () => ({} as never)),
    delete: mock(async () => ({} as never)),
  },
}
mock.module("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

mock.module("@/lib/encryption", () => ({
  encrypt: () => ({ encrypted: "enc", iv: "iv", tag: "tag" }),
  decrypt: () => '{"Authorization":"Bearer test-secret-token"}',
  getEncryptionKey: () => Buffer.alloc(32, 1),
  serializeEncryptedField: (data: unknown) => JSON.stringify(data),
  parseEncryptedField: (str: string | null) => (str ? JSON.parse(str) : null),
}))

// Dynamic import required so mock.module takes effect
// before module evaluation in Bun
const { createConsoleAiConnectionsRoutes } = await import(
  "./console-ai-connections.route"
)

describe("Console AI Connections Route", () => {
  let app: ReturnType<typeof createConsoleAiConnectionsRoutes>

  beforeEach(() => {
    mockAuth.mockClear()
    mockPrisma.aiIntegrationConnection.findMany.mockClear()
    mockPrisma.aiIntegrationConnection.findFirst.mockClear()
    mockPrisma.aiIntegrationConnection.create.mockClear()
    mockPrisma.aiIntegrationConnection.update.mockClear()
    mockPrisma.aiIntegrationConnection.delete.mockClear()
    app = createConsoleAiConnectionsRoutes()
  })

  it("GET / returns 401 when user is not authenticated", async () => {
    mockAuth.mockImplementationOnce(() =>
      Promise.resolve({ user: null } as never)
    )

    const res = await app.handle(
      new Request("http://localhost/console/ai/connections")
    )
    expect(res.status).toBe(401)
  })

  it("GET / returns 200 with tenant connection list", async () => {
    const mockRecord = {
      id: "conn_1",
      organizationId: "org_test",
      name: "Klinik API",
      description: "API Utama",
      baseUrl: "https://api.klinik.com/v1",
      encryptedHeadersJson: JSON.stringify({
        encrypted: "enc",
        iv: "iv",
        tag: "tag",
      }),
      authType: "BEARER",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    mockPrisma.aiIntegrationConnection.findMany.mockImplementationOnce(
      async () => [mockRecord]
    )

    const res = await app.handle(
      new Request("http://localhost/console/ai/connections")
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      ok: boolean
      data: Array<{ name: string; headers: Record<string, string> }>
    }
    expect(body.ok).toBe(true)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].name).toBe("Klinik API")
    expect(body.data[0].headers.Authorization).toBe("Bearer ****oken")
  })

  it("POST / creates a connection and returns 201", async () => {
    const mockCreated = {
      id: "conn_new",
      organizationId: "org_test",
      name: "Logistik API",
      description: "API Gudang",
      baseUrl: "https://wms.toko.co.id/api",
      encryptedHeadersJson: "{}",
      authType: "BEARER",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    mockPrisma.aiIntegrationConnection.create.mockImplementationOnce(
      async () => mockCreated
    )

    const res = await app.handle(
      new Request("http://localhost/console/ai/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Logistik API",
          baseUrl: "https://wms.toko.co.id/api",
          authType: "BEARER",
          headers: { Authorization: "Bearer sk-logistik-secret" },
        }),
      })
    )
    expect(res.status).toBe(201)
    const body = (await res.json()) as { ok: boolean; data: { id: string } }
    expect(body.ok).toBe(true)
    expect(body.data.id).toBe("conn_new")
  })

  it("POST / rejects private or blocked host with 400", async () => {
    const res = await app.handle(
      new Request("http://localhost/console/ai/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Internal Server",
          baseUrl: "http://127.0.0.1:8080",
        }),
      })
    )
    expect(res.status).toBe(400)
    const body = (await res.json()) as { ok: boolean; error: string }
    expect(body.ok).toBe(false)
    expect(body.error).toContain("blocked host")
  })

  it("GET /:id returns 404 when connection does not exist", async () => {
    mockPrisma.aiIntegrationConnection.findFirst.mockImplementationOnce(
      async () => null
    )

    const res = await app.handle(
      new Request("http://localhost/console/ai/connections/conn_missing")
    )
    expect(res.status).toBe(404)
  })

  it("DELETE /:id deletes connection and returns 200", async () => {
    const mockRecord = {
      id: "conn_del",
      organizationId: "org_test",
      name: "To Delete",
      baseUrl: "https://api.test.com",
      encryptedHeadersJson: null,
      authType: "NONE",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    mockPrisma.aiIntegrationConnection.findFirst.mockImplementationOnce(
      async () => mockRecord
    )
    mockPrisma.aiIntegrationConnection.delete.mockImplementationOnce(
      async () => mockRecord
    )

    const res = await app.handle(
      new Request("http://localhost/console/ai/connections/conn_del", {
        method: "DELETE",
      })
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean }
    expect(body.ok).toBe(true)
  })
})
