import { Elysia, t } from "elysia"

import { toAiDeploymentSessionDTO } from "@/modules/deploy/ai-deployment-session.dto"
import {
  AiDeploymentSessionError,
  AiDeploymentSessionService,
  type AiDeploymentSessionActor,
} from "@/modules/deploy/ai-deployment-session.service"
import type { ManualBuildSettingsInput } from "@/modules/deploy/manual-build-settings"
import type { ResourceSelectionInput } from "@/modules/deploy/resource-selection"
import { requireTenantActor } from "@/modules/tenants/api/tenants.guards"
import {
  isTenantApiError,
  toNotFoundError,
  toPolicyError,
  type RouteSet,
} from "@/modules/tenants/api/tenants.errors"
import { canManageTenant } from "@/modules/tenants/tenant-policy"

type AiDeploymentSessionDecisionRouteDependencies = {
  requireActor: (set: RouteSet) => ReturnType<typeof requireTenantActor>
  service: AiDeploymentSessionService
}

const defaultDependencies: AiDeploymentSessionDecisionRouteDependencies = {
  requireActor: requireTenantActor,
  service: new AiDeploymentSessionService(),
}

const requireDeploymentActor = async (
  dependencies: AiDeploymentSessionDecisionRouteDependencies,
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
    if (error.code === "MANUAL_SETTINGS_INVALID") {
      set.status = 422
      return { ok: false as const, error: error.code, message: error.code }
    }
    if (error.code === "RESOURCE_SELECTION_INVALID") {
      set.status = 422
      return { ok: false as const, error: error.code, message: error.code }
    }
    set.status = 409
    return { ok: false as const, error: error.code, message: error.code }
  }
  throw error
}

export const createAiDeploymentSessionDecisionRoutes = (
  input: Partial<AiDeploymentSessionDecisionRouteDependencies> = {}
) => {
  const dependencies = { ...defaultDependencies, ...input }

  return new Elysia({ prefix: "/deploy/ai-sessions" })
    .post(
      "/:sessionId/manual-settings",
      async ({ params, body, set }) => {
        const actor = await requireDeploymentActor(dependencies, set)
        if (isTenantApiError(actor)) return actor

        const settings: ManualBuildSettingsInput = body
        try {
          const session = await dependencies.service.applyManualSettings({
            actor,
            sessionId: params.sessionId,
            settings,
          })
          return { ok: true as const, data: toAiDeploymentSessionDTO(session) }
        } catch (error) {
          return toRouteError(set, error)
        }
      },
      {
        body: t.Object({
          language: t.String({ minLength: 1 }),
          framework: t.String({ minLength: 1 }),
          runtimeVersion: t.String({ minLength: 1 }),
          packageManager: t.String({ minLength: 1 }),
          buildCommand: t.String({ minLength: 1 }),
          startCommand: t.String({ minLength: 1 }),
          port: t.Integer({ minimum: 1, maximum: 65535 }),
          useDockerfile: t.Boolean(),
          dockerfilePath: t.Union([t.String(), t.Null()]),
        }),
      }
    )
    .post(
      "/:sessionId/resource-selection",
      async ({ params, body, set }) => {
        const actor = await requireDeploymentActor(dependencies, set)
        if (isTenantApiError(actor)) return actor

        const selection: ResourceSelectionInput = body
        try {
          const session = await dependencies.service.selectResourcePlan({
            actor,
            sessionId: params.sessionId,
            selection,
          })
          return { ok: true as const, data: toAiDeploymentSessionDTO(session) }
        } catch (error) {
          return toRouteError(set, error)
        }
      },
      {
        body: t.Object({
          resourcePlanId: t.Union([
            t.Literal("starter"),
            t.Literal("pro"),
            t.Literal("payg"),
          ]),
          cpu: t.Optional(t.Number()),
          memory: t.Optional(t.Number()),
          bufferHours: t.Optional(t.Number()),
        }),
      }
    )
}

export const aiDeploymentSessionDecisionRoutes =
  createAiDeploymentSessionDecisionRoutes()
