import { Elysia } from "elysia"
import { Prisma, type PrismaClient } from "@prisma/client"
import { z } from "zod"

import { prisma as defaultPrisma } from "@/lib/prisma"
import {
  requireSuperAdmin,
  type AdminApiError,
  type RouteSet,
} from "@/modules/admin/api/admin.guards"
import { toBillingOrderDTO } from "../../orders/order.dto"

const periods = ["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL"] as const
const statuses = [
  "PENDING",
  "CHARGED",
  "FULFILLED",
  "FAILED",
  "CANCELLED",
] as const
const include = {
  lines: { orderBy: { periodStart: "asc" } },
  serviceSubscription: {
    include: {
      package: { select: { code: true } },
      plan: { select: { code: true } },
    },
  },
  billingInvoice: {
    select: { id: true, invoiceNumber: true, status: true, paidAt: true },
  },
} as const

type OrdersDb = Pick<PrismaClient, "billingOrder">
type AdminOrdersRouteDeps = {
  requireSuperAdmin?: typeof requireSuperAdmin
  prisma?: OrdersDb
}

const querySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    organizationId: z.string().trim().min(1).optional(),
    packageCode: z.string().trim().min(1).optional(),
    status: z.enum(statuses).optional(),
    billingPeriod: z.enum(periods).optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.from && value.to && value.to < value.from) {
      ctx.addIssue({
        code: "custom",
        path: ["to"],
        message: "to must be later than from.",
      })
    }
  })

function validationError(set: RouteSet) {
  set.status = 422
  return {
    ok: false as const,
    error: "VALIDATION_ERROR",
    message: "Invalid order filters.",
  }
}

export const createAdminOrdersRoutes = (deps: AdminOrdersRouteDeps = {}) => {
  const guard = deps.requireSuperAdmin ?? requireSuperAdmin
  const db = deps.prisma ?? defaultPrisma

  return new Elysia().get("/admin/orders", async ({ query, set }) => {
    const actor = await guard(set)
    if ("ok" in actor && !actor.ok) return actor as AdminApiError
    const parsed = querySchema.safeParse(query)
    if (!parsed.success) return validationError(set)
    const {
      page,
      limit,
      organizationId,
      packageCode,
      status,
      billingPeriod,
      from,
      to,
    } = parsed.data
    const where: Prisma.BillingOrderWhereInput = {
      ...(organizationId ? { organizationId } : {}),
      ...(status ? { status } : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
      ...(packageCode || billingPeriod
        ? {
            lines: {
              some: {
                ...(packageCode ? { packageCode: packageCode as never } : {}),
                ...(billingPeriod ? { billingPeriod } : {}),
              },
            },
          }
        : {}),
    }
    try {
      const skip = (page - 1) * limit
      const [rows, total] = await Promise.all([
        db.billingOrder.findMany({
          where,
          include,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        db.billingOrder.count({ where }),
      ])
      const orders = rows.map((row) => toBillingOrderDTO(row as never))
      return {
        ok: true as const,
        orders,
        data: orders,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      }
    } catch (error) {
      console.error("[AdminOrdersList] Error:", error)
      set.status = 500
      return {
        ok: false as const,
        error: "INTERNAL_SERVER_ERROR",
        message: "Unable to load orders.",
      }
    }
  })
}

export const adminOrdersRoutes = createAdminOrdersRoutes()
