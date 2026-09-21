import { describe, it, expect, mock, beforeEach } from "bun:test"
mock.module("server-only", () => ({}))
// Mock WorkOS auth before imports
const mockAuth = mock(() =>
  Promise.resolve({
    user: { id: "user_1", organizationId: "org_1" },
    organizationId: "org_1",
  })
)
mock.module("@workos-inc/authkit-nextjs", () => ({
  withAuth: mockAuth,
}))

// Mock Prisma
const mockPrisma = {
  aiAgentProfile: {
    findMany: mock(),
    findFirst: mock(),
    create: mock(),
    update: mock(),
    delete: mock(),
  },
  aiChannelBinding: {
    upsert: mock(),
    findFirst: mock(),
    delete: mock(),
  },
}
mock.module("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

const { createConsoleAiAgentsRoutes } =
  await import("./console-ai-agents.route")

describe("Console AI Agents Route", () => {
  let app: ReturnType<typeof createConsoleAiAgentsRoutes>

  beforeEach(() => {
    mockAuth.mockClear()
    mockPrisma.aiAgentProfile.findMany.mockClear()
    mockPrisma.aiAgentProfile.findFirst.mockClear()
    mockPrisma.aiAgentProfile.create.mockClear()
    mockPrisma.aiAgentProfile.update.mockClear()
    mockPrisma.aiAgentProfile.delete.mockClear()
    mockPrisma.aiChannelBinding.upsert.mockClear()
    mockPrisma.aiChannelBinding.findFirst.mockClear()
    mockPrisma.aiChannelBinding.delete.mockClear()

    mockAuth.mockResolvedValue({
      user: { id: "user_1", organizationId: "org_1" },
      organizationId: "org_1",
    })

    app = createConsoleAiAgentsRoutes()
  })

  it("lists agent profiles with bound channels", async () => {
    mockPrisma.aiAgentProfile.findMany.mockResolvedValue([
      {
        id: "agent_1",
        name: "Asisten CS",
        description: "Customer service toko",
        systemPrompt: "Anda adalah CS resmi",
        fallbackMessage: "Maaf...",
        dailyUserLimit: 20,
        maxCharLength: 800,
        enableProfanityFilter: true,
        customBlockedWords: [],
        allowInteractiveReplies: true,
        allowedDomains: ["toko.co.id", "*.klinik.com"],
        widgetColor: "#2563EB",
        widgetPosition: "bottom-left",
        welcomeMessage: "Halo, ada yang bisa dibantu?",
        isActive: true,
        status: "ACTIVE",
        archivedAt: null,
        providerConfigId: null,
        providerConfig: null,
        channelBindings: [
          {
            id: "bind_1",
            channel: "WHATSAPP",
            targetId: "dev_123",
            targetName: "+62812345678",
            isActive: true,
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ])

    const res = await app.handle(
      new Request("http://localhost/console/ai/agents", { method: "GET" })
    )

    expect(res.status).toBe(200)
    const json = (await res.json()) as {
      ok: boolean
      data: {
        activeChannelsCount: number
        operationalStatus: string
        allowInteractiveReplies: boolean
        allowedDomains: string[]
        widgetColor: string
        widgetPosition: string
        welcomeMessage: string
      }[]
    }
    expect(json.ok).toBe(true)
    expect(json.data.length).toBe(1)
    expect(json.data[0].activeChannelsCount).toBe(1)
    expect(json.data[0].operationalStatus).toBe("ACTIVE")
    expect(json.data[0]).not.toHaveProperty("systemPrompt")
  })

  it("creates agent profile", async () => {
    mockPrisma.aiAgentProfile.create.mockResolvedValue({
      id: "agent_new",
      name: "Sales Assistant",
      description: "Membantu penjualan",
      systemPrompt: "Jual produk katalog",
      fallbackMessage: "Hubungi sales kami",
      dailyUserLimit: 30,
      enableProfanityFilter: true,
      allowInteractiveReplies: false,
      providerConfigId: null,
      isActive: false,
      status: "DRAFT",
      archivedAt: null,
      channelBindings: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const res = await app.handle(
      new Request("http://localhost/console/ai/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Sales Assistant",
          description: "Membantu penjualan",
          systemPrompt: "Jual produk katalog",
          allowInteractiveReplies: false,
          allowedDomains: ["shop.com"],
          widgetColor: "#7C3AED",
          widgetPosition: "bottom-right",
          welcomeMessage: "Halo kak!",
        }),
      })
    )

    expect(res.status).toBe(200)
    const json = (await res.json()) as { ok: boolean; data: { id: string } }
    expect(json.ok).toBe(true)
    expect(json.data.id).toBe("agent_new")
    expect(mockPrisma.aiAgentProfile.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        allowInteractiveReplies: false,
        allowedDomains: ["shop.com"],
        widgetColor: "#7C3AED",
        widgetPosition: "bottom-right",
        welcomeMessage: "Halo kak!",
        status: "DRAFT",
        isActive: false,
      }),
      include: expect.any(Object),
    })
  })

  it("rejects invalid widgetColor or widgetPosition on create", async () => {
    const resColor = await app.handle(
      new Request("http://localhost/console/ai/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Test Agent",
          widgetColor: "invalid-color-xss",
        }),
      })
    )
    expect(resColor.status).toBe(422)

    const resPos = await app.handle(
      new Request("http://localhost/console/ai/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Test Agent",
          widgetPosition: "top-center",
        }),
      })
    )
    expect(resPos.status).toBe(422)
  })

  it("updates agent profile including allowInteractiveReplies", async () => {
    mockPrisma.aiAgentProfile.findFirst.mockResolvedValue({
      id: "agent_1",
      organizationId: "org_1",
    })
    mockPrisma.aiAgentProfile.update.mockResolvedValue({
      id: "agent_1",
      name: "Updated Agent",
      allowInteractiveReplies: false,
      allowedDomains: ["*.example.com"],
      widgetColor: "#10B981",
      widgetPosition: "bottom-left",
      welcomeMessage: "Selamat datang!",
    })

    const res = await app.handle(
      new Request("http://localhost/console/ai/agents/agent_1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Updated Agent",
          allowInteractiveReplies: false,
          allowedDomains: ["*.example.com"],
          widgetColor: "#10B981",
          widgetPosition: "bottom-left",
          welcomeMessage: "Selamat datang!",
        }),
      })
    )

    expect(res.status).toBe(200)
    const json = (await res.json()) as { ok: boolean; data: { id: string } }
    expect(json.ok).toBe(true)
    expect(mockPrisma.aiAgentProfile.update).toHaveBeenCalledWith({
      where: { id: "agent_1" },
      data: expect.objectContaining({
        name: "Updated Agent",
        allowInteractiveReplies: false,
        allowedDomains: ["*.example.com"],
        widgetColor: "#10B981",
        widgetPosition: "bottom-left",
        welcomeMessage: "Selamat datang!",
      }),
    })
  })

  it("binds agent to a channel", async () => {
    mockPrisma.aiAgentProfile.findFirst.mockResolvedValue({
      id: "agent_1",
      organizationId: "org_1",
    })
    mockPrisma.aiChannelBinding.upsert.mockResolvedValue({
      id: "bind_wa",
      agentProfileId: "agent_1",
      channel: "WHATSAPP",
      targetId: "dev_wa_01",
      targetName: "CS Utama (+6281111)",
      isActive: true,
    })

    const res = await app.handle(
      new Request("http://localhost/console/ai/agents/agent_1/bindings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "WHATSAPP",
          targetId: "dev_wa_01",
          targetName: "CS Utama (+6281111)",
        }),
      })
    )

    expect(res.status).toBe(200)
    const json = (await res.json()) as { ok: boolean; data: { id: string } }
    expect(json.ok).toBe(true)
    expect(mockPrisma.aiChannelBinding.upsert).toHaveBeenCalled()
  })

  it("unbinds agent from a channel", async () => {
    mockPrisma.aiChannelBinding.findFirst.mockResolvedValue({
      id: "bind_wa",
      agentProfileId: "agent_1",
      organizationId: "org_1",
    })
    mockPrisma.aiChannelBinding.delete.mockResolvedValue({
      id: "bind_wa",
    })

    const res = await app.handle(
      new Request(
        "http://localhost/console/ai/agents/agent_1/bindings/bind_wa",
        {
          method: "DELETE",
        }
      )
    )

    expect(res.status).toBe(200)
    const json = (await res.json()) as { ok: boolean }
    expect(json.ok).toBe(true)
    expect(mockPrisma.aiChannelBinding.delete).toHaveBeenCalledWith({
      where: { id: "bind_wa" },
    })
  })

  it("rejects activation without an active channel", async () => {
    mockPrisma.aiAgentProfile.findFirst.mockResolvedValue({
      id: "agent_1",
      organizationId: "org_1",
      status: "DRAFT",
      channelBindings: [],
    })

    const res = await app.handle(
      new Request("http://localhost/console/ai/agents/agent_1/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ACTIVE" }),
      })
    )

    expect(res.status).toBe(409)
    expect(await res.json()).toEqual(
      expect.objectContaining({ error: "AGENT_REQUIRES_ACTIVE_BINDING" })
    )
    expect(mockPrisma.aiAgentProfile.update).not.toHaveBeenCalled()
  })

  it("pauses an agent and synchronizes runtime state", async () => {
    const agent = {
      id: "agent_1",
      organizationId: "org_1",
      name: "Support",
      description: null,
      systemPrompt: "Help customers",
      status: "ACTIVE",
      channelBindings: [
        {
          id: "binding_1",
          channel: "WHATSAPP",
          targetId: "device_1",
          targetName: "Support",
          isActive: true,
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    mockPrisma.aiAgentProfile.findFirst.mockResolvedValue(agent)
    mockPrisma.aiAgentProfile.update.mockResolvedValue({
      ...agent,
      status: "PAUSED",
      isActive: false,
    })

    const res = await app.handle(
      new Request("http://localhost/console/ai/agents/agent_1/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PAUSED" }),
      })
    )

    expect(res.status).toBe(200)
    expect(mockPrisma.aiAgentProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "PAUSED", isActive: false }),
      })
    )
  })

  it("rejects deleting an agent with an active binding", async () => {
    mockPrisma.aiAgentProfile.findFirst.mockResolvedValue({
      id: "agent_1",
      organizationId: "org_1",
      channelBindings: [{ id: "binding_1" }],
    })

    const res = await app.handle(
      new Request("http://localhost/console/ai/agents/agent_1", {
        method: "DELETE",
      })
    )

    expect(res.status).toBe(409)
    expect(await res.json()).toEqual(
      expect.objectContaining({ error: "AGENT_HAS_ACTIVE_BINDINGS" })
    )
    expect(mockPrisma.aiAgentProfile.delete).not.toHaveBeenCalled()
  })
})
