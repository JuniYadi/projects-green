import {
  AiDeploymentSessionStatus,
  AiDeploymentSourceType,
  Prisma,
  type AiDeploymentSession,
  type PrismaClient,
} from "@prisma/client"

import { prisma } from "@/lib/prisma"
import {
  canConfirm,
  isValidTransition,
} from "@/modules/deploy/ai-deployment-session.transitions"
import {
  DeploymentPlanValidator,
  type ValidatedDeploymentPlan,
} from "@/modules/deploy/deployment-plan.validator"

const SESSION_LIFETIME_MS = 24 * 60 * 60 * 1000

export type AiDeploymentSessionActor = {
  organizationId: string
  userId: string
}

export class AiDeploymentSessionError extends Error {
  constructor(
    readonly code:
      | "NOT_FOUND"
      | "INVALID_TRANSITION"
      | "PLAN_REQUIRED"
      | "PLAN_VERSION_MISMATCH"
      | "PLAN_HASH_MISMATCH"
      | "SESSION_EXPIRED"
      | "IDEMPOTENCY_CONFLICT"
  ) {
    super(code)
  }
}

export type AiDeploymentSessionServiceDependencies = {
  db?: PrismaClient
  now?: () => Date
  validator?: DeploymentPlanValidator
}

export class AiDeploymentSessionService {
  private readonly db: PrismaClient
  private readonly now: () => Date
  private readonly validator: DeploymentPlanValidator

  constructor(dependencies: AiDeploymentSessionServiceDependencies = {}) {
    this.db = dependencies.db ?? prisma
    this.now = dependencies.now ?? (() => new Date())
    this.validator =
      dependencies.validator ?? new DeploymentPlanValidator(this.db)
  }

  async create({
    actor,
    sourceType,
  }: {
    actor: AiDeploymentSessionActor
    sourceType: AiDeploymentSourceType
  }): Promise<AiDeploymentSession> {
    const now = this.now()
    return this.db.aiDeploymentSession.create({
      data: {
        organizationId: actor.organizationId,
        workosUserId: actor.userId,
        sourceType,
        expiresAt: new Date(now.getTime() + SESSION_LIFETIME_MS),
      },
    })
  }

  async get(
    actor: AiDeploymentSessionActor,
    sessionId: string
  ): Promise<AiDeploymentSession> {
    const session = await this.db.aiDeploymentSession.findFirst({
      where: { id: sessionId, organizationId: actor.organizationId },
    })
    if (!session) {
      throw new AiDeploymentSessionError("NOT_FOUND")
    }
    return session
  }

  async transition({
    actor,
    sessionId,
    status,
    plan,
    blockedReason,
  }: {
    actor: AiDeploymentSessionActor
    sessionId: string
    status: AiDeploymentSessionStatus
    plan?: unknown
    blockedReason?: string | null
  }): Promise<AiDeploymentSession> {
    const session = await this.get(actor, sessionId)
    if (!isValidTransition(session.status, status)) {
      throw new AiDeploymentSessionError("INVALID_TRANSITION")
    }

    let validatedPlan: ValidatedDeploymentPlan | null = null
    if (status === "PLAN_READY") {
      if (!plan) {
        throw new AiDeploymentSessionError("PLAN_REQUIRED")
      }
      validatedPlan = await this.validator.validate({
        organizationId: actor.organizationId,
        plan,
      })
      if (validatedPlan.plan.version !== session.currentPlanVersion) {
        throw new AiDeploymentSessionError("PLAN_VERSION_MISMATCH")
      }
    }

    const invalidatesPlan =
      status === "COLLECTING" &&
      (session.status === "PLAN_READY" || session.status === "FAILED")

    const updated = await this.db.aiDeploymentSession.updateMany({
      where: {
        id: sessionId,
        organizationId: actor.organizationId,
        status: session.status,
      },
      data: {
        status,
        blockedReason: status === "BLOCKED" ? (blockedReason ?? null) : null,
        ...(validatedPlan
          ? {
              plan: JSON.parse(
                JSON.stringify(validatedPlan.plan)
              ) as Prisma.InputJsonValue,
              currentPlanHash: validatedPlan.hash,
            }
          : {}),
        ...(invalidatesPlan
          ? {
              currentPlanVersion: { increment: 1 },
              currentPlanHash: null,
              plan: Prisma.DbNull,
              confirmedBy: null,
              confirmedAt: null,
              confirmationPlanHash: null,
              idempotencyKey: null,
            }
          : {}),
      },
    })
    if (updated.count !== 1) {
      throw new AiDeploymentSessionError("INVALID_TRANSITION")
    }

    return this.get(actor, sessionId)
  }

  async confirm({
    actor,
    sessionId,
    planVersion,
    planHash,
    idempotencyKey,
  }: {
    actor: AiDeploymentSessionActor
    sessionId: string
    planVersion: number
    planHash: string
    idempotencyKey: string
  }): Promise<AiDeploymentSession> {
    const session = await this.get(actor, sessionId)
    this.assertCurrentPlan(session, planVersion, planHash)

    if (session.status === "CONFIRMED") {
      if (session.idempotencyKey !== idempotencyKey) {
        throw new AiDeploymentSessionError("IDEMPOTENCY_CONFLICT")
      }
      return session
    }

    if (!canConfirm(session.status)) {
      throw new AiDeploymentSessionError("INVALID_TRANSITION")
    }
    if (session.expiresAt && session.expiresAt <= this.now()) {
      throw new AiDeploymentSessionError("SESSION_EXPIRED")
    }

    const confirmedAt = this.now()
    const updated = await this.db.aiDeploymentSession.updateMany({
      where: {
        id: sessionId,
        organizationId: actor.organizationId,
        status: "PLAN_READY",
        currentPlanVersion: planVersion,
        currentPlanHash: planHash,
      },
      data: {
        status: "CONFIRMED",
        confirmedBy: actor.userId,
        confirmedAt,
        confirmationPlanHash: planHash,
        idempotencyKey,
      },
    })
    if (updated.count !== 1) {
      throw new AiDeploymentSessionError("INVALID_TRANSITION")
    }

    return this.get(actor, sessionId)
  }

  private assertCurrentPlan(
    session: AiDeploymentSession,
    planVersion: number,
    planHash: string
  ): void {
    if (session.currentPlanVersion !== planVersion) {
      throw new AiDeploymentSessionError("PLAN_VERSION_MISMATCH")
    }
    if (!session.currentPlanHash || session.currentPlanHash !== planHash) {
      throw new AiDeploymentSessionError("PLAN_HASH_MISMATCH")
    }
  }
}
