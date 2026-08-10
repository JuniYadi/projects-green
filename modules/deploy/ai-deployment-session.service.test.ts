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

const session = (
  overrides: Partial<AiDeploymentSession> = {}
): AiDeploymentSession => ({
  id: "session-1",
  organizationId: "org-1",
  workosUserId: "user-1",
  status: AiDeploymentSessionStatus.PLAN_READY,
  sourceType: "SOURCE",
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
      updateMany: mock(async () => ({ count: 1 })),
    },
    appCredential: { findFirst: mock(async () => ({ id: "credential-1" })) },
    githubRepositoryConnection: {
      findFirst: mock(async () => ({ id: "connection-1" })),
    },
  } as unknown as PrismaClient

  return {
    db,
    service: new AiDeploymentSessionService({
      db,
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
})
