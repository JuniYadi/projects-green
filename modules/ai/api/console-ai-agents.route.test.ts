import { describe, it, expect, mock, beforeEach } from "bun:test"
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
  },
}
mock.module("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

import { createConsoleAiAgentsRoutes } from "./console-ai-agents.route"

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
        isActive: true,
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
        knowledgeDocs: [],
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
      data: { channelsCount: number }[]
    }
    expect(json.ok).toBe(true)
    expect(json.data.length).toBe(1)
    expect(json.data[0].channelsCount).toBe(1)
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
      providerConfigId: null,
      isActive: true,
    })

    const res = await app.handle(
      new Request("http://localhost/console/ai/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Sales Assistant",
          description: "Membantu penjualan",
          systemPrompt: "Jual produk katalog",
        }),
      })
    )

    expect(res.status).toBe(200)
    const json = (await res.json()) as { ok: boolean; data: { id: string } }
    expect(json.ok).toBe(true)
    expect(json.data.id).toBe("agent_new")
    expect(mockPrisma.aiAgentProfile.create).toHaveBeenCalled()
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
})
