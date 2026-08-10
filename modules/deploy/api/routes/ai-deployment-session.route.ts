import {
  AiDeploymentSessionStatus,
  AiDeploymentSourceType,
} from "@prisma/client"
import { Elysia, t } from "elysia"

import { toAiDeploymentSessionDTO } from "@/modules/deploy/ai-deployment-session.dto"
import {
  AiDeploymentSessionError,
  AiDeploymentSessionService,
  type AiDeploymentSessionActor,
} from "@/modules/deploy/ai-deployment-session.service"
import {
  toAiSourceInspectionDTO,
  type AiSourceInspectionRequestDTO,
} from "@/modules/deploy/ai-source-inspection.dto"
import {
  AiSourceInspectionError,
  AiSourceInspectionService,
} from "@/modules/deploy/ai-source-inspection.service"
import { DeploymentPlanValidationError } from "@/modules/deploy/deployment-plan.validator"
import { requireTenantActor } from "@/modules/tenants/api/tenants.guards"
import {
  isTenantApiError,
  toPolicyError,
  toNotFoundError,
  type RouteSet,
} from "@/modules/tenants/api/tenants.errors"
import { canManageTenant } from "@/modules/tenants/tenant-policy"

type AiDeploymentSessionRouteDependencies = {
  requireActor: (set: RouteSet) => ReturnType<typeof requireTenantActor>
  service: AiDeploymentSessionService
  inspectionService: AiSourceInspectionService
}

const defaultSessionService = new AiDeploymentSessionService()

const defaultDependencies: AiDeploymentSessionRouteDependencies = {
  requireActor: requireTenantActor,
  service: defaultSessionService,
  inspectionService: new AiSourceInspectionService({
    sessions: defaultSessionService,
  }),
}

const requireDeploymentActor = async (
  dependencies: AiDeploymentSessionRouteDependencies,
  set: RouteSet
): Promise<AiDeploymentSessionActor | ReturnType<typeof toPolicyError>> => {
  const actor = await dependencies.requireActor(set)
  if (isTenantApiError(actor)) {
    return actor
  }
  if (!actor.organizationId || !canManageTenant(actor)) {
    return toPolicyError(
      set,
      "AI_DEPLOYMENT_SESSION_FORBIDDEN",
      "You are not allowed to manage AI deployment sessions."
    )
  }
  return { organizationId: actor.organizationId, userId: actor.userId }
}

const toRouteError = (set: RouteSet, error: unknown) => {
  if (error instanceof AiDeploymentSessionError) {
    if (error.code === "NOT_FOUND") {
      return toNotFoundError(set, "AI deployment session not found")
    }
    set.status = 409
    return { ok: false as const, error: error.code, message: error.code }
  }
  if (error instanceof DeploymentPlanValidationError) {
    set.status = 422
    return { ok: false as const, error: error.code, message: error.code }
  }
  if (error instanceof AiSourceInspectionError) {
    set.status = 409
    return { ok: false as const, error: error.code, message: error.code }
  }
  throw error
}

export const createAiDeploymentSessionRoutes = (
  input: Partial<
    Omit<AiDeploymentSessionRouteDependencies, "inspectionService">
  > & { inspectionService?: AiSourceInspectionService } = {}
) => {
  const service = input.service ?? defaultDependencies.service
  const dependencies: AiDeploymentSessionRouteDependencies = {
    ...defaultDependencies,
    ...input,
    service,
    inspectionService:
      input.inspectionService ??
      new AiSourceInspectionService({ sessions: service }),
  }

  return new Elysia({ prefix: "/deploy/ai-sessions" })
    .post(
      "/inspect",
      async ({ body, set }) => {
        const actor = await requireDeploymentActor(dependencies, set)
        if (isTenantApiError(actor)) return actor

        const request: AiSourceInspectionRequestDTO = {
          sourceUrl: body.sourceUrl,
          ref: body.ref,
          subdir: body.subdir,
          sessionId: body.sessionId,
        }

        try {
          const result = await dependencies.inspectionService.inspect({
            actor,
            request,
          })
          return {
            ok: true as const,
            data: toAiSourceInspectionDTO(result),
          }
        } catch (error) {
          return toRouteError(set, error)
        }
      },
      {
        body: t.Object({
          sourceUrl: t.String({ minLength: 1, maxLength: 2048 }),
          ref: t.Optional(t.String({ maxLength: 255 })),
          subdir: t.Optional(t.String({ maxLength: 512 })),
          sessionId: t.Optional(t.String({ maxLength: 128 })),
        }),
      }
    )
    .post(
      "/",
      async ({ body, set }) => {
        const actor = await requireDeploymentActor(dependencies, set)
        if (isTenantApiError(actor)) return actor

        try {
          const session = await dependencies.service.create({
            actor,
            sourceType: body.sourceType ?? "SOURCE",
          })
          return { ok: true as const, data: toAiDeploymentSessionDTO(session) }
        } catch (error) {
          return toRouteError(set, error)
        }
      },
      {
        body: t.Object({
          sourceType: t.Optional(
            t.Union([t.Literal("SOURCE"), t.Literal("TEMPLATE")])
          ),
        }),
      }
    )
    .get("/:sessionId", async ({ params, set }) => {
      const actor = await requireDeploymentActor(dependencies, set)
      if (isTenantApiError(actor)) return actor

      try {
        const session = await dependencies.service.get(actor, params.sessionId)
        return { ok: true as const, data: toAiDeploymentSessionDTO(session) }
      } catch (error) {
        return toRouteError(set, error)
      }
    })
    .post(
      "/:sessionId/transition",
      async ({ params, body, set }) => {
        const actor = await requireDeploymentActor(dependencies, set)
        if (isTenantApiError(actor)) return actor

        try {
          const session = await dependencies.service.transition({
            actor,
            sessionId: params.sessionId,
            status: body.status,
            plan: body.plan,
            blockedReason: body.blockedReason,
          })
          return { ok: true as const, data: toAiDeploymentSessionDTO(session) }
        } catch (error) {
          return toRouteError(set, error)
        }
      },
      {
        body: t.Object({
          status: t.Enum(AiDeploymentSessionStatus),
          plan: t.Optional(t.Any()),
          blockedReason: t.Optional(t.String({ maxLength: 500 })),
        }),
      }
    )
    .post(
      "/:sessionId/confirm",
      async ({ params, body, set }) => {
        const actor = await requireDeploymentActor(dependencies, set)
        if (isTenantApiError(actor)) return actor

        try {
          const session = await dependencies.service.confirm({
            actor,
            sessionId: params.sessionId,
            planVersion: body.planVersion,
            planHash: body.planHash,
            idempotencyKey: body.idempotencyKey,
          })
          return { ok: true as const, data: toAiDeploymentSessionDTO(session) }
        } catch (error) {
          return toRouteError(set, error)
        }
      },
      {
        body: t.Object({
          planVersion: t.Integer({ minimum: 1 }),
          planHash: t.String({ minLength: 1, maxLength: 128 }),
          idempotencyKey: t.String({ minLength: 1, maxLength: 128 }),
        }),
      }
    )
}

export const aiDeploymentSessionRoutes = createAiDeploymentSessionRoutes()
