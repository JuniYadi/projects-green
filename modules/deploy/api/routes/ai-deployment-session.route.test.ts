import { describe, expect, it, mock } from "bun:test"
import type { AiDeploymentSession } from "@prisma/client"

mock.module("@/lib/prisma", () => ({ prisma: {} }))

const { AiDeploymentSessionError } =
  await import("@/modules/deploy/ai-deployment-session.service")
const { createAiDeploymentSessionRoutes } =
  await import("./ai-deployment-session.route")
type AiSourceInspectionService =
  import("@/modules/deploy/ai-source-inspection.service").AiSourceInspectionService
type AiDeploymentSessionService =
  import("@/modules/deploy/ai-deployment-session.service").AiDeploymentSessionService

const sampleSession = (): AiDeploymentSession => ({
  id: "session-1",
  organizationId: "org-1",
  workosUserId: "user-1",
  status: "PLAN_READY",
  sourceType: "SOURCE",
  currentPlanVersion: 1,
  currentPlanHash: "plan-hash",
  plan: null,
  serverContext: { credentialId: "credential-1", token: "private" },
  executionRefs: { billingOrderId: "order-1" },
  blockedReason: null,
  confirmedBy: null,
  confirmedAt: null,
  confirmationPlanHash: null,
  idempotencyKey: "private-key",
  expiresAt: new Date("2026-08-10T00:00:00.000Z"),
  createdAt: new Date("2026-08-09T00:00:00.000Z"),
  updatedAt: new Date("2026-08-09T00:00:00.000Z"),
})

const createService = () => ({
  create: mock(async () => sampleSession()),
  get: mock(async () => sampleSession()),
  transition: mock(async () => sampleSession()),
  confirm: mock(async () => sampleSession()),
})

const request = (path: string, body?: unknown) =>
  new Request(`http://localhost${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

describe("aiDeploymentSessionRoutes", () => {
  it("rejects unauthenticated requests", async () => {
    const app = createAiDeploymentSessionRoutes({
      requireActor: async (set) => {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Unauthorized" }
      },
      service: createService() as unknown as AiDeploymentSessionService,
    })

    const response = await app.handle(request("/deploy/ai-sessions", {}))
    expect(response.status).toBe(401)
  })

  it("rejects tenant members without deploy management access", async () => {
    const app = createAiDeploymentSessionRoutes({
      requireActor: async () => ({
        userId: "user-1",
        organizationId: "org-1",
        platformRole: "none",
        tenantRole: "member",
      }),
      service: createService() as unknown as AiDeploymentSessionService,
    })

    const response = await app.handle(request("/deploy/ai-sessions", {}))
    expect(response.status).toBe(403)
  })

  it("returns a safe session DTO without internal context or idempotency keys", async () => {
    const service = createService()
    const app = createAiDeploymentSessionRoutes({
      requireActor: async () => ({
        userId: "user-1",
        organizationId: "org-1",
        platformRole: "none",
        tenantRole: "admin",
      }),
      service: service as unknown as AiDeploymentSessionService,
    })

    const response = await app.handle(
      request("/deploy/ai-sessions", { sourceType: "SOURCE" })
    )
    const body = (await response.json()) as { data: Record<string, unknown> }

    expect(response.status).toBe(200)
    expect(body.data).not.toHaveProperty("serverContext")
    expect(body.data).not.toHaveProperty("executionRefs")
    expect(body.data).not.toHaveProperty("idempotencyKey")
    expect(service.create).toHaveBeenCalledWith({
      actor: { organizationId: "org-1", userId: "user-1" },
      sourceType: "SOURCE",
    })
  })

  it("hides cross-tenant sessions as not found", async () => {
    const service = createService()
    service.get.mockRejectedValue(new AiDeploymentSessionError("NOT_FOUND"))
    const app = createAiDeploymentSessionRoutes({
      requireActor: async () => ({
        userId: "user-1",
        organizationId: "org-1",
        platformRole: "none",
        tenantRole: "admin",
      }),
      service: service as unknown as AiDeploymentSessionService,
    })

    const response = await app.handle(request("/deploy/ai-sessions/session-2"))
    expect(response.status).toBe(404)
  })

  it("rejects confirmation for a mismatched plan hash", async () => {
    const service = createService()
    service.confirm.mockRejectedValue(
      new AiDeploymentSessionError("PLAN_HASH_MISMATCH")
    )
    const app = createAiDeploymentSessionRoutes({
      requireActor: async () => ({
        userId: "user-1",
        organizationId: "org-1",
        platformRole: "none",
        tenantRole: "owner",
      }),
      service: service as unknown as AiDeploymentSessionService,
    })

    const response = await app.handle(
      request("/deploy/ai-sessions/session-1/confirm", {
        planVersion: 1,
        planHash: "stale-hash",
        idempotencyKey: "key-1",
      })
    )
    expect(response.status).toBe(409)
  })

  it("exposes the typed source inspection result through the tenant route", async () => {
    const inspectionService = {
      inspect: mock(async () => ({
        status: "not_supported" as const,
        source: null,
        access: null,
        detection: null,
        plan: null,
        manualOverride: null,
        evidenceReferences: [],
        session: null,
      })),
    }
    const app = createAiDeploymentSessionRoutes({
      requireActor: async () => ({
        userId: "user-1",
        organizationId: "org-1",
        platformRole: "none",
        tenantRole: "admin",
      }),
      service: createService() as unknown as AiDeploymentSessionService,
      inspectionService:
        inspectionService as unknown as AiSourceInspectionService,
    })

    const response = await app.handle(
      request("/deploy/ai-sessions/inspect", {
        sourceUrl: "https://gitlab.com/acme/app",
      })
    )
    const body = (await response.json()) as {
      data: { status: string }
    }

    expect(response.status).toBe(200)
    expect(body.data.status).toBe("not_supported")
    expect(inspectionService.inspect).toHaveBeenCalledWith({
      actor: { organizationId: "org-1", userId: "user-1" },
      request: {
        sourceUrl: "https://gitlab.com/acme/app",
        ref: undefined,
        subdir: undefined,
        sessionId: undefined,
      },
    })
  })
})
