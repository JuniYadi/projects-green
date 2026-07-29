import { Elysia } from "elysia"
import { z } from "zod"

import { adminAuthGuard } from "@/modules/admin/api/admin.guards"
import { prisma } from "@/lib/prisma"
import { toEmailLogListItemDTO, toEmailLogDetailDTO } from "./email-logs.dto"

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().optional(),
  type: z.string().optional(),
  recipient: z.string().optional(),
  organizationId: z.string().optional(),
})

const idParamSchema = z.object({ id: z.string().min(1) })

export const emailLogRoutes = new Elysia({ prefix: "/email-logs" })
  .use(adminAuthGuard)
  .get(
    "/",
    async ({ query, set }) => {
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
        data: logs.map(toEmailLogListItemDTO),
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

      return { ok: true as const, data: toEmailLogDetailDTO(log) }
    },
    { params: idParamSchema }
  )
  .get(
    "/:id/preview",
    async ({ params, set }) => {
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
