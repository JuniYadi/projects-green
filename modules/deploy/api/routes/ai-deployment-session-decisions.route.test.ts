import { describe, expect, it, mock } from "bun:test"
import type { AiDeploymentSession } from "@prisma/client"

mock.module("@/lib/prisma", () => ({ prisma: {} }))

const { AiDeploymentSessionError } =
  await import("@/modules/deploy/ai-deployment-session.service")
const { createAiDeploymentSessionDecisionRoutes } =
  await import("./ai-deployment-session-decisions.route")
type AiDeploymentSessionService =
  import("@/modules/deploy/ai-deployment-session.service").AiDeploymentSessionService

const samplePlan = (version = 2) => ({
  version,
  source: {
    kind: "git" as const,
    url: "https://github.com/acme/example",
    host: "github.com",
    ref: "main",
    templateId: null,
  },
  access: { state: "public" as const, displayLabel: "Public repository" },
  detection: {
    runtime: "Node.js",
    framework: "Express",
    version: "20",
    commands: ["pnpm run build", "pnpm start"],
    port: 3000,
    confidence: null,
    evidence: [],
  },
  configuration: {
    appName: "example",
    branchOrRef: "main",
    environment: "production" as const,
    envRequirements: [],
  },
  dependencies: [],
  resources: {
    package: "starter",
    server: null,
    region: null,
    cpu: 1,
    memory: 512,
    storage: null,
  },
  domain: { mode: "auto" as const, hostname: null, tls: true },
  billing: {
    quoteReference: null,
    currency: null,
    estimate: null,
    interval: null,
  },
  execution: {
    ready: true,
    steps: [
      {
        key: "resolve_source",
        label: "Source verified",
        status: "ready" as const,
        evidenceReference: null,
      },
      {
        key: "inspect_runtime",
        label: "Runtime inspected",
        status: "ready" as const,
        evidenceReference: null,
      },
      {
        key: "validate_plan",
        label: "Plan validated",
        status: "ready" as const,
        evidenceReference: null,
      },
      {
        key: "await_confirmation",
        label: "Awaiting confirmation",
        status: "pending" as const,
        evidenceReference: null,
      },
    ],
  },
  unresolved: [],
  provenance: {
    analyzer: "manual",
    sourceReference: null,
    analyzedAt: "2026-08-09T00:00:00.000Z",
  },
})

const sampleSession = (): AiDeploymentSession => ({
  id: "session-1",
  organizationId: "org-1",
  workosUserId: "user-1",
  status: "PLAN_READY",
  sourceType: "SOURCE",
  currentPlanVersion: 2,
  currentPlanHash: "new-hash",
  plan: samplePlan(),
  serverContext: null,
  executionRefs: null,
  blockedReason: null,
  confirmedBy: null,
  confirmedAt: null,
  confirmationPlanHash: null,
  idempotencyKey: null,
  expiresAt: new Date("2026-08-10T00:00:00.000Z"),
  createdAt: new Date("2026-08-09T00:00:00.000Z"),
  updatedAt: new Date("2026-08-09T00:00:00.000Z"),
})

const settings = {
  language: "Node.js",
  framework: "Express",
  runtimeVersion: "20",
  packageManager: "pnpm",
  buildCommand: "pnpm run build",
  startCommand: "pnpm start",
  port: 3000,
  useDockerfile: false,
  dockerfilePath: null,
}

const createService = () => ({
  applyManualSettings: mock(async () => sampleSession()),
})

const request = (body: unknown) =>
  new Request("http://localhost/deploy/ai-sessions/session-1/manual-settings", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })

const actor = {
  userId: "user-1",
  organizationId: "org-1",
  platformRole: "none" as const,
  tenantRole: "admin" as const,
}

describe("aiDeploymentSessionDecisionRoutes", () => {
  it("rejects unauthenticated requests", async () => {
    const app = createAiDeploymentSessionDecisionRoutes({
      requireActor: async (set) => {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Unauthorized" }
      },
      service: createService() as unknown as AiDeploymentSessionService,
    })

    expect((await app.handle(request(settings))).status).toBe(401)
  })

  it("hides cross-tenant sessions as not found", async () => {
    const service = createService()
    service.applyManualSettings.mockRejectedValue(
      new AiDeploymentSessionError("NOT_FOUND")
    )
    const app = createAiDeploymentSessionDecisionRoutes({
      requireActor: async () => actor,
      service: service as unknown as AiDeploymentSessionService,
    })

    expect((await app.handle(request(settings))).status).toBe(404)
  })

  it("rejects an invalid Dockerfile path", async () => {
    const service = createService()
    service.applyManualSettings.mockRejectedValue(
      new AiDeploymentSessionError("MANUAL_SETTINGS_INVALID")
    )
    const app = createAiDeploymentSessionDecisionRoutes({
      requireActor: async () => actor,
      service: service as unknown as AiDeploymentSessionService,
    })

    const response = await app.handle(
      request({
        ...settings,
        useDockerfile: true,
        dockerfilePath: "../Dockerfile",
      })
    )
    const body = (await response.json()) as { error: string }

    expect(response.status).toBe(422)
    expect(body.error).toBe("MANUAL_SETTINGS_INVALID")
  })

  it("returns the incremented plan version on success", async () => {
    const service = createService()
    const app = createAiDeploymentSessionDecisionRoutes({
      requireActor: async () => actor,
      service: service as unknown as AiDeploymentSessionService,
    })

    const response = await app.handle(request(settings))
    const body = (await response.json()) as {
      data: { currentPlanVersion: number; plan: { version: number } }
    }

    expect(response.status).toBe(200)
    expect(body.data.currentPlanVersion).toBe(2)
    expect(body.data.plan.version).toBe(2)
    expect(service.applyManualSettings).toHaveBeenCalledWith({
      actor: { organizationId: "org-1", userId: "user-1" },
      sessionId: "session-1",
      settings,
    })
  })
})
