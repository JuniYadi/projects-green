import { Elysia } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { z } from "zod"
import { Prisma } from "@prisma/client"
import Decimal = Prisma.Decimal

import { prisma } from "@/lib/prisma"
import { fieldErrorMapFromIssues } from "@/lib/validation"
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

type AdminInvoiceRouteDeps = {
  authenticate: () => Promise<BillingAuthContext>
  getPlatformRole: (input: { id?: string | null; email?: string | null }) => Promise<PlatformAccessRole>
  isAdmin: (actor: { platformRole: PlatformAccessRole; tenantRole: string | null | undefined }) => boolean
}

const defaultDeps: AdminInvoiceRouteDeps = {
  authenticate: () => withAuth(),
  getPlatformRole: getPlatformRoleForUser,
  isAdmin: (actor) => {
    if (actor.platformRole === "super_admin") return true
    return actor.tenantRole === "admin" || actor.tenantRole === "owner"
  },
}

const invoiceFinalizeSchema = z.object({
  invoiceId: z.string().min(1),
})

const invoiceVoidSchema = z.object({
  invoiceId: z.string().min(1),
})

const toUnauthorized = (set: RouteSet) => {
  set.status = 401
  return {
    ok: false as const,
    error: "UNAUTHORIZED" as const,
    message: "You must be signed in to manage invoices.",
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

const toNotFound = (set: RouteSet, message: string) => {
  set.status = 404
  return {
    ok: false as const,
    error: "NOT_FOUND" as const,
    message,
  }
}

const toServerError = (set: RouteSet, message: string) => {
  set.status = 500
  return {
    ok: false as const,
    error: "INTERNAL_SERVER_ERROR" as const,
    message,
  }
}

async function resolveActor(
  auth: BillingAuthContext,
  getPlatformRole: AdminInvoiceRouteDeps["getPlatformRole"]
) {
  const platformRole = await getPlatformRole({
    id: auth.user?.id,
    email: auth.user?.email,
  })

  return {
    platformRole,
    tenantRole: auth.role,
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
  }
}

export const createAdminInvoiceRoutes = (
  deps: Partial<AdminInvoiceRouteDeps> = {}
) => {
  const { authenticate, getPlatformRole, isAdmin } = {
    ...defaultDeps,
    ...deps,
  }

  return new Elysia()
    // POST /billing/admin/invoice-finalize — Finalize a DRAFT invoice
    .post("/admin/invoice-finalize", async ({ body, set }) => {
      const auth = await authenticate()

      if (!auth.user) {
        return toUnauthorized(set)
      }

      // Parse and validate body
      const parsed = invoiceFinalizeSchema.safeParse(body)
      if (!parsed.success) {
        set.status = 422
        return {
          ok: false as const,
          error: "VALIDATION_ERROR" as const,
          message: "Please fix the highlighted fields and try again.",
          fieldErrors: fieldErrorMapFromIssues(parsed.error.issues),
        }
      }

      const { invoiceId } = parsed.data

      // Check admin access
      const actor = await resolveActor(auth, getPlatformRole)
      if (!isAdmin(actor)) {
        return toForbidden(
          set,
          "Only administrators can finalize invoices."
        )
      }

      try {
        // Fetch invoice
        const invoice = await prisma.invoice.findUnique({
          where: { id: invoiceId },
        })

        if (!invoice) {
          return toNotFound(set, "Invoice not found.")
        }

        // Validate invoice is in DRAFT status
        if (invoice.status !== "DRAFT") {
          set.status = 422
          return {
            ok: false as const,
            error: "INVALID_STATUS" as const,
            message: "Only DRAFT invoices can be finalized.",
          }
        }

        // Calculate due date (30 days from now)
        const now = new Date()
        const dueDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

        // Update invoice to OPEN status
        const updatedInvoice = await prisma.invoice.update({
          where: { id: invoiceId },
          data: {
            status: "OPEN",
            issuedAt: now,
            dueAt: dueDate,
          },
        })

        return {
          ok: true as const,
          invoice: formatInvoiceResponse(updatedInvoice),
        }
      } catch (error) {
        console.error("[AdminInvoiceFinalize] Error:", error)
        return toServerError(set, "Unable to finalize invoice.")
      }
    })
    // POST /billing/admin/invoice-void — Void an invoice
    .post("/admin/invoice-void", async ({ body, set }) => {
      const auth = await authenticate()

      if (!auth.user) {
        return toUnauthorized(set)
      }

      // Parse and validate body
      const parsed = invoiceVoidSchema.safeParse(body)
      if (!parsed.success) {
        set.status = 422
        return {
          ok: false as const,
          error: "VALIDATION_ERROR" as const,
          message: "Please fix the highlighted fields and try again.",
          fieldErrors: fieldErrorMapFromIssues(parsed.error.issues),
        }
      }

      const { invoiceId } = parsed.data

      // Check admin access
      const actor = await resolveActor(auth, getPlatformRole)
      if (!isAdmin(actor)) {
        return toForbidden(
          set,
          "Only administrators can void invoices."
        )
      }

      try {
        // Fetch invoice
        const invoice = await prisma.invoice.findUnique({
          where: { id: invoiceId },
        })

        if (!invoice) {
          return toNotFound(set, "Invoice not found.")
        }

        // Validate invoice status
        if (invoice.status !== "OPEN" && invoice.status !== "PAID") {
          set.status = 422
          return {
            ok: false as const,
            error: "INVALID_STATUS" as const,
            message: "Only OPEN or PAID invoices can be voided.",
          }
        }

        // Validate within 7 days of creation
        const now = new Date()
        const daysSinceCreation = (now.getTime() - invoice.createdAt.getTime()) / (1000 * 60 * 60 * 24)
        if (daysSinceCreation > 7) {
          set.status = 422
          return {
            ok: false as const,
            error: "VOID_WINDOW_EXPIRED" as const,
            message: "Invoices can only be voided within 7 days of creation.",
          }
        }

        // Update invoice to VOID status
        const updatedInvoice = await prisma.invoice.update({
          where: { id: invoiceId },
          data: {
            status: "VOID",
          },
        })

        return {
          ok: true as const,
          invoice: formatInvoiceResponse(updatedInvoice),
        }
      } catch (error) {
        console.error("[AdminInvoiceVoid] Error:", error)
        return toServerError(set, "Unable to void invoice.")
      }
    })
}

export const adminInvoiceRoutes = createAdminInvoiceRoutes()
