import { Elysia } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { z } from "zod"

import { fieldErrorMapFromIssues } from "@/lib/validation"
import {
  createSupportTicketService,
  SupportTicketAccessDeniedError,
  SupportTicketContentUnavailableError,
  SupportTicketNotFoundError,
  type SupportTicketService,
} from "@/modules/support-tickets/support-ticket.service"
import {
  supportTicketDepartmentSchema,
  supportTicketPrioritySchema,
  supportTicketServiceSchema,
} from "@/modules/support-tickets/support-ticket.schema"
import { resolveTenantRoleFromClaims } from "@/modules/tenants/tenant-policy"

type SupportTicketAuthContext = {
  organizationId?: string | null
  role?: string | null
  roles?: string[] | null
  user: {
    email?: string | null
    id: string
  } | null
}

type RouteSet = {
  status?: number | string
}

type SupportTicketRouteDependencies = {
  authenticate: () => Promise<SupportTicketAuthContext>
  getPlatformRole: (input: {
    email?: string | null
    id?: string | null
  }) => Promise<"none" | "super_admin">
  service: SupportTicketService
}

const createDefaultDependencies = (): SupportTicketRouteDependencies => ({
  authenticate: () => withAuth(),
  getPlatformRole: async (input) => {
    const platformRoleModule = await import("@/lib/platform-role")
    return platformRoleModule.getPlatformRoleForUser(input)
  },
  service: createSupportTicketService(),
})

const toUnauthorized = (set: RouteSet) => {
  set.status = 401

  return {
    ok: false as const,
    error: "UNAUTHORIZED" as const,
    message: "You must be signed in to manage support tickets.",
  }
}

const toMissingTenantContext = (set: RouteSet) => {
  set.status = 403

  return {
    ok: false as const,
    error: "TENANT_CONTEXT_REQUIRED" as const,
    message: "An active organization context is required for support tickets.",
  }
}

const toErrorResponse = (set: RouteSet, error: unknown) => {
  if (error instanceof SupportTicketNotFoundError) {
    set.status = 404
    return {
      ok: false as const,
      error: "TICKET_NOT_FOUND" as const,
      message: error.message,
    }
  }

  if (error instanceof SupportTicketAccessDeniedError) {
    set.status = 403
    return {
      ok: false as const,
      error: "FORBIDDEN" as const,
      message: error.message,
    }
  }

  if (error instanceof SupportTicketContentUnavailableError) {
    set.status = 503
    return {
      ok: false as const,
      error: "CONTENT_UNAVAILABLE" as const,
      message: error.message,
    }
  }

  if (error instanceof z.ZodError) {
    set.status = 422
    const issues = error.issues.map((issue) => ({
      path: issue.path,
      message: issue.message,
    }))

    return {
      ok: false as const,
      error: "VALIDATION_ERROR" as const,
      message: "Please fix the highlighted fields and try again.",
      fieldErrors: fieldErrorMapFromIssues(issues),
    }
  }

  throw error
}

const toActorContext = async (
  auth: SupportTicketAuthContext,
  getPlatformRole: SupportTicketRouteDependencies["getPlatformRole"]
) => {
  const user = auth.user

  if (!user) {
    throw new Error("UNAUTHORIZED")
  }

  if (!auth.organizationId) {
    throw new Error("TENANT_CONTEXT_REQUIRED")
  }

  const platformRole = await getPlatformRole({
    id: user.id,
    email: user.email,
  })
  const tenantRole = resolveTenantRoleFromClaims(auth.role, auth.roles ?? null)

  return {
    workosUserId: user.id,
    organizationId: auth.organizationId,
    isSuperAdmin: platformRole === "super_admin",
    canManageTickets: tenantRole === "owner" || tenantRole === "admin",
  }
}

const createRouteHandler = (
  dependencies: SupportTicketRouteDependencies,
  handler: (input: {
    actor: {
      canManageTickets?: boolean
      isSuperAdmin?: boolean
      organizationId: string
      workosUserId: string
    }
    body: unknown
    params: Record<string, unknown>
    set: RouteSet
  }) => Promise<unknown>
) => {
  return async (context: {
    body: unknown
    params: Record<string, unknown>
    set: RouteSet
  }) => {
    const { body, params, set } = context
    const auth = await dependencies.authenticate()

    if (!auth.user) {
      return toUnauthorized(set)
    }

    try {
      const actor = await toActorContext(auth, dependencies.getPlatformRole)
      return await handler({
        actor,
        body,
        params,
        set,
      })
    } catch (error) {
      if (error instanceof Error && error.message === "UNAUTHORIZED") {
        return toUnauthorized(set)
      }

      if (error instanceof Error && error.message === "TENANT_CONTEXT_REQUIRED") {
        return toMissingTenantContext(set)
      }

      return toErrorResponse(set, error)
    }
  }
}

