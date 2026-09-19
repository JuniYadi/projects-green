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
  aiActionIntent: {
    findMany: mock(async (): Promise<unknown[]> => []),
    findFirst: mock(async (): Promise<unknown> => null),
    create: mock(async (): Promise<unknown> => ({} as never)),
    update: mock(async (): Promise<unknown> => ({} as never)),
    deleteMany: mock(async (): Promise<unknown> => ({ count: 1 })),
  },
  aiIntegrationConnection: {
    findFirst: mock(async (): Promise<unknown> => null),
  },
  aiAgentProfile: {
    findFirst: mock(async (): Promise<unknown> => null),
  },
}
mock.module("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

const { createConsoleAiActionsRoutes } = await import(
  "./console-ai-actions.route"
)

describe("Console AI Actions Route", () => {
  let app: ReturnType<typeof createConsoleAiActionsRoutes>

  beforeEach(() => {
    mockAuth.mockClear()
    mockPrisma.aiActionIntent.findMany.mockClear()
    mockPrisma.aiActionIntent.findFirst.mockClear()
    mockPrisma.aiActionIntent.create.mockClear()
    mockPrisma.aiActionIntent.update.mockClear()
    mockPrisma.aiActionIntent.deleteMany.mockClear()
    mockPrisma.aiIntegrationConnection.findFirst.mockClear()
    mockPrisma.aiAgentProfile.findFirst.mockClear()
    app = createConsoleAiActionsRoutes()
  })

  it("GET / returns 401 when user is not authenticated", async () => {
    mockAuth.mockImplementationOnce(() =>
      Promise.resolve({ user: null } as never)
    )

    const res = await app.handle(
      new Request("http://localhost/console/ai/actions")
    )
    expect(res.status).toBe(401)
  })

  it("GET / returns 200 with action intents list", async () => {
    const mockRecord = {
      id: "act_1",
      organizationId: "org_test",
      agentProfileId: "agent_1",
      name: "Cek Resi",
      description: "Lacak pengiriman pesanan",
      connectionId: "conn_1",
      subpath: "/track",
      method: "GET",
      slots: [
        {
          name: "resi",
          type: "STRING",
          required: true,
          inquiryQuestion: "Boleh minta nomor resinya?",
        },
      ],
      requireCustomerConfirmation: true,
      enableMultimodalVision: false,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      connection: { name: "Kurir API" },
    }
    mockPrisma.aiActionIntent.findMany.mockImplementationOnce(
      async () => [mockRecord]
    )

    const res = await app.handle(
      new Request("http://localhost/console/ai/actions?agentProfileId=agent_1")
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      ok: boolean
      data: Array<{
        id: string
        name: string
        connectionName: string
        slots: Array<{ name: string }>
      }>
    }
    expect(body.ok).toBe(true)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].name).toBe("Cek Resi")
    expect(body.data[0].connectionName).toBe("Kurir API")
    expect(body.data[0].slots[0].name).toBe("resi")
  })

  it("POST / creates an action intent and returns 201", async () => {
    const mockCreated = {
      id: "act_new",
      organizationId: "org_test",
      agentProfileId: "agent_1",
      name: "Cek Stok",
      description: "Cek ketersediaan produk",
      connectionId: "conn_1",
      subpath: "/products/stock",
      method: "GET",
      slots: [
        {
          name: "sku",
          type: "STRING",
          required: true,
          inquiryQuestion: "Apa kode SKU atau nama barangnya?",
        },
      ],
      requireCustomerConfirmation: false,
      enableMultimodalVision: true,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      connection: { name: "ERP" },
    }
    mockPrisma.aiIntegrationConnection.findFirst.mockImplementationOnce(
      async () => ({ id: "conn_1", organizationId: "org_test" })
    )
    mockPrisma.aiAgentProfile.findFirst.mockImplementationOnce(
      async () => ({ id: "agent_1", organizationId: "org_test" })
    )
    mockPrisma.aiActionIntent.create.mockImplementationOnce(
      async () => mockCreated
    )

    const res = await app.handle(
      new Request("http://localhost/console/ai/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Cek Stok",
          agentProfileId: "agent_1",
          connectionId: "conn_1",
          subpath: "/products/stock",
          method: "GET",
          slots: [
            {
              name: "sku",
              type: "STRING",
              required: true,
              inquiryQuestion: "Apa kode SKU atau nama barangnya?",
            },
          ],
          requireCustomerConfirmation: false,
          enableMultimodalVision: true,
        }),
      })
    )
    expect(res.status).toBe(201)
    const body = (await res.json()) as {
      ok: boolean
      data: { id: string; name: string }
    }
    expect(body.ok).toBe(true)
    expect(body.data.id).toBe("act_new")
    expect(body.data.name).toBe("Cek Stok")
  })

  it("POST / rejects missing name with 422 validation error", async () => {
    const res = await app.handle(
      new Request("http://localhost/console/ai/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "",
        }),
      })
    )
    expect(res.status).toBe(422)
  })

  it("GET /:id returns 404 when action intent does not exist", async () => {
    mockPrisma.aiActionIntent.findFirst.mockImplementationOnce(
      async () => null
    )

    const res = await app.handle(
      new Request("http://localhost/console/ai/actions/act_missing")
    )
    expect(res.status).toBe(404)
    const body = (await res.json()) as { ok: boolean; error: string }
    expect(body.ok).toBe(false)
    expect(body.error).toBe("Action intent not found")
  })

  it("PATCH /:id updates action intent and returns 200", async () => {
    const mockExisting = {
      id: "act_1",
      organizationId: "org_test",
      name: "Old Name",
      description: null,
      connectionId: null,
      subpath: "/",
      method: "GET",
      slots: [],
      requireCustomerConfirmation: false,
      enableMultimodalVision: false,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    const mockUpdated = {
      ...mockExisting,
      name: "New Name",
      requireCustomerConfirmation: true,
      connection: null,
    }
    mockPrisma.aiActionIntent.findFirst.mockImplementationOnce(
      async () => mockExisting
    )
    mockPrisma.aiActionIntent.update.mockImplementationOnce(
      async () => mockUpdated
    )

    const res = await app.handle(
      new Request("http://localhost/console/ai/actions/act_1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "New Name",
          requireCustomerConfirmation: true,
        }),
      })
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      ok: boolean
      data: { name: string; requireCustomerConfirmation: boolean }
    }
    expect(body.ok).toBe(true)
    expect(body.data.name).toBe("New Name")
    expect(body.data.requireCustomerConfirmation).toBe(true)
  })

  it("DELETE /:id deletes action intent and returns 200", async () => {
    mockPrisma.aiActionIntent.deleteMany.mockImplementationOnce(
      async () => ({ count: 1 })
    )

    const res = await app.handle(
      new Request("http://localhost/console/ai/actions/act_1", {
        method: "DELETE",
      })
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean }
    expect(body.ok).toBe(true)
  })

  it("DELETE /:id returns 404 when intent not found to delete", async () => {
    mockPrisma.aiActionIntent.deleteMany.mockImplementationOnce(
      async () => ({ count: 0 })
    )

    const res = await app.handle(
      new Request("http://localhost/console/ai/actions/act_unknown", {
        method: "DELETE",
      })
    )
    expect(res.status).toBe(404)
    const body = (await res.json()) as { ok: boolean; error: string }
    expect(body.ok).toBe(false)
    expect(body.error).toBe("Action intent not found")
  })
})
