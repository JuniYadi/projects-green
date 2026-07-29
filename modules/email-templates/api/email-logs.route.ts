import { Elysia } from "elysia"
import { z } from "zod"

import {
  requireSuperAdmin,
  type AdminApiError,
} from "@/modules/admin/api/admin.guards"
import { prisma } from "@/lib/prisma"

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().optional(),
  type: z.string().optional(),
  recipient: z.string().optional(),
  organizationId: z.string().optional(),
})

const idParamSchema = z.object({ id: z.string().min(1) })

function mapLog(log: {
  id: string
  recipientEmail: string
  type: string
  subject: string
  status: string
  ticketId: string | null
  ticketNumber: string | null
  errorMessage: string | null
  attempts: number
  sentAt: Date | null
  createdAt: Date
  updatedAt: Date
  organizationId?: string | null
  relatedEntityType?: string | null
  relatedEntityId?: string | null
  providerMessageId?: string | null
  bodyHtml?: string | null
}) {
  return {
    id: log.id,
    recipientEmail: log.recipientEmail,
    type: log.type,
    subject: log.subject,
    status: log.status,
    organizationId: log.organizationId ?? null,
    relatedEntityType: log.relatedEntityType ?? null,
    relatedEntityId: log.relatedEntityId ?? null,
    ticketId: log.ticketId,
    ticketNumber: log.ticketNumber,
    providerMessageId: log.providerMessageId ?? null,
    errorMessage: log.errorMessage,
    attempts: log.attempts,
    sentAt: log.sentAt?.toISOString() ?? null,
    createdAt: log.createdAt.toISOString(),
    updatedAt: log.updatedAt.toISOString(),
    hasPreview: Boolean(log.bodyHtml),
  }
}

function mapLogDetail(log: {
  id: string
  recipientEmail: string
  type: string
  subject: string
  status: string
  ticketId: string | null
  ticketNumber: string | null
  errorMessage: string | null
  attempts: number
  sentAt: Date | null
  createdAt: Date
  updatedAt: Date
  organizationId?: string | null
  relatedEntityType?: string | null
  relatedEntityId?: string | null
  providerMessageId?: string | null
  bodyHtml?: string | null
}) {
  return {
    ...mapLog(log),
    previewUrl: log.bodyHtml ? `/api/email-logs/${log.id}/preview` : null,
  }
}

export type EmailLogRouteDeps = {
  requireSuperAdmin?: typeof requireSuperAdmin
}

export const createEmailLogRoutes = (deps: EmailLogRouteDeps = {}) => {
  const guard = deps.requireSuperAdmin ?? requireSuperAdmin

  return new Elysia({ prefix: "/email-logs" })
    .get(
      "/",
      async ({ query, set }) => {
        const actor = await guard(set)
        if (!actor.ok) return actor as AdminApiError

        const parsed = listQuerySchema.safeParse(query)
        if (!parsed.success) {
          set.status = 400
          return { ok: false, error: "BAD_REQUEST", message: "Invalid query" }
        }

        const { page, limit, status, type, recipient, organizationId } =
          parsed.data
        const offset = (page - 1) * limit

        const where: Record<string, unknown> = {}
        if (status) where.status = status
        if (type) where.type = type
        if (recipient) where.recipientEmail = { contains: recipient }
        if (organizationId) where.organizationId = organizationId

        const [logs, total] = await Promise.all([
          prisma.emailLog.findMany({
            where,
            orderBy: { createdAt: "desc" },
            take: limit,
            skip: offset,
          }),
          prisma.emailLog.count({ where }),
        ])

        return {
          ok: true as const,
          data: logs.map(mapLog),
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        }
      },
      { query: listQuerySchema }
    )
    .get(
      "/:id",
      async ({ params, set }) => {
        const actor = await guard(set)
        if (!actor.ok) return actor as AdminApiError

        const { id } = idParamSchema.parse(params)

        const log = await prisma.emailLog.findUnique({ where: { id } })

        if (!log) {
          set.status = 404
          return {
            ok: false,
            error: "NOT_FOUND",
            message: "Email log not found.",
          }
        }

        return { ok: true as const, data: mapLogDetail(log) }
      },
      { params: idParamSchema }
    )
    .get(
      "/:id/preview",
      async ({ params, set }) => {
        const actor = await guard(set)
        if (!actor.ok) return actor as AdminApiError

        const { id } = idParamSchema.parse(params)

        const log = await prisma.emailLog.findUnique({
          where: { id },
          select: { bodyHtml: true },
        })

        if (!log || !log.bodyHtml) {
          set.status = 404
          return {
            ok: false,
            error: "NOT_FOUND",
            message: "Email log not found.",
          }
        }

        return new Response(log.bodyHtml, {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        })
      },
      { params: idParamSchema }
    )
}

export const emailLogRoutes = createEmailLogRoutes()