const supportTicketCreateBodySchema = z.object({
  department: supportTicketDepartmentSchema,
  priority: supportTicketPrioritySchema,
  service: supportTicketServiceSchema.nullable().optional(),
  subject: z.string().trim().min(3),
  description: z.string().trim().min(1).nullable().optional(),
  secureForm: z.string().trim().min(1).nullable().optional(),
  uploadSessionIds: z.array(z.string().trim().min(1)).default([]).optional(),
})

const supportTicketReplyBodySchema = z.object({
  body: z.string().trim().min(1),
  secureForm: z.string().trim().min(1).nullable().optional(),
  isInternalNote: z.boolean().default(false).optional(),
  uploadSessionIds: z.array(z.string().trim().min(1)).default([]).optional(),
})

const supportTicketIdParamsSchema = z.object({
  ticketId: z.string().trim().min(1),
})

export const createSupportTicketRoutes = (
  dependencies: SupportTicketRouteDependencies = createDefaultDependencies()
) => {
  return new Elysia({ prefix: "/support-tickets" })
    .get(
      "/",
      createRouteHandler(dependencies, async ({ actor }) => {
        const tickets = await dependencies.service.listTickets({
          actor,
        })

        return {
          ok: true as const,
          tickets,
        }
      })
    )
    .post(
      "/",
      createRouteHandler(dependencies, async ({ actor, body, set }) => {
        const payload = supportTicketCreateBodySchema.parse(body)
        const ticket = await dependencies.service.createTicket({
          organizationId: actor.organizationId,
          requesterWorkosUserId: actor.workosUserId,
          department: payload.department,
          priority: payload.priority,
          service: payload.service,
          subject: payload.subject,
          description: payload.description,
          secureForm: payload.secureForm,
          uploadSessionIds: payload.uploadSessionIds,
        })

        set.status = 201

        return {
          ok: true as const,
          ticket,
        }
      }),
      {
        body: supportTicketCreateBodySchema,
      }
    )
    .get(
      "/:ticketId",
      createRouteHandler(dependencies, async ({ actor, params }) => {
        const parsedParams = supportTicketIdParamsSchema.parse(params)
        const thread = await dependencies.service.getTicketThread({
          actor,
          ticketId: parsedParams.ticketId,
        })

        return {
          ok: true as const,
          thread,
        }
      }),
      {
        params: supportTicketIdParamsSchema,
      }
    )
    .post(
      "/:ticketId/replies",
      createRouteHandler(dependencies, async ({ actor, body, params, set }) => {
        const parsedParams = supportTicketIdParamsSchema.parse(params)
        const payload = supportTicketReplyBodySchema.parse(body)

        const reply = await dependencies.service.addReply({
          actor,
          reply: {
            ticketId: parsedParams.ticketId,
            authorWorkosUserId: actor.workosUserId,
            body: payload.body,
            secureForm: payload.secureForm,
            isInternalNote: payload.isInternalNote,
            uploadSessionIds: payload.uploadSessionIds,
          },
        })

        set.status = 201

        return {
          ok: true as const,
          reply,
        }
      }),
      {
        params: supportTicketIdParamsSchema,
        body: supportTicketReplyBodySchema,
      }
    )
    .post(
      "/:ticketId/close",
      createRouteHandler(dependencies, async ({ actor, params }) => {
        const parsedParams = supportTicketIdParamsSchema.parse(params)
        const ticket = await dependencies.service.transitionStatus({
          actor,
          ticketId: parsedParams.ticketId,
          nextStatus: "closed",
        })

        return {
          ok: true as const,
          ticket,
        }
      }),
      {
        params: supportTicketIdParamsSchema,
      }
    )
}

export const supportTicketRoutes = createSupportTicketRoutes()
export type App = ReturnType<typeof createSupportTicketRoutes>
