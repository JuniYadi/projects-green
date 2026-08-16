import {
  AiDeploymentSessionStatus,
  AiDeploymentSourceType,
  Prisma,
  type AiDeploymentSession,
  type PrismaClient,
} from "@prisma/client"

import {
  encrypt,
  getEncryptionKey,
  serializeEncryptedField,
} from "@/lib/encryption"
import { prisma } from "@/lib/prisma"
import { assertDeployExecutionGates } from "@/modules/deploy/deploy-execution-gates"
import {
  createOrUpdateStack,
  triggerDeploy,
} from "@/modules/deploy/deploy-pipeline.service"
import { planToStackUpsertInput } from "@/modules/deploy/ai-deployment-plan-to-stack.adapter"
import {
  canConfirm,
  isValidTransition,
} from "@/modules/deploy/ai-deployment-session.transitions"
import {
  DeploymentPlanValidator,
  type ValidatedDeploymentPlan,
} from "@/modules/deploy/deployment-plan.validator"
import {
  toDeploymentPlanDTO,
  type DeploymentPlanDTO,
} from "@/modules/deploy/deployment-plan.dto"
import {
  parseManualBuildSettings,
  type ManualBuildSettingsInput,
} from "@/modules/deploy/manual-build-settings"
import {
  resolveResourceSelection,
  type ResourceSelectionInput,
} from "@/modules/deploy/resource-selection"

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
      | "MANUAL_SETTINGS_INVALID"
      | "RESOURCE_SELECTION_INVALID"
      | "ENVIRONMENT_KEY_NOT_DECLARED"
  ) {
    super(code)
  }
}

export type AiDeploymentSessionServiceDependencies = {
  db?: PrismaClient
  now?: () => Date
  validator?: DeploymentPlanValidator
  pipeline?: {
    planToStackUpsertInput: typeof planToStackUpsertInput
    assertDeployExecutionGates: typeof assertDeployExecutionGates
    createOrUpdateStack: typeof createOrUpdateStack
    triggerDeploy: typeof triggerDeploy
  }
}

export class AiDeploymentSessionService {
  private readonly db: PrismaClient
  private readonly now: () => Date
  private readonly validator: DeploymentPlanValidator
  private readonly pipeline: NonNullable<
    AiDeploymentSessionServiceDependencies["pipeline"]
  >

