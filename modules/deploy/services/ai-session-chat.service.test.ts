import { beforeEach, describe, expect, it, mock } from "bun:test"
import type { AiDeploymentSession, PrismaClient } from "@prisma/client"

mock.module("@/lib/prisma", () => ({ prisma: {} }))

const {
  AiSessionChatService,
  createBlueprintMutationTools,
  defaultAiSessionChatService,
  extractBlueprintFromSession,
  handleSessionChat,
  persistBlueprintToDb,
  TANYA_P_SYSTEM_PROMPT,
} = await import("./ai-session-chat.service")

const { AiDeploymentSessionError } =
  await import("@/modules/deploy/ai-deployment-session.service")

const sampleSession = (
  overrides: Partial<AiDeploymentSession> = {}
): AiDeploymentSession => ({
  id: "session-1",
  organizationId: "org-1",
  workosUserId: "user-1",
  status: "PLAN_READY",
  sourceType: "SOURCE",
  stackId: null,
  deploymentId: null,
  currentPlanVersion: 1,
  currentPlanHash: "hash-123",
  plan: {
    version: 1,
    detection: {
      port: 3000,
      commands: ["pnpm build", "pnpm start"],
      runtime: "nodejs",
      framework: "nextjs",
    },
    resources: {
      package: "starter",
    },
    domain: {
      hostname: "my-app",
    },
  },
  serverContext: {
    blueprint: {
      port: 3000,
      startCommand: "pnpm start",
      computeTier: "starter",
      subdomain: "my-app",
      rootDirectory: "./",
      environmentVariables: [{ key: "NODE_ENV", value: "production" }],
    },
  },
  executionRefs: null,
  blockedReason: null,
  confirmedBy: null,
  confirmedAt: null,
  confirmationPlanHash: null,
  idempotencyKey: null,
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  createdAt: new Date("2026-09-18T00:00:00.000Z"),
  updatedAt: new Date("2026-09-18T00:00:00.000Z"),
  ...overrides,
})

