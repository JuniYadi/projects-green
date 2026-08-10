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
}

const defaultDependencies: AiDeploymentSessionRouteDependencies = {
  requireActor: requireTenantActor,
  service: new AiDeploymentSessionService(),
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
  throw error
}

export const createAiDeploymentSessionRoutes = (
  input: Partial<AiDeploymentSessionRouteDependencies> = {}
) => {
  const dependencies = { ...defaultDependencies, ...input }

  return new Elysia({ prefix: "/deploy/ai-sessions" })
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
