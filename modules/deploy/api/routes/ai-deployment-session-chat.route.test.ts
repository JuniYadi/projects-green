import { describe, expect, it, mock } from "bun:test"

mock.module("server-only", () => ({}))
mock.module("@/lib/prisma", () => ({ prisma: {} }))

const { AiDeploymentSessionError } =
  await import("@/modules/deploy/ai-deployment-session.service")

const { createAiDeploymentSessionChatRoutes } =
  await import("./ai-deployment-session-chat.route")

type AiSessionChatService =
  import("@/modules/deploy/services/ai-session-chat.service").AiSessionChatService

const createMockService = (
  overrides: Partial<Record<string, unknown>> = {}
) => ({
  handleSessionChat: mock(async () => {
    async function* textStream() {
      yield "Halo dari Tanya P! Blueprint siap."
    }
    const encoder = new TextEncoder()
    return {
      sessionId: "session-1",
      textStream: textStream(),
      fullStream: (async function* () {
        yield {
          type: "text-delta" as const,
          text: "Halo dari Tanya P! Blueprint siap.",
        }
        yield { type: "finish" as const, finishReason: "stop" }
      })(),
      events: [],
      toResponse: () =>
        new Response(
          new ReadableStream({
            async start(controller) {
              controller.enqueue(
                encoder.encode("Halo dari Tanya P! Blueprint siap.")
              )
              controller.close()
            },
          }),
          {
            headers: { "content-type": "text/plain; charset=utf-8" },
          }
        ),
      toTextStreamResponse: () =>
        new Response("Halo dari Tanya P! Blueprint siap."),
      [Symbol.asyncIterator]() {
        return textStream()[Symbol.asyncIterator]()
      },
    }
  }),
  ...overrides,
})

const request = (path: string, body?: unknown) =>
  new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

describe("aiDeploymentSessionChatRoutes", () => {
  it("rejects unauthenticated requests with 401", async () => {
    const app = createAiDeploymentSessionChatRoutes({
      requireActor: async (set) => {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Unauthorized" }
      },
      service: createMockService() as unknown as AiSessionChatService,
    })

    const response = await app.handle(
      request("/deploy/ai-sessions/session-1/chat", { message: "halo" })
    )
    expect(response.status).toBe(401)
  })

  it("rejects tenant members without deploy management access with 403", async () => {
    const app = createAiDeploymentSessionChatRoutes({
      requireActor: async () => ({
        userId: "user-1",
        organizationId: "org-1",
        platformRole: "none",
        tenantRole: "member",
      }),
      service: createMockService() as unknown as AiSessionChatService,
    })

    const response = await app.handle(
      request("/deploy/ai-sessions/session-1/chat", { message: "halo" })
    )
    expect(response.status).toBe(403)
  })

  it("returns 404 when session is not found", async () => {
    const service = createMockService({
      handleSessionChat: mock(async () => {
        throw new AiDeploymentSessionError("NOT_FOUND")
      }),
    })

    const app = createAiDeploymentSessionChatRoutes({
      requireActor: async () => ({
        userId: "user-1",
        organizationId: "org-1",
        platformRole: "none",
        tenantRole: "admin",
      }),
      service: service as unknown as AiSessionChatService,
    })

    const response = await app.handle(
      request("/deploy/ai-sessions/session-404/chat", { message: "halo" })
    )
    expect(response.status).toBe(404)
    const body = (await response.json()) as { error: string }
    expect(body.error).toBe("NOT_FOUND")
  })

  it("returns 422 when body is invalid (missing message)", async () => {
    const app = createAiDeploymentSessionChatRoutes({
      requireActor: async () => ({
        userId: "user-1",
        organizationId: "org-1",
        platformRole: "none",
        tenantRole: "admin",
      }),
      service: createMockService() as unknown as AiSessionChatService,
    })

    const response = await app.handle(
      request("/deploy/ai-sessions/session-1/chat", {})
    )
    expect(response.status).toBe(422)
  })

  it("streams chat response successfully for authorized tenant admin", async () => {
    const service = createMockService()
    const app = createAiDeploymentSessionChatRoutes({
      requireActor: async () => ({
        userId: "user-1",
        organizationId: "org-1",
        platformRole: "none",
        tenantRole: "admin",
      }),
      service: service as unknown as AiSessionChatService,
    })

    const response = await app.handle(
      request("/deploy/ai-sessions/session-1/chat", {
        message: "Ganti port ke 8080",
        messages: [{ role: "user", content: "Ganti port ke 8080" }],
      })
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toContain("text/plain")

    const text = await response.text()
    expect(text).toContain("Halo dari Tanya P! Blueprint siap.")

    expect(service.handleSessionChat).toHaveBeenCalledWith({
      actor: { organizationId: "org-1", userId: "user-1" },
      sessionId: "session-1",
      message: "Ganti port ke 8080",
      messages: [{ role: "user", content: "Ganti port ke 8080" }],
    })
  })
})
