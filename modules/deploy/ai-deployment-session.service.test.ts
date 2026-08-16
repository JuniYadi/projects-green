import { describe, expect, it, mock } from "bun:test"
import {
  AiDeploymentSessionStatus,
  type AiDeploymentSession,
  type PrismaClient,
} from "@prisma/client"

import {
  AiDeploymentSessionError,
  AiDeploymentSessionService,
} from "./ai-deployment-session.service"
import { computeHourlyCost } from "./deploy-pricing"
import { toDeploymentPlanDTO } from "./deployment-plan.dto"

export const planReadyFixture = {
  version: 1,
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
    framework: "Next.js",
    version: "20",
    commands: ["bun run build", "bun start"],
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
    analyzer: "framework-detector",
    sourceReference: null,
    analyzedAt: "2026-08-09T00:00:00.000Z",
  },
}

const validManualSettings = {
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

const session = (
  overrides: Partial<AiDeploymentSession> = {}
): AiDeploymentSession => ({
  id: "session-1",
  organizationId: "org-1",
  workosUserId: "user-1",
  status: AiDeploymentSessionStatus.PLAN_READY,
  sourceType: "SOURCE",
  stackId: null,
  deploymentId: null,
  currentPlanVersion: 1,
  currentPlanHash: "plan-hash",
  plan: null,
  serverContext: { credentialId: "credential-1" },
  executionRefs: null,
  blockedReason: null,
  confirmedBy: null,
  confirmedAt: null,
  confirmationPlanHash: null,
  idempotencyKey: null,
  expiresAt: new Date("2026-08-10T00:00:00.000Z"),
  createdAt: new Date("2026-08-09T00:00:00.000Z"),
  updatedAt: new Date("2026-08-09T00:00:00.000Z"),
  ...overrides,
})

const createService = (rows: AiDeploymentSession[]) => {
  const db = {
    aiDeploymentSession: {
      create: mock(async () => session()),
      findFirst: mock(
        async ({ where }: { where: Record<string, unknown> }) =>
          rows.find(
            (row) =>
              row.id === where.id && row.organizationId === where.organizationId
          ) ?? null
      ),
      updateMany: mock(async ({ where, data }) => {
        const row = rows.find(
          (candidate) =>
            candidate.id === where.id &&
            candidate.organizationId === where.organizationId &&
            candidate.status === where.status
        )
        if (row) Object.assign(row, data)
        return { count: row ? 1 : 0 }
      }),
    },
    appCredential: { findFirst: mock(async () => ({ id: "credential-1" })) },
    githubRepositoryConnection: {
      findFirst: mock(async () => ({ id: "connection-1" })),
    },
  }

  return {
    db,
    service: new AiDeploymentSessionService({
      db: db as unknown as PrismaClient,
      now: () => new Date("2026-08-09T12:00:00.000Z"),
    }),
  }
}

const actor = { organizationId: "org-1", userId: "user-1" }

describe("AiDeploymentSessionService", () => {
  it("does not reveal sessions from another tenant", async () => {
    const { service, db } = createService([
      session({ organizationId: "org-2" }),
    ])

    await expect(service.get(actor, "session-1")).rejects.toMatchObject({
      code: "NOT_FOUND",
    })
    expect(db.aiDeploymentSession.findFirst).toHaveBeenCalledWith({
      where: { id: "session-1", organizationId: "org-1" },
    })
  })

  it("rejects illegal lifecycle transitions", async () => {
    const { service, db } = createService([
      session({ status: "COLLECTING", currentPlanHash: null }),
    ])

    await expect(
      service.transition({
        actor,
        sessionId: "session-1",
        status: "CONFIRMED",
      })
    ).rejects.toMatchObject({ code: "INVALID_TRANSITION" })
    expect(db.aiDeploymentSession.updateMany).not.toHaveBeenCalled()
  })

  it("rejects stale plan confirmations and expired sessions", async () => {
    const { service } = createService([session()])

    await expect(
      service.confirm({
        actor,
        sessionId: "session-1",
        planVersion: 1,
        planHash: "stale-hash",
        idempotencyKey: "key-1",
      })
    ).rejects.toMatchObject({ code: "PLAN_HASH_MISMATCH" })

    const { service: expiredService } = createService([
      session({ expiresAt: new Date("2026-08-09T11:59:59.000Z") }),
    ])
    await expect(
      expiredService.confirm({
        actor,
        sessionId: "session-1",
        planVersion: 1,
        planHash: "plan-hash",
        idempotencyKey: "key-1",
      })
    ).rejects.toMatchObject({ code: "SESSION_EXPIRED" })
  })

  it("returns the existing confirmation for an idempotent retry", async () => {
    const confirmed = session({
      status: "CONFIRMED",
      idempotencyKey: "key-1",
      confirmedBy: "user-1",
      confirmedAt: new Date("2026-08-09T12:00:00.000Z"),
      confirmationPlanHash: "plan-hash",
    })
    const { service, db } = createService([confirmed])

    await expect(
      service.confirm({
        actor,
        sessionId: "session-1",
        planVersion: 1,
        planHash: "plan-hash",
        idempotencyKey: "key-1",
      })
    ).resolves.toEqual(confirmed)
    expect(db.aiDeploymentSession.updateMany).not.toHaveBeenCalled()
  })

  it("applies manual settings, re-validates, and bumps the plan version", async () => {
    const { service, db } = createService([
      session({
        status: AiDeploymentSessionStatus.PLAN_READY,
        currentPlanVersion: 1,
        plan: planReadyFixture,
      }),
    ])

    const updated = await service.applyManualSettings({
      actor,
      sessionId: "session-1",
      settings: validManualSettings,
    })

    expect(updated.currentPlanVersion).toBe(2)
    expect(updated.currentPlanHash).not.toBe("plan-hash")
    const calledData = db.aiDeploymentSession.updateMany.mock.calls[0]![0].data
    expect(calledData.confirmationPlanHash).toBeNull()
  })

  it("updates envRequirements status without ever persisting or returning the plaintext value", async () => {
    const { service, db } = createService([
      session({
        status: AiDeploymentSessionStatus.PLAN_READY,
        plan: {
          ...planReadyFixture,
          configuration: {
            ...planReadyFixture.configuration,
            envRequirements: [
              {
                key: "DATABASE_URL",
                required: true,
                kind: "secret" as const,
                status: "missing" as const,
                description: "Database connection string",
              },
            ],
          },
        },
      }),
    ])

    const updated = await service.setEnvironmentValues({
      actor,
      sessionId: "session-1",
      values: [{ key: "DATABASE_URL", value: "postgres://user:pass@host/db" }],
    })

    const plan = toDeploymentPlanDTO(updated.plan)!
    const requirement = plan.configuration.envRequirements.find(
      (item) => item.key === "DATABASE_URL"
    )
    expect(requirement?.status).toBe("provided")
    expect(JSON.stringify(updated)).not.toContain("postgres://user:pass")
    const persistedPlanJson =
      db.aiDeploymentSession.updateMany.mock.calls[0]![0].data.plan
    expect(JSON.stringify(persistedPlanJson)).not.toContain(
      "postgres://user:pass"
    )
  })

  it("rejects a value for a key the plan does not declare as an env requirement", async () => {
    const { service } = createService([
      session({
        status: AiDeploymentSessionStatus.PLAN_READY,
        plan: planReadyFixture,
      }),
    ])

    await expect(
      service.setEnvironmentValues({
        actor,
        sessionId: "session-1",
        values: [{ key: "NOT_IN_PLAN", value: "x" }],
      })
    ).rejects.toThrow(AiDeploymentSessionError)
  })

  it("rejects a Dockerfile path that is not repository-relative", async () => {
    const { service } = createService([
      session({
        status: AiDeploymentSessionStatus.PLAN_READY,
        plan: planReadyFixture,
      }),
    ])

    await expect(
      service.applyManualSettings({
        actor,
        sessionId: "session-1",
        settings: {
          ...validManualSettings,
          useDockerfile: true,
          dockerfilePath: "https://evil.example/Dockerfile",
        },
      })
    ).rejects.toThrow(AiDeploymentSessionError)
  })

  it("recomputes hourly cost server-side and ignores a client-submitted price", async () => {
    const { service } = createService([
      session({
        status: AiDeploymentSessionStatus.PLAN_READY,
        plan: planReadyFixture,
      }),
    ])

    const updated = await service.selectResourcePlan({
      actor,
      sessionId: "session-1",
      selection: {
        resourcePlanId: "payg",
        cpu: 500,
        memory: 1024,
        bufferHours: 24,
      },
    })

    const plan = toDeploymentPlanDTO(updated.plan)!
    expect(plan.billing.estimate).toBeCloseTo(
      computeHourlyCost({ resourcePlanId: "payg", cpu: 500, memory: 1024 })
    )
  })

  it("rejects a PAYG selection outside PAYG_BASE_LIMITS", async () => {
    const { service } = createService([
      session({
        status: AiDeploymentSessionStatus.PLAN_READY,
        plan: planReadyFixture,
      }),
    ])

    await expect(
      service.selectResourcePlan({
        actor,
        sessionId: "session-1",
        selection: {
          resourcePlanId: "payg",
          cpu: 5000,
          memory: 1024,
          bufferHours: 24,
        },
      })
    ).rejects.toThrow(AiDeploymentSessionError)
  })
})
