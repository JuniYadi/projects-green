import { Elysia } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { z } from "zod"
import { Prisma } from "@prisma/client"
import type { BillingInvoiceStatus } from "@prisma/client"
import Decimal = Prisma.Decimal

import { prisma } from "@/lib/prisma"
import { fieldErrorMapFromIssues } from "@/lib/validation"
import { getPlatformRoleForUser } from "@/lib/platform-role"
import type { PlatformAccessRole } from "@/lib/platform-role"
import {
  invoiceEmailService,
  type InvoiceEmailService,
} from "@/modules/invoices/email.service"
import type {
  InvoiceListItem,
  InvoiceStatus,
} from "@/modules/invoices/invoices.types"
import {
  resolveInvoiceEmailRecipients,
  type BillingEmailRecipient,
} from "@/modules/billing/email-recipients"

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
  getPlatformRole: (input: {
    id?: string | null
    email?: string | null
  }) => Promise<PlatformAccessRole>
  isAdmin: (actor: {
    platformRole: PlatformAccessRole
    tenantRole: string | null | undefined
  }) => boolean
  emailService: InvoiceEmailService
  getOrganizationIdByBillingAccount: (
    billingAccountId: string
  ) => Promise<string | null>
  resolveInvoiceRecipients?: (
    organizationId: string
  ) => Promise<BillingEmailRecipient[]>
}

const defaultDeps: AdminInvoiceRouteDeps = {
  authenticate: () => withAuth(),
  getPlatformRole: getPlatformRoleForUser,
  emailService: invoiceEmailService,
  getOrganizationIdByBillingAccount: async (billingAccountId) => {
    const billingAccount = await prisma.billingAccount.findUnique({
      where: { id: billingAccountId },
      select: { organizationId: true },
    })
    return billingAccount?.organizationId ?? null
  },
  resolveInvoiceRecipients: resolveInvoiceEmailRecipients,
  isAdmin: (actor) => {
    if (actor.platformRole === "super_admin") return true
    return actor.tenantRole === "admin" || actor.tenantRole === "owner"
  },
}

const invoiceParamsSchema = z.object({
  id: z.string().min(1),
})

const patchInvoiceSchema = z.object({
  status: z.enum(["ISSUED", "CANCELLED"]),
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

const toEmailStatus = (status: BillingInvoiceStatus): InvoiceStatus => {
  if (status === "PAID") return "paid"
  if (status === "CANCELLED" || status === "VOID") return "canceled"
  if (status === "UNCOLLECTIBLE") return "uncollectible"
  return status === "DRAFT" ? "draft" : "open"
}

const toInvoiceEmailItem = (invoice: {
  id: string
  invoiceNumber: string
  status: BillingInvoiceStatus
  totalAmount: Decimal
  currency: string
  issuedAt: Date | null
  dueAt: Date | null
  createdAt: Date
}): InvoiceListItem => ({
  id: invoice.id,
  invoiceNumber: invoice.invoiceNumber,
  status: toEmailStatus(invoice.status),
  totalAmount: invoice.totalAmount.toNumber(),
  currency: invoice.currency,
  issuedAt: invoice.issuedAt?.toISOString() ?? invoice.createdAt.toISOString(),
  dueAt: invoice.dueAt?.toISOString() ?? null,
})

async function notifyInvoiceRecipients(input: {
  deps: AdminInvoiceRouteDeps
  invoice: { billingAccountId?: string | null }
  send: (recipient: BillingEmailRecipient) => Promise<void>
}) {
  if (!input.invoice.billingAccountId) return

  const organizationId = await input.deps.getOrganizationIdByBillingAccount(
    input.invoice.billingAccountId
  )

  if (!organizationId) return

  const recipients = await (
    input.deps.resolveInvoiceRecipients ?? (async () => [])
  )(organizationId)

  await Promise.allSettled(recipients.map(input.send))
}

export const createAdminInvoiceRoutes = (
  deps: Partial<AdminInvoiceRouteDeps> = {}
) => {
  const routeDeps = {
    ...defaultDeps,
    ...deps,
  }
  const { authenticate, getPlatformRole, isAdmin, emailService } = routeDeps

  return (
    new Elysia()
      // PATCH /admin/invoices/:id — Update invoice status (issue, cancel)
      .patch("/admin/invoices/:id", async ({ params, body, set }) => {
        const auth = await authenticate()

        if (!auth.user) {
          return toUnauthorized(set)
        }

        // Validate params
        const paramsParsed = invoiceParamsSchema.safeParse(params)
        if (!paramsParsed.success) {
          set.status = 422
          return {
            ok: false as const,
            error: "VALIDATION_ERROR" as const,
            message: "Invalid invoice ID.",
          }
        }

        // Validate body
        const bodyParsed = patchInvoiceSchema.safeParse(body)
        if (!bodyParsed.success) {
          set.status = 422
          return {
            ok: false as const,
            error: "VALIDATION_ERROR" as const,
            message: "Please fix the highlighted fields and try again.",
            fieldErrors: fieldErrorMapFromIssues(bodyParsed.error.issues),
          }
        }

        const { id } = paramsParsed.data
        const { status: targetStatus } = bodyParsed.data

        // Check admin access
        const actor = await resolveActor(auth, getPlatformRole)
        if (!isAdmin(actor)) {
          return toForbidden(
            set,
            "Only administrators can update invoice status."
          )
        }

        try {
          const invoice = await prisma.billingInvoice.findUnique({
            where: { id },
          })

          if (!invoice) {
            return toNotFound(set, "Invoice not found.")
          }

          // Validate status transitions
          const validTransitions: Record<string, string[]> = {
            DRAFT: ["ISSUED", "CANCELLED"],
            ISSUED: ["CANCELLED"],
          }

          const allowed = validTransitions[invoice.status] ?? []
          if (!allowed.includes(targetStatus)) {
            set.status = 422
            return {
              ok: false as const,
              error: "INVALID_STATUS" as const,
              message: `Cannot transition from ${invoice.status} to ${targetStatus}.`,
            }
          }

          const updateData: Prisma.BillingInvoiceUpdateInput = {
            status: targetStatus as BillingInvoiceStatus,
          }

          if (targetStatus === "ISSUED") {
            updateData.issuedAt = new Date()
          }

          const updatedInvoice = await prisma.billingInvoice.update({
            where: { id },
            data: updateData,
          })

          const invoiceEmailItem = toInvoiceEmailItem(updatedInvoice)
          notifyInvoiceRecipients({
            deps: routeDeps,
            invoice: updatedInvoice,
            send: (recipient) =>
              targetStatus === "ISSUED"
                ? emailService.sendInvoiceCreated(
                    invoiceEmailItem,
                    recipient.email
                  )
                : emailService.sendInvoiceCancelled(
                    invoiceEmailItem,
                    recipient.email
                  ),
          }).catch((err) => {
            console.error(
              "[AdminInvoiceUpdate] Failed to send invoice status email:",
              err
            )
          })

          return {
            ok: true as const,
            invoice: formatInvoiceResponse(updatedInvoice),
          }
        } catch (error) {
          console.error("[AdminInvoiceUpdate] Error:", error)
          return toServerError(set, "Unable to update invoice.")
        }
      })
  )
}

export const adminInvoiceRoutes = createAdminInvoiceRoutes()
