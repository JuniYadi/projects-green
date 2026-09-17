import { Elysia, t } from "elysia"

import {
  AiDeploymentSessionError,
  type AiDeploymentSessionActor,
} from "@/modules/deploy/ai-deployment-session.service"
import {
  AiSessionChatService,
  defaultAiSessionChatService,
} from "@/modules/deploy/services/ai-session-chat.service"
import { requireTenantActor } from "@/modules/tenants/api/tenants.guards"
import {
  isTenantApiError,
  toNotFoundError,
  toPolicyError,
  type RouteSet,
} from "@/modules/tenants/api/tenants.errors"
import { canManageTenant } from "@/modules/tenants/tenant-policy"

export type AiDeploymentSessionChatRouteDependencies = {
  requireActor: (set: RouteSet) => ReturnType<typeof requireTenantActor>
  service: AiSessionChatService
}

const defaultDependencies: AiDeploymentSessionChatRouteDependencies = {
  requireActor: requireTenantActor,
  service: defaultAiSessionChatService,
}

const requireDeploymentActor = async (
  dependencies: AiDeploymentSessionChatRouteDependencies,
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
  throw error
}

export const createAiDeploymentSessionChatRoutes = (
  input: Partial<AiDeploymentSessionChatRouteDependencies> = {}
) => {
  const dependencies: AiDeploymentSessionChatRouteDependencies = {
    ...defaultDependencies,
    ...input,
  }

  return new Elysia({ prefix: "/deploy/ai-sessions" }).post(
    "/:sessionId/chat",
    async ({ params, body, set }) => {
      const actor = await requireDeploymentActor(dependencies, set)
      if (isTenantApiError(actor)) return actor

      try {
        const result = await dependencies.service.handleSessionChat({
          actor,
          sessionId: params.sessionId,
          message: body.message,
          messages: body.messages,
        })
        return result.toResponse()
      } catch (error) {
        return toRouteError(set, error)
      }
    },
    {
      params: t.Object({
        sessionId: t.String({ minLength: 1 }),
      }),
      body: t.Object({
        message: t.String({ minLength: 1, maxLength: 4000 }),
        messages: t.Optional(
          t.Array(
            t.Object({
              role: t.Union([t.Literal("user"), t.Literal("assistant")]),
              content: t.String(),
            })
          )
        ),
      }),
    }
  )
}

export const aiDeploymentSessionChatRoutes =
  createAiDeploymentSessionChatRoutes()
