import { Elysia } from "elysia"
import { withAuth, getWorkOS } from "@workos-inc/authkit-nextjs"
import { z } from "zod"

import { createSupportTicketAttachmentStorage } from "@/modules/support-tickets/support-ticket-attachment.storage"

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
  supportTicketStatusSchema,
} from "@/modules/support-tickets/support-ticket.schema"
import {
  resolveTenantRoleFromClaims,
  hasScopedSuperAdminClaim,
} from "@/modules/tenants/tenant-policy"
import {
  createEmailService,
  type EmailService,
} from "@/modules/support-tickets/email.service"

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
  emailService: EmailService
}

async function resolveRequesterEmail(
  requesterWorkosUserId: string,
): Promise<string | null> {
  try {
    const workos = getWorkOS()
    const user = await workos.userManagement.getUser(requesterWorkosUserId)
    return user.email ?? null
  } catch {
    return null
  }
}

const createDefaultDependencies = (): SupportTicketRouteDependencies => ({
  authenticate: () => withAuth(),
  getPlatformRole: async (input) => {
    const platformRoleModule = await import("@/lib/platform-role")
    return platformRoleModule.getPlatformRoleForUser(input)
  },
  service: createSupportTicketService(),
  emailService: createEmailService(),
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
  console.error("[Support Ticket API Error]:", error)
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
  const hasClaimedSuperAdmin = hasScopedSuperAdminClaim(
    auth.role,
    auth.roles ?? null
  )

  return {
    workosUserId: user.id,
    organizationId: auth.organizationId,
    isSuperAdmin: platformRole === "super_admin" || hasClaimedSuperAdmin,
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
    requesterEmail: string | undefined
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
        requesterEmail: auth.user.email ?? undefined,
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

const supportTicketAdminCreateBodySchema = z.object({
  organizationId: z.string().trim().min(1),
  department: supportTicketDepartmentSchema,
  priority: supportTicketPrioritySchema,
  service: supportTicketServiceSchema.nullable().optional(),
  subject: z.string().trim().min(3),
  description: z.string().trim().min(1).nullable().optional(),
  secureForm: z.string().trim().min(1).nullable().optional(),
  uploadSessionIds: z.array(z.string().trim().min(1)).default([]).optional(),
})

const supportTicketAdminUpdateBodySchema = z.object({
  department: supportTicketDepartmentSchema.optional(),
  priority: supportTicketPrioritySchema.optional(),
  service: supportTicketServiceSchema.nullable().optional(),
  subject: z.string().trim().min(3).optional(),
  description: z.string().trim().min(1).nullable().optional(),
  status: supportTicketStatusSchema.optional(),
  assignedAgentWorkosUserId: z.string().trim().nullable().optional(),
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
      createRouteHandler(dependencies, async ({ actor, body, requesterEmail, set }) => {
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

        if (requesterEmail) {
          dependencies.emailService.sendTicketCreated(ticket, requesterEmail).catch((err) => {
            console.error("[Support Ticket] Failed to send ticket created email:", err)
          })
        } else {
          console.warn("[Support Ticket] No requester email available for ticket created notification:", ticket.id)
        }

        return {
          ok: true as const,
          ticket,
        }
      }),
      {
        body: supportTicketCreateBodySchema,
      }
    )
    .post(
      "/preview",
      createRouteHandler(dependencies, async ({ body }) => {
        const payload = z.object({ markdown: z.string() }).parse(body)
        const html = typeof Bun !== "undefined" ? Bun.markdown.html(payload.markdown, { tagFilter: true }) : payload.markdown
        return {
          ok: true as const,
          html,
        }
      })
    )
    .get(
      "/:ticketId",
      createRouteHandler(dependencies, async ({ actor, params }) => {
        const parsedParams = supportTicketIdParamsSchema.parse(params)
        const thread = await dependencies.service.getTicketThread({
          actor,
          ticketId: parsedParams.ticketId,
        })

        // Fetch user profiles for all authors in the thread
        const uniqueUserIds = new Set<string>()
        if (thread.ticket.requesterWorkosUserId) {
          uniqueUserIds.add(thread.ticket.requesterWorkosUserId)
        }
        if (thread.ticket.assignedAgentWorkosUserId) {
          uniqueUserIds.add(thread.ticket.assignedAgentWorkosUserId)
        }
        for (const reply of thread.replies) {
          if (reply.authorWorkosUserId) {
            uniqueUserIds.add(reply.authorWorkosUserId)
          }
        }

        const users: Record<string, { name: string; avatarUrl: string | null; isStaff: boolean }> = {}
        const fetchPromises = Array.from(uniqueUserIds).map(async (userId) => {
          try {
            let email: string | null = null
            let firstName = ""
            let lastName = ""
            let profilePictureUrl: string | null = null

            try {
              const workos = getWorkOS()
              const user = await workos.userManagement.getUser(userId)
              email = user.email ?? null
              firstName = user.firstName ?? ""
              lastName = user.lastName ?? ""
              profilePictureUrl = user.profilePictureUrl ?? null
            } catch {
              // Gracefully handle WorkOS client / configuration errors in development/testing
            }

            const platformRole = await dependencies.getPlatformRole({ id: userId, email: email })
            let isStaff = platformRole === "super_admin"
            if (!isStaff) {
              try {
                const workos = getWorkOS()
                const memberships = await workos.userManagement.listOrganizationMemberships({
                  userId,
                })
                isStaff = memberships.data.some((membership) =>
                  hasScopedSuperAdminClaim(
                    membership.role?.slug,
                    membership.roles?.map((r) => r.slug)
                  )
                )
              } catch {
                // Gracefully handle WorkOS client / configuration errors in development/testing
              }
            }
            const fullName = [firstName, lastName].filter(Boolean).join(" ").trim()
            const emailLocalPart = email?.split("@")[0]?.trim() ?? ""
            const name = fullName || emailLocalPart || `User (${userId.slice(-4)})`

            users[userId] = {
              name,
              avatarUrl: profilePictureUrl,
              isStaff,
            }
          } catch {
            users[userId] = {
              name: `User (${userId.slice(-4)})`,
              avatarUrl: null,
              isStaff: false,
            }
          }
        })

        let organizationName: string | null = null
        let organizationMetadata: Record<string, string> | null = null
        const fetchOrgPromise = (async () => {
          try {
            const workos = getWorkOS()
            const org = await workos.organizations.getOrganization(thread.ticket.organizationId)
            organizationName = org.name ?? null
            organizationMetadata = (org.metadata as Record<string, string>) ?? null
          } catch {
            // Gracefully handle WorkOS organization lookup failure in dev/testing
          }
        })()

        await Promise.all([...fetchPromises, fetchOrgPromise])

        const compiledReplies = thread.replies.map((reply) => ({
          ...reply,
          bodyHtml: typeof Bun !== "undefined" ? Bun.markdown.html(reply.body, { tagFilter: true }) : reply.body,
        }))
        const compiledTicket = {
          ...thread.ticket,
          descriptionHtml: thread.ticket.description
            ? (typeof Bun !== "undefined" ? Bun.markdown.html(thread.ticket.description, { tagFilter: true }) : thread.ticket.description)
            : null,
          organizationName,
          organizationMetadata,
        }

        return {
          ok: true as const,
          thread: {
            ticket: compiledTicket,
            replies: compiledReplies,
            users,
          },
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

        const thread = await dependencies.service.getTicketThread({
          actor,
          ticketId: parsedParams.ticketId,
        })

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

        // Send email notification to ticket requester (if not internal note and not self-reply)
        if (!payload.isInternalNote && thread.ticket.requesterWorkosUserId !== actor.workosUserId) {
          resolveRequesterEmail(thread.ticket.requesterWorkosUserId)
            .then((requesterEmail) => {
              if (requesterEmail) {
                dependencies.emailService.sendTicketReplied(thread.ticket, reply, requesterEmail).catch((err) => {
                  console.error("[Support Ticket] Failed to send ticket replied email:", err)
                })
              } else {
                console.warn("[Support Ticket] Could not resolve requester email for reply notification:", thread.ticket.id)
              }
            })
            .catch((err) => {
              console.error("[Support Ticket] Failed to resolve requester email for reply notification:", err)
            })
        }

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

        // Send email notification when ticket is closed
        resolveRequesterEmail(ticket.requesterWorkosUserId)
          .then((requesterEmail) => {
            if (requesterEmail) {
              dependencies.emailService.sendTicketClosed(ticket, requesterEmail).catch((err) => {
                console.error("[Support Ticket] Failed to send ticket closed email:", err)
              })
            } else {
              console.warn("[Support Ticket] Could not resolve requester email for close notification:", ticket.id)
            }
          })
          .catch((err) => {
            console.error("[Support Ticket] Failed to resolve requester email for close notification:", err)
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
    .get(
      "/attachments/:attachmentId",
      createRouteHandler(dependencies, async ({ actor, params, set }) => {
        const id = String(params.attachmentId)
        if (!dependencies.service.getAttachmentSession) {
          set.status = 500
          return {
            ok: false as const,
            error: "NOT_IMPLEMENTED" as const,
            message: "Attachment session retrieval service is not implemented.",
          }
        }

        const session = await dependencies.service.getAttachmentSession({
          actor,
          attachmentId: id,
        })

        if (!session) {
          set.status = 404
          return {
            ok: false as const,
            error: "ATTACHMENT_NOT_FOUND" as const,
            message: "Attachment not found.",
          }
        }

        if (!actor.isSuperAdmin && actor.organizationId !== session.organizationId) {
          set.status = 403
          return {
            ok: false as const,
            error: "FORBIDDEN" as const,
            message: "Access denied.",
          }
        }

        const storage = createSupportTicketAttachmentStorage()
        if (!storage.getFile) {
          set.status = 500
          return {
            ok: false as const,
            error: "STORAGE_MISCONFIGURED" as const,
            message: "Attachment storage does not support retrieval.",
          }
        }

        const s3File = storage.getFile(session.storageKey)
        const exists = await s3File.exists()

        if (!exists) {
          set.status = 404
          return {
            ok: false as const,
            error: "FILE_NOT_FOUND" as const,
            message: "Attachment file not found in storage.",
          }
        }

        const arrayBuffer = await s3File.arrayBuffer()
        return new Response(arrayBuffer, {
          headers: {
            "content-type": session.mimeType,
            "content-disposition": `inline; filename="${encodeURIComponent(session.fileName)}"`,
          },
        })
      }),
      {
        params: z.object({
          attachmentId: z.string().trim().min(1),
        }),
      }
    )
    .get(
      "/admin",
      createRouteHandler(dependencies, async ({ actor, set }) => {
        if (!actor.isSuperAdmin) {
          set.status = 403
          return {
            ok: false as const,
            error: "FORBIDDEN" as const,
            message: "Only super admins can view all support tickets.",
          }
        }

        const tickets = await dependencies.service.listAllTickets({
          actor,
        })

        return {
          ok: true as const,
          tickets,
        }
      })
    )
    .get(
      "/admin/organizations",
      createRouteHandler(dependencies, async ({ actor, set }) => {
        if (!actor.isSuperAdmin) {
          set.status = 403
          return {
            ok: false as const,
            error: "FORBIDDEN" as const,
            message: "Only super admins can view organizations.",
          }
        }

        try {
          const workos = getWorkOS()
          const response = await workos.organizations.listOrganizations({ limit: 100 })
          const organizations = response.data.map((org) => ({
            id: org.id,
            name: org.name,
          }))

          return {
            ok: true as const,
            organizations,
          }
        } catch (error) {
          console.error("[Support Ticket Admin API] Failed to list organizations:", error)
          set.status = 500
          return {
            ok: false as const,
            error: "INTERNAL_SERVER_ERROR" as const,
            message: "Failed to list WorkOS organizations.",
          }
        }
      })
    )
    .post(
      "/admin",
      createRouteHandler(dependencies, async ({ actor, body, set }) => {
        if (!actor.isSuperAdmin) {
          set.status = 403
          return {
            ok: false as const,
            error: "FORBIDDEN" as const,
            message: "Only super admins can create tickets for organizations.",
          }
        }

        const payload = supportTicketAdminCreateBodySchema.parse(body)
        const ticket = await dependencies.service.createTicket({
          organizationId: payload.organizationId,
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
        body: supportTicketAdminCreateBodySchema,
      }
    )
    .put(
      "/admin/:ticketId",
      createRouteHandler(dependencies, async ({ actor, body, params, set }) => {
        if (!actor.isSuperAdmin) {
          set.status = 403
          return {
            ok: false as const,
            error: "FORBIDDEN" as const,
            message: "Only super admins can update support tickets.",
          }
        }

        const parsedParams = supportTicketIdParamsSchema.parse(params)
        const payload = supportTicketAdminUpdateBodySchema.parse(body)

        const ticket = await dependencies.service.updateTicket({
          actor,
          ticketId: parsedParams.ticketId,
          data: {
            department: payload.department,
            priority: payload.priority,
            service: payload.service,
            subject: payload.subject,
            description: payload.description,
            status: payload.status,
            assignedAgentWorkosUserId: payload.assignedAgentWorkosUserId,
          },
        })

        return {
          ok: true as const,
          ticket,
        }
      }),
      {
        params: supportTicketIdParamsSchema,
        body: supportTicketAdminUpdateBodySchema,
      }
    )
    .delete(
      "/admin/:ticketId",
      createRouteHandler(dependencies, async ({ actor, params, set }) => {
        if (!actor.isSuperAdmin) {
          set.status = 403
          return {
            ok: false as const,
            error: "FORBIDDEN" as const,
            message: "Only super admins can delete support tickets.",
          }
        }

        const parsedParams = supportTicketIdParamsSchema.parse(params)
        await dependencies.service.deleteTicket({
          actor,
          ticketId: parsedParams.ticketId,
        })

        return {
          ok: true as const,
        }
      }),
      {
        params: supportTicketIdParamsSchema,
      }
    )
}

export const supportTicketRoutes = createSupportTicketRoutes()
export type App = ReturnType<typeof createSupportTicketRoutes>
