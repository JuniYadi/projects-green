import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"

// ─── Auth mock ────────────────────────────────────────────────────────────

const mockAuth = {
  current: null as {
    type: string
    userId: string
    organizationId: string | null
    orgRole: string | null
    platformRole: string
  } | null,
}

mock.module("@/lib/auth/resolve-proxy-auth", () => ({
  resolveAuthContext: async () => mockAuth.current,
}))

// ─── Prisma mock ──────────────────────────────────────────────────────────

const mockFindMany = mock(async (args: any) => [])

mock.module("@/lib/prisma", () => ({
  prisma: {
    whatsappConversation: {
      findMany: mockFindMany,
    },
  },
}))

const { conversationsRoutes } = await import("./conversations.route")

function createTestApp() {
  return new Elysia().use(conversationsRoutes)
}

beforeEach(() => {
  mockAuth.current = null
  mockFindMany.mockReset()
})

describe("conversations routes", () => {
  it("returns 403 when auth has no organization", async () => {
    mockAuth.current = {
      type: "workos",
      userId: "user_1",
      organizationId: null,
      orgRole: null,
      platformRole: "none",
    }

    const app = createTestApp()
    const res = await app.handle(new Request("http://localhost/conversations"))

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body).toEqual({
      ok: false,
      error: "FORBIDDEN",
      message: "No active organization found.",
    })
    expect(mockFindMany).not.toHaveBeenCalled()
  })

  it("returns 401 when no auth context", async () => {
    mockAuth.current = null

    const app = createTestApp()
    const res = await app.handle(new Request("http://localhost/conversations"))

    expect(res.status).toBe(401)
  })

  it("clamps limit to MAX_CONVERSATION_LIMIT and passes organizationId", async () => {
    mockAuth.current = {
      type: "workos",
      userId: "user_1",
      organizationId: "org_1",
      orgRole: "admin",
      platformRole: "none",
    }
    mockFindMany.mockImplementation(async (args: any) => {
      expect(args.where.organizationId).toBe("org_1")
      expect(args.where.contactPhone?.contains).toBe("6285708296482")
      expect(args.take).toBe(100)
      return []
    })

    const app = createTestApp()
    const res = await app.handle(
      new Request(
        "http://localhost/conversations?contactPhone=6285708296482&limit=500"
      )
    )

    expect(res.status).toBe(200)
    // findMany was called with the assertions inside the mock
    expect(mockFindMany).toHaveBeenCalledTimes(1)
  })

  it("uses default limit when no limit param provided", async () => {
    mockAuth.current = {
      type: "workos",
      userId: "user_1",
      organizationId: "org_1",
      orgRole: "admin",
      platformRole: "none",
    }
    mockFindMany.mockImplementation(async (args: any) => {
      expect(args.take).toBe(50)
      return []
    })

    const app = createTestApp()
    const res = await app.handle(new Request("http://localhost/conversations"))

    expect(res.status).toBe(200)
    expect(mockFindMany).toHaveBeenCalledTimes(1)
  })
})
