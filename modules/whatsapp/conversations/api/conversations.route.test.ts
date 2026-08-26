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

const mockFindMany = mock(async (_args: unknown) => [])
const mockFindFirst = mock(async (_args: unknown) => null)
const mockUpdate = mock(async (_args: unknown) => ({}))
const mockCreate = mock(async (_args: unknown) => ({}))
const mockDelete = mock(async (_args: unknown) => ({}))
const mockActivityCreate = mock(async (_args: unknown) => ({}))
const mockActivityCreateMany = mock(async (_args: unknown) => ({ count: 1 }))
const mockNoteCreate = mock(async (args: unknown) => {
  const typed = args as { data?: { body?: string; mentions?: string[] } }
  return {
    id: "note-1",
    body: typed?.data?.body || "",
    mentions: typed?.data?.mentions || [],
  }
})
const mockTransaction = mock(async (fn: (tx: unknown) => Promise<unknown>) => {
  return fn({
    whatsappConversation: { update: mockUpdate },
    whatsappConversationLabelOnConversation: {
      deleteMany: mock(async () => ({ count: 0 })),
      createMany: mock(async () => ({ count: 0 })),
    },
    whatsappConversationNote: { create: mockNoteCreate },
    whatsappConversationActivity: {
      create: mockActivityCreate,
      createMany: mockActivityCreateMany,
    },
  })
})

mock.module("@/lib/prisma", () => ({
  prisma: {
    whatsappConversation: {
      findMany: mockFindMany,
      findFirst: mockFindFirst,
      update: mockUpdate,
      create: mockCreate,
      delete: mockDelete,
    },
    whatsappConversationLabel: {
      findMany: mock(async () => []),
    },
    whatsappConversationNote: {
      create: mockNoteCreate,
    },
    whatsappConversationActivity: {
      create: mockActivityCreate,
      createMany: mockActivityCreateMany,
    },
    $transaction: mockTransaction,
  },
}))

const { conversationsRoutes } = await import("./conversations.route")

function createTestApp() {
  return new Elysia().use(conversationsRoutes)
}

beforeEach(() => {
  mockAuth.current = null
  mockFindMany.mockReset()
  mockFindFirst.mockReset()
  mockUpdate.mockReset()
  mockCreate.mockReset()
  mockActivityCreate.mockReset()
  mockActivityCreateMany.mockReset()
  mockActivityCreateMany.mockResolvedValue({ count: 1 })
  mockNoteCreate.mockReset()
  mockNoteCreate.mockImplementation(async (args: unknown) => {
    const typed = args as { data?: { body?: string; mentions?: string[] } }
    return {
      id: "note-1",
      body: typed?.data?.body || "",
      mentions: typed?.data?.mentions || [],
    }
  })
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
      expect(args.where.OR).toBeDefined()
      expect(args.where.OR).toEqual([
        { contactPhone: { contains: "6285708296482" } },
        { contactPhone: { contains: "+6285708296482" } },
        { contactPhone: { contains: "6285708296482" } },
      ])
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

  it("filters conversations by lifecycle status, stage, and unreadOnly", async () => {
    mockAuth.current = {
      type: "session",
      userId: "user-1",
      organizationId: "org-1",
      orgRole: "admin",
      platformRole: "member",
    }

    const app = createTestApp()
    const res = await app.handle(
      new Request(
        "http://localhost/conversations?lifecycleStatus=OPEN&stage=QUALIFIED&unreadOnly=true"
      )
    )

    expect(res.status).toBe(200)
    expect(mockFindMany).toHaveBeenCalledTimes(1)
    const callArgs = mockFindMany.mock.calls[0][0] as {
      where: Record<string, unknown>
    }
    expect(callArgs.where.organizationId).toBe("org-1")
    expect(callArgs.where.status).toBe("OPEN")
    expect(callArgs.where.stage).toBe("QUALIFIED")
    expect(callArgs.where.lastDirection).toBe("INBOX")
  })

  it("records activity when updating conversation status and stage", async () => {
    mockAuth.current = {
      type: "session",
      userId: "user-1",
      organizationId: "org-1",
      orgRole: "admin",
      platformRole: "member",
    }

    mockFindFirst.mockResolvedValueOnce({
      id: "conv-1",
      organizationId: "org-1",
      status: "OPEN",
      stage: "NEW",
    })

    mockUpdate.mockResolvedValueOnce({
      id: "conv-1",
      status: "RESOLVED",
      stage: "WON",
    })

    const app = createTestApp()
    const res = await app.handle(
      new Request("http://localhost/conversations/conv-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "RESOLVED",
          stage: "WON",
        }),
      })
    )

    expect(res.status).toBe(200)
    expect(mockActivityCreateMany).toHaveBeenCalledTimes(1)
    const activitiesArgs = mockActivityCreateMany.mock.calls[0][0] as {
      data: Array<{ type: string; fromValue?: string; toValue?: string }>
    }
    expect(activitiesArgs.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "STATUS_CHANGE",
          fromValue: "OPEN",
          toValue: "RESOLVED",
        }),
        expect.objectContaining({
          type: "STAGE_CHANGE",
          fromValue: "NEW",
          toValue: "WON",
        }),
      ])
    )
  })

  it("extracts mentions and records activity on note creation", async () => {
    mockAuth.current = {
      type: "session",
      userId: "user-1",
      organizationId: "org-1",
      orgRole: "admin",
      platformRole: "member",
    }

    mockFindFirst.mockResolvedValueOnce({
      id: "conv-1",
      organizationId: "org-1",
    })

    const app = createTestApp()
    const res = await app.handle(
      new Request("http://localhost/conversations/conv-1/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: "Hello @alice and @bob please follow up",
          authorName: "John",
        }),
      })
    )
    const text = await res.text()
    if (res.status !== 200) {
      console.log("Response text:", text)
    }
    expect(res.status).toBe(200)
    expect(mockNoteCreate).toHaveBeenCalledTimes(1)
    const noteArgs = mockNoteCreate.mock.calls[0][0] as {
      data: { body: string; mentions: string[] }
    }
    expect(noteArgs.data.mentions).toEqual(["alice", "bob"])
    expect(mockActivityCreate).toHaveBeenCalledTimes(1)
  })

  it("enforces tenant isolation across organizations", async () => {
    mockAuth.current = {
      type: "session",
      userId: "user-1",
      organizationId: "org-1",
      orgRole: "admin",
      platformRole: "member",
    }

    // Mock findFirst returning null because conversation belongs to org-2
    mockFindFirst.mockResolvedValueOnce(null)

    const app = createTestApp()
    const res = await app.handle(
      new Request("http://localhost/conversations/conv-foreign", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "RESOLVED" }),
      })
    )

    expect(res.status).toBe(404)
    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "conv-foreign", organizationId: "org-1" },
      })
    )
  })
})