describe("AiSessionChatService", () => {
  let mockDb: {
    aiDeploymentSession: {
      findFirst: ReturnType<typeof mock>
      findUnique: ReturnType<typeof mock>
      update: ReturnType<typeof mock>
    }
  }

  beforeEach(() => {
    mockDb = {
      aiDeploymentSession: {
        findFirst: mock(async () => sampleSession()),
        findUnique: mock(async () => sampleSession()),
        update: mock(async () => sampleSession()),
      },
    }
  })

  describe("extractBlueprintFromSession", () => {
    it("extracts blueprint from session.blueprint or serverContext.blueprint", () => {
      const sessionWithDirectBp = {
        blueprint: {
          port: 8080,
          startCommand: "node server.js",
          computeTier: "medium",
        },
      }
      const bp = extractBlueprintFromSession(sessionWithDirectBp)
      expect(bp.port).toBe(8080)
      expect(bp.startCommand).toBe("node server.js")
      expect(bp.computeTier).toBe("medium")
    })

    it("extracts blueprint from initialPlan if blueprint is not present", () => {
      const sessionWithInitialPlan = {
        initialPlan: {
          port: 5000,
          startCommand: "python app.py",
        },
      }
      const bp = extractBlueprintFromSession(sessionWithInitialPlan)
      expect(bp.port).toBe(5000)
      expect(bp.startCommand).toBe("python app.py")
    })

    it("extracts blueprint from structured plan object", () => {
      const sessionWithPlan = {
        plan: {
          detection: {
            port: 4000,
            commands: ["build", "npm run serve"],
          },
          resources: { package: "pro" },
          domain: { hostname: "test-app" },
        },
      }
      const bp = extractBlueprintFromSession(sessionWithPlan)
      expect(bp.port).toBe(4000)
      expect(bp.startCommand).toBe("npm run serve")
      expect(bp.computeTier).toBe("pro")
      expect(bp.subdomain).toBe("test-app")
    })
  })

  describe("access control and session validation", () => {
    it("throws NOT_FOUND if session does not exist or org mismatch", async () => {
      mockDb.aiDeploymentSession.findFirst.mockImplementation(async () => null)
      const service = new AiSessionChatService({
        db: mockDb as unknown as PrismaClient,
      })

      expect(
        service.handleSessionChat({
          actor: { organizationId: "other-org", userId: "user-1" },
          sessionId: "session-1",
          message: "Halo",
        })
      ).rejects.toThrow(AiDeploymentSessionError)
    })

    it("throws SESSION_EXPIRED if session expiration has passed", async () => {
      mockDb.aiDeploymentSession.findFirst.mockImplementation(async () =>
        sampleSession({
          expiresAt: new Date(Date.now() - 1000),
        })
      )
      const service = new AiSessionChatService({
        db: mockDb as unknown as PrismaClient,
      })

      expect(
        service.handleSessionChat({
          actor: { organizationId: "org-1", userId: "user-1" },
          sessionId: "session-1",
          message: "Halo",
        })
      ).rejects.toThrow(AiDeploymentSessionError)
    })
  })

  describe("createBlueprintMutationTools", () => {
    it("executes update_blueprint_field tool and mutates port and startCommand in memory and DB", async () => {
      const activeBlueprint = {
        port: 3000,
        startCommand: "npm start",
      }
      const tools = createBlueprintMutationTools({
        sessionId: "session-1",
        activeBlueprint,
        db: mockDb as unknown as PrismaClient,
      })

      const exec = tools.update_blueprint_field.execute as unknown as (
        args: {
          field: "port" | "startCommand" | "computeTier"
          value: string | number
          reason?: string
        },
        ctx?: unknown
      ) => Promise<{
        success: boolean
        field: string
        value: unknown
        blueprint: typeof activeBlueprint
      }>

      // 1. Update port
      const portResult = await exec({
        field: "port",
        value: 8080,
        reason: "User requested port 8080",
      })
      expect(portResult.success).toBe(true)
      expect(activeBlueprint.port).toBe(8080)
      expect(mockDb.aiDeploymentSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "session-1" },
        })
      )

      // 2. Update startCommand
      const startResult = await exec({
        field: "startCommand",
        value: "pnpm run start:prod",
      })
      expect(startResult.success).toBe(true)
      expect(activeBlueprint.startCommand).toBe("pnpm run start:prod")
      expect(mockDb.aiDeploymentSession.update).toHaveBeenCalledTimes(2)
    })

    it("executes update_blueprint_field for computeTier, subdomain, and rootDirectory", async () => {
      const activeBlueprint = {}
      const tools = createBlueprintMutationTools({
        sessionId: "session-1",
        activeBlueprint,
        db: mockDb as unknown as PrismaClient,
      })

      const exec = tools.update_blueprint_field.execute as unknown as (
        args: {
          field: "computeTier" | "subdomain" | "rootDirectory"
          value: string
        },
        ctx?: unknown
      ) => Promise<{ success: boolean; blueprint: typeof activeBlueprint }>

      await exec({ field: "computeTier", value: "medium" })
      expect((activeBlueprint as { computeTier: string }).computeTier).toBe(
        "medium"
      )

      await exec({ field: "subdomain", value: "green-app" })
      expect((activeBlueprint as { subdomain: string }).subdomain).toBe(
        "green-app"
      )

      await exec({ field: "rootDirectory", value: "./apps/frontend" })
      expect((activeBlueprint as { rootDirectory: string }).rootDirectory).toBe(
        "./apps/frontend"
      )
    })

    it("normalizes NaN port to default 3000", async () => {
      const activeBlueprint = { port: 8080 }
      const tools = createBlueprintMutationTools({
        sessionId: "session-1",
        activeBlueprint,
        db: mockDb as unknown as PrismaClient,
      })

      const exec = tools.update_blueprint_field.execute as unknown as (
        args: { field: "port"; value: unknown },
        ctx?: unknown
      ) => Promise<{ success: boolean; value: number }>

      const res = await exec({ field: "port", value: "not-a-number" })
      expect(res.value).toBe(3000)
      expect(activeBlueprint.port).toBe(3000)
    })

    it("executes add_environment_variable tool and persists to DB", async () => {
      const activeBlueprint = {
        environmentVariables: [],
      }
      const tools = createBlueprintMutationTools({
        sessionId: "session-1",
        activeBlueprint,
        db: mockDb as unknown as PrismaClient,
      })

      const exec = tools.add_environment_variable.execute as (
        args: { key: string; value: string; isSecret?: boolean },
        ctx?: unknown
      ) => Promise<{
        success: boolean
        key: string
        isSecret: boolean
        blueprint: typeof activeBlueprint
      }>

      // Add normal env var
      const res1 = await exec({
        key: "DATABASE_URL",
        value: "postgres://localhost:5432/db",
        isSecret: false,
      })
      expect(res1.success).toBe(true)
      expect(res1.key).toBe("DATABASE_URL")
      expect(res1.isSecret).toBe(false)
      expect(activeBlueprint.environmentVariables).toHaveLength(1)

      // Add secret env var
      const res2 = await exec({
        key: "JWT_SECRET",
        value: "supersecret",
        isSecret: true,
      })
      expect(res2.success).toBe(true)
      expect(res2.isSecret).toBe(true)
      expect(activeBlueprint.environmentVariables).toHaveLength(2)

      // Update existing env var
      await exec({
        key: "DATABASE_URL",
        value: "postgres://production:5432/db",
      })
      expect(activeBlueprint.environmentVariables).toHaveLength(2)
      expect(
        (
          activeBlueprint.environmentVariables as Array<{
            key: string
            value: string
          }>
        )[0].value
      ).toBe("postgres://production:5432/db")

      expect(mockDb.aiDeploymentSession.update).toHaveBeenCalledTimes(3)
    })
  })

  describe("persistBlueprintToDb", () => {
    it("updates serverContext and plan in database", async () => {
      await persistBlueprintToDb(
        mockDb as unknown as PrismaClient,
        "session-1",
        {
          port: 9000,
          startCommand: "npm run start",
          computeTier: "pro",
        }
      )

      expect(mockDb.aiDeploymentSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "session-1" },
          data: expect.objectContaining({
            plan: expect.anything(),
            serverContext: expect.anything(),
          }),
        })
      )
    })

    it("handles non-existent session in persistBlueprintToDb gracefully", async () => {
      mockDb.aiDeploymentSession.findUnique.mockResolvedValueOnce(null)
      await expect(
        persistBlueprintToDb(
          mockDb as unknown as PrismaClient,
          "non-existent",
          { port: 3000 }
        )
      ).resolves.toBeUndefined()
    })

    it("updates commands array when prevCommands has only 1 element or no blueprint key in session", async () => {
      mockDb.aiDeploymentSession.findUnique.mockResolvedValueOnce({
        id: "session-1",
        serverContext: null,
        plan: {
          detection: {
            commands: ["npm start"],
          },
          resources: {},
          domain: {},
        },
      })

      await persistBlueprintToDb(
        mockDb as unknown as PrismaClient,
        "session-1",
        {
          startCommand: "pnpm start",
          computeTier: "starter",
          subdomain: "my-app",
        }
      )

      expect(mockDb.aiDeploymentSession.update).toHaveBeenCalled()
    })
  })

  describe("handleSessionChat streaming & fallback", () => {
    it("streams response and triggers tool execution via fallback when AI provider is not configured", async () => {
      const service = new AiSessionChatService({
        db: mockDb as unknown as PrismaClient,
        getAiConfig: () => {
          throw new Error("No API key")
        },
      })

      const result = await service.handleSessionChat({
        actor: { organizationId: "org-1", userId: "user-1" },
        sessionId: "session-1",
        message: "tolong ganti port ke 8080",
      })

      expect(result.sessionId).toBe("session-1")

      // Check stream consumption
      const chunks: string[] = []
      for await (const chunk of result.textStream) {
        chunks.push(chunk)
      }
      const fullText = chunks.join("")
      expect(fullText).toContain("8080")

      // Verify tool was called and DB updated
      expect(mockDb.aiDeploymentSession.update).toHaveBeenCalled()

      // Verify toResponse helper
      const response = result.toResponse()
      expect(response).toBeInstanceOf(Response)
      expect(response.headers.get("content-type")).toContain("text/plain")
    })

    it("handles English start command change via fallback", async () => {
      const service = new AiSessionChatService({
        db: mockDb as unknown as PrismaClient,
        getAiConfig: () => {
          throw new Error("No API key")
        },
      })

      const result = await service.handleSessionChat({
        actor: { organizationId: "org-1", userId: "user-1" },
        sessionId: "session-1",
        message: 'change start command to "node dist/main.js"',
      })

      const chunks: string[] = []
      for await (const chunk of result) {
        chunks.push(chunk)
      }
      const fullText = chunks.join("")
      expect(fullText).toContain("node dist/main.js")
      expect(mockDb.aiDeploymentSession.update).toHaveBeenCalled()
    })

    it("handles adding environment variable via fallback", async () => {
      const service = new AiSessionChatService({
        db: mockDb as unknown as PrismaClient,
        getAiConfig: () => {
          throw new Error("No API key")
        },
      })

      const result = await service.handleSessionChat({
        actor: { organizationId: "org-1", userId: "user-1" },
        sessionId: "session-1",
        message: "tambah env REDIS_URL=redis://10.0.0.1:6379",
      })

      const chunks: string[] = []
      for await (const chunk of result.textStream) {
        chunks.push(chunk)
      }
      const fullText = chunks.join("")
      expect(fullText).toContain("REDIS_URL")
      expect(mockDb.aiDeploymentSession.update).toHaveBeenCalled()
    })

    it("responds with Tanya P introduction for general questions in Indonesian", async () => {
      const service = new AiSessionChatService({
        db: mockDb as unknown as PrismaClient,
        getAiConfig: () => {
          throw new Error("No API key")
        },
      })

      const result = await service.handleSessionChat({
        actor: { organizationId: "org-1", userId: "user-1" },
        sessionId: "session-1",
        message: "Halo Tanya, apa yang bisa kamu bantu?",
      })

      const chunks: string[] = []
      for await (const chunk of result.textStream) {
        chunks.push(chunk)
      }
      const fullText = chunks.join("")
      expect(fullText).toContain("Tanya P")
      expect(fullText.toLowerCase()).toContain("blueprint")
    })

    it("streams with mocked AI SDK streamText", async () => {
      const mockStreamText = mock(() => ({
        textStream: (async function* () {
          yield "Halo! "
          yield "Saya "
          yield "Tanya P."
        })(),
        fullStream: (async function* () {
          yield { type: "text-delta", textDelta: "Halo! " }
          yield {
            type: "tool-call",
            toolName: "update_blueprint_field",
            input: { field: "port", value: 3000 },
          }
          yield {
            type: "tool-result",
            toolName: "update_blueprint_field",
            output: { success: true },
          }
          yield { type: "finish", finishReason: "stop" }
        })(),
        toTextStreamResponse: () => new Response("Halo! Saya Tanya P."),
      }))

      const service = new AiSessionChatService({
        db: mockDb as unknown as PrismaClient,
        getAiConfig: () => ({
          apiKey: "test-api-key",
          baseURL: "https://api.openai.com/v1",
        }),
        streamText: mockStreamText as unknown as typeof import("ai").streamText,
      })

      const result = await service.handleSessionChat({
        actor: { organizationId: "org-1", userId: "user-1" },
        sessionId: "session-1",
        message: "Halo",
      })

      expect(mockStreamText).toHaveBeenCalled()
      const chunks: string[] = []
      for await (const chunk of result.textStream) {
        chunks.push(chunk)
      }
      expect(chunks.join("")).toBe("Halo! Saya Tanya P.")

      // Consume fullStream to verify mapping
      const events = []
      for await (const ev of result.fullStream) {
        events.push(ev)
      }
      expect(events).toHaveLength(4)
      expect(events[0].type).toBe("text-delta")
      expect(events[1].type).toBe("tool-call")
      expect(events[2].type).toBe("tool-result")
      expect(events[3].type).toBe("finish")

      // Verify toTextStreamResponse
      const res = result.toTextStreamResponse()
      expect(res).toBeInstanceOf(Response)

      // Verify Symbol.asyncIterator on a fresh call
      const resultIter = await service.handleSessionChat({
        actor: { organizationId: "org-1", userId: "user-1" },
        sessionId: "session-1",
        message: "Halo lagi",
      })
      const asyncIterChunks: string[] = []
      for await (const chunk of resultIter) {
        asyncIterChunks.push(chunk)
      }
      expect(asyncIterChunks.join("")).toBe("Halo! Saya Tanya P.")

      // Verify system prompt includes persona
      const rawCalls = mockStreamText.mock.calls as unknown as Array<
        [{ system?: string }]
      >
      const callArgs = rawCalls[0]?.[0]
      expect(callArgs?.system).toContain(TANYA_P_SYSTEM_PROMPT.slice(0, 30))
      expect(callArgs?.system).toContain("Platform Runtime Operational Contract")
    })

    it("injects runtime operational contract and tunables into system prompt for framework", async () => {
      const mockStreamText = mock(() => ({
        textStream: (async function* () {
          yield "Tanya P response"
        })(),
        toTextStreamResponse: () => new Response("Tanya P response"),
      }))

      mockDb.aiDeploymentSession.findFirst.mockResolvedValueOnce(
        sampleSession({
          serverContext: {
            blueprint: {
              framework: "Laravel 13.x",
              port: 8080,
            },
          },
        })
      )

      const service = new AiSessionChatService({
        db: mockDb as unknown as PrismaClient,
        getAiConfig: () => ({
          apiKey: "test-api-key",
          baseURL: "https://api.openai.com/v1",
        }),
        streamText: mockStreamText as unknown as typeof import("ai").streamText,
      })

      await service.handleSessionChat({
        actor: { organizationId: "org-1", userId: "user-1" },
        sessionId: "session-1",
        message: "Kenapa upload file 20MB error?",
      })

      const rawCalls = mockStreamText.mock.calls as unknown as Array<
        [{ system?: string }]
      >
      const callArgs = rawCalls[0]?.[0]
      expect(callArgs?.system).toContain("PHP_UPLOAD_MAX_FILESIZE")
      expect(callArgs?.system).toContain("CONTAINER_ROLE")
      expect(callArgs?.system).toContain("HTTP 413")
    })

    it("creates stream Response via fallback ReadableStream when toTextStreamResponse is omitted", async () => {
      const mockStreamText = mock(() => ({
        textStream: (async function* () {
          yield "Direct stream chunk"
        })(),
      }))

      const service = new AiSessionChatService({
        db: mockDb as unknown as PrismaClient,
        getAiConfig: () => ({
          apiKey: "test-api-key",
          baseURL: "https://api.openai.com/v1",
        }),
        streamText: mockStreamText as unknown as typeof import("ai").streamText,
      })

      const result = await service.handleSessionChat({
        actor: { organizationId: "org-1", userId: "user-1" },
        sessionId: "session-1",
        message: "Halo",
      })

      const response = result.toResponse({ status: 201, statusText: "Created" })
      expect(response.status).toBe(201)
      const text = await response.text()
      expect(text).toBe("Direct stream chunk")
    })

    it("handles computeTier change in Indonesian and English via fallback", async () => {
      const service = new AiSessionChatService({
        db: mockDb as unknown as PrismaClient,
        getAiConfig: () => {
          throw new Error("No API key")
        },
      })

      const resId = await service.handleSessionChat({
        actor: { organizationId: "org-1", userId: "user-1" },
        sessionId: "session-1",
        message: "ubah tier ke starter",
      })
      let textId = ""
      for await (const c of resId.textStream) textId += c
      expect(textId).toContain("starter")
      expect(textId).toContain("Compute tier telah diubah")

      const resEn = await service.handleSessionChat({
        actor: { organizationId: "org-1", userId: "user-1" },
        sessionId: "session-1",
        message: "compute tier pro",
      })
      let textEn = ""
      for await (const c of resEn.textStream) textEn += c
      expect(textEn).toContain("pro")
      expect(textEn).toContain("Compute tier has been updated")
    })

    it("handles subdomain change in Indonesian and English via fallback", async () => {
      const service = new AiSessionChatService({
        db: mockDb as unknown as PrismaClient,
        getAiConfig: () => {
          throw new Error("No API key")
        },
      })

      const resId = await service.handleSessionChat({
        actor: { organizationId: "org-1", userId: "user-1" },
        sessionId: "session-1",
        message: "ubah subdomain ke mysite",
      })
      let textId = ""
      for await (const c of resId.textStream) textId += c
      expect(textId).toContain("mysite")
      expect(textId).toContain("Subdomain telah diubah")

      const resEn = await service.handleSessionChat({
        actor: { organizationId: "org-1", userId: "user-1" },
        sessionId: "session-1",
        message: "domain mysite-en",
      })
      let textEn = ""
      for await (const c of resEn.textStream) textEn += c
      expect(textEn).toContain("mysite-en")
      expect(textEn).toContain("Subdomain has been updated")
    })

    it("handles rootDirectory change in Indonesian and English via fallback", async () => {
      const service = new AiSessionChatService({
        db: mockDb as unknown as PrismaClient,
        getAiConfig: () => {
          throw new Error("No API key")
        },
      })

      const resId = await service.handleSessionChat({
        actor: { organizationId: "org-1", userId: "user-1" },
        sessionId: "session-1",
        message: "ubah direktori ke apps/web",
      })
      let textId = ""
      for await (const c of resId.textStream) textId += c
      expect(textId).toContain("apps/web")
      expect(textId).toContain("Root directory telah diatur")

      const resEn = await service.handleSessionChat({
        actor: { organizationId: "org-1", userId: "user-1" },
        sessionId: "session-1",
        message: "root dir packages/backend",
      })
      let textEn = ""
      for await (const c of resEn.textStream) textEn += c
      expect(textEn).toContain("packages/backend")
      expect(textEn).toContain("Root directory has been set")
    })

    it("handles secret environment variable in Indonesian and English via fallback", async () => {
      const service = new AiSessionChatService({
        db: mockDb as unknown as PrismaClient,
        getAiConfig: () => {
          throw new Error("No API key")
        },
      })

      const resId = await service.handleSessionChat({
        actor: { organizationId: "org-1", userId: "user-1" },
        sessionId: "session-1",
        message: "tambah secret API_TOKEN=xyz987",
      })
      let textId = ""
      for await (const c of resId.textStream) textId += c
      expect(textId).toContain("API_TOKEN")

      const resEn = await service.handleSessionChat({
        actor: { organizationId: "org-1", userId: "user-1" },
        sessionId: "session-1",
        message: "add secret DB_PASS=pass123",
      })
      let textEn = ""
      for await (const c of resEn.textStream) textEn += c
      expect(textEn).toContain("DB_PASS")
      expect(textEn).toContain("successfully added to blueprint")
    })

    it("responds with English Tanya P introduction for general query without Indonesian keywords", async () => {
      const service = new AiSessionChatService({
        db: mockDb as unknown as PrismaClient,
        getAiConfig: () => {
          throw new Error("No API key")
        },
      })

      const result = await service.handleSessionChat({
        actor: { organizationId: "org-1", userId: "user-1" },
        sessionId: "session-1",
        message: "What can I do next?",
      })

      let text = ""
      for await (const c of result.textStream) text += c
      expect(text).toContain("Hello! I am Tanya P, your deployment copilot.")

      // Verify fallback fullStream iteration
      const fullEvents = []
      for await (const ev of result.fullStream) {
        fullEvents.push(ev)
      }
      expect(fullEvents.length).toBeGreaterThan(0)

      const fallbackResp = result.toTextStreamResponse({ status: 200 })
      expect(fallbackResp.status).toBe(200)
    })

    it("handleSessionChat exported function delegates to default service", async () => {
      // Set default service db
      Object.assign(defaultAiSessionChatService, {
        db: mockDb as unknown as PrismaClient,
      })
      mockDb.aiDeploymentSession.findFirst.mockResolvedValueOnce(
        sampleSession()
      )
      const result = await handleSessionChat({
        actor: { organizationId: "org-1", userId: "user-1" },
        sessionId: "session-1",
        message: "Halo",
      })
      expect(result.sessionId).toBe("session-1")
    })
  })
})
