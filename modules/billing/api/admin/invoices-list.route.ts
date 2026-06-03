import { Elysia } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { z } from "zod"
import { Prisma } from "@prisma/client"
import Decimal = Prisma.Decimal

import { prisma } from "@/lib/prisma"
import { getPlatformRoleForUser } from "@/lib/platform-role"
import type { PlatformAccessRole } from "@/lib/platform-role"

type BillingAuthContext = {
  organizationId?: string | null
  role?: string | null
  roles?: string[] | null
  user: { id: string; email?: string | null } | null
}

type RouteSet = {
  status?: number | string
}

type AdminInvoicesListRouteDeps = {
  authenticate: () => Promise<BillingAuthContext>
  getPlatformRole: (input: { id?: string | null; email?: string | null }) => Promise<PlatformAccessRole>
  isAdmin: (actor: { platformRole: PlatformAccessRole; tenantRole: string | null | undefined }) => boolean
}

const defaultDeps: AdminInvoicesListRouteDeps = {
  authenticate: () => withAuth(),
  getPlatformRole: getPlatformRoleForUser,
  isAdmin: (actor) => {
    if (actor.platformRole === "super_admin") return true
    return actor.tenantRole === "admin" || actor.tenantRole === "owner"
  },
}

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  status: z.enum(["DRAFT", "ISSUED", "PAID", "OVERDUE", "CANCELLED", "VOID", "UNCOLLECTIBLE"]).optional(),
  organizationId: z.string().optional(),
})

const toUnauthorized = (set: RouteSet) => {
  set.status = 401
  return {
    ok: false as const,
    error: "UNAUTHORIZED" as const,
    message: "You must be signed in to view invoices.",
  }
}

const toForbidden = (set: RouteSet, message: string) => {
  set.status = 403
  return {
    ok: false as const,
    error: "FORBIDDEN" as const,
    message,
  }
}

function formatInvoiceResponse(invoice: {
  id: string
  invoiceNumber: string
  status: string
  subtotalAmount: Decimal
  taxAmount: Decimal
  discountAmount: Decimal
  totalAmount: Decimal
  currency: string
  issuedAt: Date | null
  dueAt: Date | null
  paidAt: Date | null
  createdAt: Date
  billingAccount: { organizationId: string | null } | null
}) {
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    subtotalAmountIdr: invoice.subtotalAmount.toFixed(2),
    taxAmountIdr: invoice.taxAmount.toFixed(2),
    discountAmountIdr: invoice.discountAmount.toFixed(2),
    totalAmountIdr: invoice.totalAmount.toFixed(2),
    currency: invoice.currency,
    issuedAt: invoice.issuedAt?.toISOString() ?? null,
    dueAt: invoice.dueAt?.toISOString() ?? null,
    paidAt: invoice.paidAt?.toISOString() ?? null,
    createdAt: invoice.createdAt.toISOString(),
    organizationId: invoice.billingAccount?.organizationId ?? null,
  }
}

export const createAdminInvoicesListRoutes = (
  deps: Partial<AdminInvoicesListRouteDeps> = {}
) => {
  const { authenticate, getPlatformRole, isAdmin } = {
    ...defaultDeps,
    ...deps,
  }

  return new Elysia()
    .get("/admin/invoices", async ({ query, set }) => {
      const auth = await authenticate()

      if (!auth.user) {
        return toUnauthorized(set)
      }

      const platformRole = await getPlatformRole({
        id: auth.user?.id,
        email: auth.user?.email,
      })

      if (!isAdmin({ platformRole, tenantRole: auth.role })) {
        return toForbidden(set, "Only administrators can view all invoices.")
      }

      const parsed = querySchema.safeParse(query)
      if (!parsed.success) {
        set.status = 422
        return {
          ok: false as const,
          error: "VALIDATION_ERROR" as const,
          message: "Invalid query parameters.",
        }
      }

      const { page, limit, status, organizationId } = parsed.data
      const skip = (page - 1) * limit

      try {
        const where: Prisma.InvoiceWhereInput = {}
        if (status) where.status = status
        if (organizationId) {
          where.billingAccount = { organizationId }
        }

        const [invoices, total] = await Promise.all([
          prisma.invoice.findMany({
            where,
            include: {
              billingAccount: { select: { organizationId: true } },
            },
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
          }),
          prisma.invoice.count({ where }),
        ])

        return {
          ok: true as const,
          invoices: invoices.map(formatInvoiceResponse),
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        }
      } catch (error) {
        console.error("[AdminInvoicesList] Error:", error)
        set.status = 500
        return {
          ok: false as const,
          error: "INTERNAL_SERVER_ERROR" as const,
          message: "Unable to load invoices.",
        }
      }
    })
}

export const adminInvoicesListRoutes = createAdminInvoicesListRoutes()