  constructor(dependencies: AiDeploymentSessionServiceDependencies = {}) {
    this.db = dependencies.db ?? prisma
    this.now = dependencies.now ?? (() => new Date())
    this.validator =
      dependencies.validator ?? new DeploymentPlanValidator(this.db)
    this.pipeline = dependencies.pipeline ?? {
      planToStackUpsertInput,
      assertDeployExecutionGates,
      createOrUpdateStack,
      triggerDeploy,
    }
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
    serverContext,
  }: {
    actor: AiDeploymentSessionActor
    sessionId: string
    status: AiDeploymentSessionStatus
    plan?: unknown
    blockedReason?: string | null
    serverContext?: Prisma.InputJsonValue
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
        ...(serverContext !== undefined ? { serverContext } : {}),
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

    if (session.status === "EXECUTING" || session.status === "SUCCEEDED") {
      if (session.idempotencyKey !== idempotencyKey) {
        throw new AiDeploymentSessionError("IDEMPOTENCY_CONFLICT")
      }
      return session
    }

    if (session.status === "CONFIRMED") {
      if (session.idempotencyKey !== idempotencyKey) {
        throw new AiDeploymentSessionError("IDEMPOTENCY_CONFLICT")
      }
      return this.executeConfirmedSession(actor, session)
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

    const confirmedSession = await this.get(actor, sessionId)
    return this.executeConfirmedSession(actor, confirmedSession)
  }

  private async executeConfirmedSession(
    actor: AiDeploymentSessionActor,
    session: AiDeploymentSession
  ): Promise<AiDeploymentSession> {
    if (session.status === "EXECUTING" || session.status === "SUCCEEDED") {
      return session
    }

    const plan = toDeploymentPlanDTO(session.plan)
    if (!plan) throw new AiDeploymentSessionError("PLAN_REQUIRED")

    try {
      const stackInput = this.pipeline.planToStackUpsertInput(plan, {
        organizationId: actor.organizationId,
        repositoryConnectionId:
          (session.serverContext as { connectionId?: string } | null)
            ?.connectionId ?? null,
      })
      await this.pipeline.assertDeployExecutionGates({
        organizationId: actor.organizationId,
        stackId: session.stackId ?? "",
        billingMode: stackInput.billingMode ?? "PACKAGE",
        resourcePlanId: stackInput.resourcePlanId ?? null,
        hourlyCost: Number(stackInput.hourlyCost ?? 0),
        paygBufferHours: plan.billing.interval === "hour" ? 24 : 24,
      })
      const stack = await this.pipeline.createOrUpdateStack(stackInput)
      const deployment = await this.pipeline.triggerDeploy({
        stackId: stack.id,
        triggerType: "MANUAL",
      })

      const updated = await this.db.aiDeploymentSession.updateMany({
        where: {
          id: session.id,
          organizationId: actor.organizationId,
          status: "CONFIRMED",
        },
        data: {
          status: "EXECUTING",
          stackId: stack.id,
          deploymentId: deployment.deploymentId,
        },
      })
      if (updated.count !== 1) {
        throw new AiDeploymentSessionError("INVALID_TRANSITION")
      }
      return this.get(actor, session.id)
    } catch (error) {
      await this.db.aiDeploymentSession.updateMany({
        where: {
          id: session.id,
          organizationId: actor.organizationId,
          status: "CONFIRMED",
        },
        data: {
          blockedReason:
            error instanceof Error ? error.message : "EXECUTION_FAILED",
        },
      })
      throw error
    }
  }

  async applyManualSettings({
    actor,
    sessionId,
    settings,
  }: {
    actor: AiDeploymentSessionActor
    sessionId: string
    settings: ManualBuildSettingsInput
  }): Promise<AiDeploymentSession> {
    const session = await this.get(actor, sessionId)
    if (session.status !== "PLAN_READY" && session.status !== "BLOCKED") {
      throw new AiDeploymentSessionError("INVALID_TRANSITION")
    }

    const currentPlan = toDeploymentPlanDTO(session.plan)
    if (!currentPlan) {
      throw new AiDeploymentSessionError("PLAN_REQUIRED")
    }

    const validatedSettings = parseManualBuildSettings(settings)
    const nextPlan: DeploymentPlanDTO = {
      ...currentPlan,
      version: currentPlan.version + 1,
      detection: {
        ...currentPlan.detection,
        runtime: validatedSettings.language,
        framework: validatedSettings.framework,
        version: validatedSettings.runtimeVersion,
        commands: [
          validatedSettings.buildCommand,
          validatedSettings.startCommand,
        ],
        port: validatedSettings.port,
        confidence: null,
        evidence: [],
      },
      provenance: {
        ...currentPlan.provenance,
        analyzer: "manual",
        analyzedAt: new Date().toISOString(),
      },
    }

    const validated = await this.validator.validate({
      organizationId: actor.organizationId,
      plan: {
        ...nextPlan,
        source: { ...nextPlan.source, repositoryConnectionId: null },
        access: { ...nextPlan.access, credentialRef: null },
      },
    })

    const updated = await this.db.aiDeploymentSession.updateMany({
      where: {
        id: sessionId,
        organizationId: actor.organizationId,
        status: session.status,
      },
      data: {
        status: "PLAN_READY",
        currentPlanVersion: validated.plan.version,
        currentPlanHash: validated.hash,
        plan: JSON.parse(
          JSON.stringify(validated.plan)
        ) as Prisma.InputJsonValue,
        blockedReason: null,
        confirmedBy: null,
        confirmedAt: null,
        confirmationPlanHash: null,
        idempotencyKey: null,
      },
    })
    if (updated.count !== 1) {
      throw new AiDeploymentSessionError("INVALID_TRANSITION")
    }
    return this.get(actor, sessionId)
  }

  async selectResourcePlan({
    actor,
    sessionId,
    selection,
  }: {
    actor: AiDeploymentSessionActor
    sessionId: string
    selection: ResourceSelectionInput
  }): Promise<AiDeploymentSession> {
    const session = await this.get(actor, sessionId)
    if (session.status !== "PLAN_READY") {
      throw new AiDeploymentSessionError("INVALID_TRANSITION")
    }

    const currentPlan = toDeploymentPlanDTO(session.plan)
    if (!currentPlan) {
      throw new AiDeploymentSessionError("PLAN_REQUIRED")
    }

    let resolved: ReturnType<typeof resolveResourceSelection>
    try {
      resolved = resolveResourceSelection(selection)
    } catch {
      throw new AiDeploymentSessionError("RESOURCE_SELECTION_INVALID")
    }

    const nextPlan: DeploymentPlanDTO = {
      ...currentPlan,
      version: currentPlan.version + 1,
      resources: {
        ...currentPlan.resources,
        package: selection.resourcePlanId,
        cpu: resolved.cpu,
        memory: resolved.memory,
      },
      billing: {
        ...currentPlan.billing,
        estimate: resolved.hourlyCost,
        interval: "hour",
      },
    }

    const validated = await this.validator.validate({
      organizationId: actor.organizationId,
      plan: {
        ...nextPlan,
        source: { ...nextPlan.source, repositoryConnectionId: null },
        access: { ...nextPlan.access, credentialRef: null },
      },
    })

    const updated = await this.db.aiDeploymentSession.updateMany({
      where: {
        id: sessionId,
        organizationId: actor.organizationId,
        status: session.status,
      },
      data: {
        status: "PLAN_READY",
        currentPlanVersion: validated.plan.version,
        currentPlanHash: validated.hash,
        plan: JSON.parse(
          JSON.stringify(validated.plan)
        ) as Prisma.InputJsonValue,
        blockedReason: null,
        confirmedBy: null,
        confirmedAt: null,
        confirmationPlanHash: null,
        idempotencyKey: null,
      },
    })
    if (updated.count !== 1) {
      throw new AiDeploymentSessionError("INVALID_TRANSITION")
    }
    return this.get(actor, sessionId)
  }

  async setEnvironmentValues({
    actor,
    sessionId,
    values,
  }: {
    actor: AiDeploymentSessionActor
    sessionId: string
    values: { key: string; value: string }[]
  }): Promise<AiDeploymentSession> {
    const session = await this.get(actor, sessionId)
    if (session.status !== "PLAN_READY") {
      throw new AiDeploymentSessionError("INVALID_TRANSITION")
    }

    const currentPlan = toDeploymentPlanDTO(session.plan)
    if (!currentPlan) {
      throw new AiDeploymentSessionError("PLAN_REQUIRED")
    }

    const declaredKeys = new Set(
      currentPlan.configuration.envRequirements.map(
        (requirement) => requirement.key
      )
    )
    for (const { key } of values) {
      if (!declaredKeys.has(key)) {
        throw new AiDeploymentSessionError("ENVIRONMENT_KEY_NOT_DECLARED")
      }
    }

    const nextPlan: DeploymentPlanDTO = {
      ...currentPlan,
      version: currentPlan.version + 1,
      configuration: {
        ...currentPlan.configuration,
        envRequirements: currentPlan.configuration.envRequirements.map(
          (requirement) =>
            values.some((value) => value.key === requirement.key)
              ? { ...requirement, status: "provided" }
              : requirement
        ),
      },
    }

    const validated = await this.validator.validate({
      organizationId: actor.organizationId,
      plan: {
        ...nextPlan,
        source: { ...nextPlan.source, repositoryConnectionId: null },
        access: { ...nextPlan.access, credentialRef: null },
      },
    })

    const encryptedValues = serializeEncryptedField(
      encrypt(JSON.stringify(values), getEncryptionKey())
    )
    const executionRefs = {
      ...((session.executionRefs as Record<string, unknown> | null) ?? {}),
      environmentValues: {
        organizationId: actor.organizationId,
        encrypted: encryptedValues,
      },
    } as Prisma.InputJsonValue

    const updated = await this.db.aiDeploymentSession.updateMany({
      where: {
        id: sessionId,
        organizationId: actor.organizationId,
        status: session.status,
      },
      data: {
        status: "PLAN_READY",
        currentPlanVersion: validated.plan.version,
        currentPlanHash: validated.hash,
        plan: JSON.parse(
          JSON.stringify(validated.plan)
        ) as Prisma.InputJsonValue,
        executionRefs,
        blockedReason: null,
        confirmedBy: null,
        confirmedAt: null,
        confirmationPlanHash: null,
        idempotencyKey: null,
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
