import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"

import { createKnowledgeRoutes } from "@/modules/docs/api/knowledge.route"

const mockAuthenticate = mock(async (): Promise<import("@/modules/docs/api/knowledge.route").KnowledgeAuthContext> => ({
  organizationId: "org_1",
  user: {
    id: "user_1",
    email: "member@example.com",
  },
}))
const mockSearchKnowledgeDocs = mock(async () => [] as import("@/modules/docs/docs.service").KnowledgeDocMatch[])
const mockStreamKnowledgeAnswer = mock(async function* () {
  yield "Hello "
  yield "from KB"
})

const createApp = () =>
  new Elysia().use(
    createKnowledgeRoutes({
      authenticate: mockAuthenticate,
      searchKnowledgeDocs: mockSearchKnowledgeDocs,
      streamKnowledgeAnswer: mockStreamKnowledgeAnswer,
    })
  )

beforeEach(() => {
  mockAuthenticate.mockReset()
  mockSearchKnowledgeDocs.mockReset()
  mockStreamKnowledgeAnswer.mockReset()

  mockAuthenticate.mockImplementation(async (): Promise<import("@/modules/docs/api/knowledge.route").KnowledgeAuthContext> => ({
    organizationId: "org_1",
    user: {
      id: "user_1",
      email: "member@example.com",
    },
  }))

  mockSearchKnowledgeDocs.mockImplementation(async () => [
    {
      id: "doc_1",
      organizationId: "org_1" as const,
      path: "/console",
      title: "Console Overview",
      purpose: "Manage console",
      howTo: ["Open console"],
      notes: ["Use sidebar"],
      updatedAt: "2026-05-22",
      score: 50,
    },
  ] as import("@/modules/docs/docs.service").KnowledgeDocMatch[])

  mockStreamKnowledgeAnswer.mockImplementation(async function* () {
    yield "Hello "
    yield "from KB"
  })
})

describe("knowledgeRoutes", () => {
  it("returns 401 when user is not signed in", async () => {
    mockAuthenticate.mockImplementationOnce(async (): Promise<import("@/modules/docs/api/knowledge.route").KnowledgeAuthContext> => ({
      organizationId: "org_1",
      user: null,
    }))

    const response = await createApp().handle(
      new Request("http://localhost/knowledge/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          routePath: "/console",
          messages: [{ role: "user", content: "How to use console?" }],
        }),
      })
    )
    const body = (await response.json()) as { ok: boolean; error: string }

    expect(response.status).toBe(401)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("UNAUTHORIZED")
  })

  it("streams chat response and final citations", async () => {
    const response = await createApp().handle(
      new Request("http://localhost/knowledge/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          routePath: "/console",
          messages: [{ role: "user", content: "How to use console?" }],
        }),
      })
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toContain(
      "application/x-ndjson"
    )

    const bodyText = await response.text()
    const frames = bodyText
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as Record<string, unknown>)

    expect(frames[0]?.type).toBe("delta")
    expect(frames[1]?.type).toBe("delta")
    expect(frames[2]?.type).toBe("done")
    expect(frames[2]?.answer).toBe("Hello from KB")
    expect(Array.isArray(frames[2]?.citations)).toBe(true)
  })

  it("returns strict fallback when no relevant knowledge context", async () => {
    mockSearchKnowledgeDocs.mockResolvedValueOnce([] as import("@/modules/docs/docs.service").KnowledgeDocMatch[])

    const response = await createApp().handle(
      new Request("http://localhost/knowledge/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          routePath: "/console",
          messages: [{ role: "user", content: "Unknown question?" }],
        }),
      })
    )

    const bodyText = await response.text()
    const frames = bodyText
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as Record<string, unknown>)

    expect(frames[0]?.type).toBe("delta")
    expect(frames[1]?.type).toBe("done")
    expect(frames[1]?.answer).toBe(
      "I don't know from the current knowledgebase."
    )
  })

  it("returns validation envelope for invalid request payload", async () => {
    const response = await createApp().handle(
      new Request("http://localhost/knowledge/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          routePath: "   ",
          messages: [{ role: "user", content: "help" }],
        }),
      })
    )
    const body = (await response.json()) as {
      ok: boolean
      error: string
      fieldErrors?: Record<string, string[]>
    }

    expect(response.status).toBe(422)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("VALIDATION_ERROR")
    expect(body.fieldErrors?.routePath?.length).toBeGreaterThan(0)
  })
})
