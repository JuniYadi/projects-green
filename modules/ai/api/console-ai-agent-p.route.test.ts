import { beforeEach, describe, expect, it, mock } from "bun:test"

mock.module("server-only", () => ({}))

const mockAuth = mock(() =>
  Promise.resolve({ user: { id: "user-1" }, organizationId: "org-1" })
)
mock.module("@workos-inc/authkit-nextjs", () => ({ withAuth: mockAuth }))

const mockPrisma = { aiUsageAudit: { create: mock() } }
mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }))

const { createConsoleAiAgentPRoutes } =
  await import("./console-ai-agent-p.route")

describe("Console AI Agent P route", () => {
  beforeEach(() => {
    mockAuth.mockResolvedValue({
      user: { id: "user-1" },
      organizationId: "org-1",
    })
    mockPrisma.aiUsageAudit.create.mockReset()
  })

  it("rejects unauthenticated execution", async () => {
    mockAuth.mockResolvedValueOnce({
      user: null as never,
      organizationId: null as never,
    })
    const response = await createConsoleAiAgentPRoutes().handle(
      new Request("http://localhost/console/ai/agent-p/execute", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ toolName: "unknown", input: {} }),
      })
    )
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({
      success: false,
      error: "UNAUTHORIZED",
    })
  })

  it("returns a safe not-found response for unknown tools", async () => {
    const response = await createConsoleAiAgentPRoutes().handle(
      new Request("http://localhost/console/ai/agent-p/execute", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ toolName: "unknown", input: {} }),
      })
    )
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({
      success: false,
      error: "TOOL_NOT_FOUND",
    })
  })

  it("executes a registered tool successfully", async () => {
    const response = await createConsoleAiAgentPRoutes().handle(
      new Request("http://localhost/console/ai/agent-p/execute", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          toolName: "whatsapp.contact.normalize",
          input: { phoneNumber: "0812345678", defaultCountryCode: "62" },
        }),
      })
    )
    expect(response.status).toBe(200)
    const data = (await response.json()) as {
      success: boolean
      data: { normalized: string; isValid: boolean }
    }
    expect(data.success).toBe(true)
    expect(data.data.normalized).toBe("+62812345678")
  })

  it("handles execution errors safely", async () => {
    const response = await createConsoleAiAgentPRoutes().handle(
      new Request("http://localhost/console/ai/agent-p/execute", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          toolName: "whatsapp.contact.normalize",
          input: { phoneNumber: "", defaultCountryCode: "62" },
        }),
      })
    )
    expect(response.status).toBe(400)
    const data = (await response.json()) as { success: boolean; error: string }
    expect(data.success).toBe(false)
    expect(data.error).toBeDefined()
  })
})
