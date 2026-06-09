import { Elysia } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { z } from "zod"
import { Prisma } from "@prisma/client"
import Decimal = Prisma.Decimal

import { prisma } from "@/lib/prisma"
import { fieldErrorMapFromIssues } from "@/lib/validation"

type BillingAuthContext = {
  organizationId?: string | null
  role?: string | null
  roles?: string[] | null
  user: { id: string; email?: string | null } | null
}

type RouteSet = {
  status?: number | string
}

type BillingInvoicesRouteDeps = {
  authenticate: () => Promise<BillingAuthContext>
}

const defaultDeps: BillingInvoicesRouteDeps = {
  authenticate: () => withAuth(),
}

const invoiceParamsSchema = z.object({
  id: z.string().min(1),
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

type InvoiceLineResponse = {
  description: string
  quantity: string
  unitPriceIdr: string
  amountIdr: string
}

function formatInvoiceLine(
  line: {
    quantity: Decimal
    unitPrice: Decimal
    amount: Decimal
    description: string
  }
): InvoiceLineResponse {
  // Use field names from InvoiceLine schema: quantity, unitPrice, amount
  return {
    description: line.description,
    quantity: line.quantity.toFixed(2),
    unitPriceIdr: line.unitPrice.toFixed(2),
    amountIdr: line.amount.toFixed(2),
  }
}

export const createBillingInvoicesRoutes = (
  deps: Partial<BillingInvoicesRouteDeps> = {}
) => {
  const { authenticate } = { ...defaultDeps, ...deps }

  return new Elysia()
    // GET /billing/invoices — List all invoices for the tenant
    .get("/invoices", async ({ set }) => {
      const auth = await authenticate()

      if (!auth.user) {
        return toUnauthorized(set)
      }

      if (!auth.organizationId) {
        return toForbidden(set, "No active organization found for billing.")
      }

      try {
        // Get billing account for organization
        const account = await prisma.billingAccount.findUnique({
          where: { organizationId: auth.organizationId },
          select: { id: true },
        })

        if (!account) {
          return {
            ok: true as const,
            invoices: [],
          }
        }

        // Fetch invoices for this billing account
        const invoices = await prisma.invoice.findMany({
          where: { billingAccountId: account.id },
          include: {
            lines: true,
          },
          orderBy: { issuedAt: "desc" },
        })

        const formattedInvoices = invoices.map((inv) => ({
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          status: inv.status,
          type: inv.type,
          paymentMethod: inv.paymentMethod,
          issuedAt: inv.issuedAt?.toISOString() ?? null,
          dueAt: inv.dueAt?.toISOString() ?? null,
          createdAt: inv.createdAt?.toISOString() ?? null,
          dueDate: inv.dueDate?.toISOString() ?? null,
          totalAmountIdr: inv.totalAmount.toFixed(2),
          currency: inv.currency,
          lines: inv.lines.map((line) => formatInvoiceLine(line)),
        }))

        return {
          ok: true as const,
          invoices: formattedInvoices,
        }
      } catch (error) {
        console.error("[BillingInvoices] Error:", error)
        return toServerError(set, "Unable to load invoices right now.")
      }
    })
    // GET /billing/invoices/:id — Get invoice detail
    .get("/invoices/:id", async ({ params, set }) => {
      const auth = await authenticate()

      if (!auth.user) {
        return toUnauthorized(set)
      }

      if (!auth.organizationId) {
        return toForbidden(set, "No active organization found for billing.")
      }

      const parsed = invoiceParamsSchema.safeParse(params)
      if (!parsed.success) {
        set.status = 422
        return {
          ok: false as const,
          error: "VALIDATION_ERROR" as const,
          message: "Invalid invoice ID.",
          fieldErrors: fieldErrorMapFromIssues(parsed.error.issues),
        }
      }

      const { id } = parsed.data

      try {
        // Get billing account for organization
        const account = await prisma.billingAccount.findUnique({
          where: { organizationId: auth.organizationId },
          select: { id: true },
        })

        if (!account) {
          return toNotFound(set, "Billing account not found.")
        }

        // Fetch invoice
        const invoice = await prisma.invoice.findFirst({
          where: {
            id,
            billingAccountId: account.id,
          },
          include: {
            lines: true,
          },
        })

        if (!invoice) {
          return toNotFound(set, "Invoice not found.")
        }

        return {
          ok: true as const,
          invoice: {
            id: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            status: invoice.status,
            type: invoice.type,
            paymentMethod: invoice.paymentMethod,
            issuedAt: invoice.issuedAt?.toISOString() ?? null,
            dueAt: invoice.dueAt?.toISOString() ?? null,
            createdAt: invoice.createdAt?.toISOString() ?? null,
            dueDate: invoice.dueDate?.toISOString() ?? null,
            totalAmountIdr: invoice.totalAmount.toFixed(2),
            currency: invoice.currency,
            lines: invoice.lines.map((line) =>
              formatInvoiceLine(line)
            ),
          },
        }
      } catch (error) {
        console.error("[BillingInvoices] Error:", error)
        return toServerError(set, "Unable to load invoice detail right now.")
      }
    })
}

export const billingInvoicesRoutes = createBillingInvoicesRoutes()