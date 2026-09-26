import { Elysia } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { z } from "zod"
import { Prisma } from "@prisma/client"
import type { BillingInvoiceStatus } from "@prisma/client"
import Decimal = Prisma.Decimal
import {
  getPlatformRoleForUser,
  type PlatformAccessRole,
} from "@/lib/platform-role"
import { resolveAdminActor } from "@/modules/admin/api/admin.guards"
import {
  invoiceEmailService,
  type InvoiceEmailService,
} from "@/modules/invoices/email.service"
import { fieldErrorMapFromIssues } from "@/lib/validation"
import { prisma } from "@/lib/prisma"
import type {
  InvoiceListItem,
  InvoiceStatus,
} from "@/modules/invoices/invoices.types"
import {
  resolveInvoiceEmailRecipients,
  resolveInvoiceBilledTo,
  type BillingEmailRecipient,
  type InvoiceBilledTo,
} from "@/modules/billing/email-recipients"
import { PaymentService } from "@/modules/payment/services/payment.service"

import { emitBillingAudit } from "@/modules/billing/audit/audit.service"

type TopupPaidEmailInvoice = Parameters<
  PaymentService["sendInvoicePaidEmail"]
>[0]

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
  resolveInvoiceBilledTo?: (organizationId: string) => Promise<InvoiceBilledTo>
  sendTopupInvoicePaidEmail?: (
    invoice: TopupPaidEmailInvoice,
    organizationId: string
  ) => Promise<void>
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
  resolveInvoiceBilledTo,
  sendTopupInvoicePaidEmail: async (invoice, organizationId) => {
    await new PaymentService().sendInvoicePaidEmail(invoice, organizationId)
  },
  isAdmin: (actor) => resolveAdminActor(actor.platformRole, actor.tenantRole),
}

const invoiceParamsSchema = z.object({
  id: z.string().min(1),
})
const patchInvoiceSchema = z.object({
  status: z.enum(["ISSUED", "CANCELLED", "PAID"]),
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
  send: (
    recipient: BillingEmailRecipient,
    context: { organizationId: string; billedTo: InvoiceBilledTo }
  ) => Promise<void>
}) {
  if (!input.invoice.billingAccountId) return

  try {
    const organizationId = await input.deps.getOrganizationIdByBillingAccount(
      input.invoice.billingAccountId
    )

    if (!organizationId) return

    const recipients = await (
      input.deps.resolveInvoiceRecipients ?? (async () => [])
    )(organizationId)

    const billedTo = await (
      input.deps.resolveInvoiceBilledTo ?? (async () => ({}))
    )(organizationId)

    await Promise.allSettled(
      recipients.map((recipient) =>
        input.send(recipient, { organizationId, billedTo })
      )
    )
  } catch (err) {
    console.error(
      "[AdminInvoiceRoute] Failed to resolve invoice recipients:",
      err
    )
    // Don't rethrow — callers handle gracefully via their own .catch
  }
}

async function notifyTopupInvoicePaid(input: {
  deps: AdminInvoiceRouteDeps
  invoice: TopupPaidEmailInvoice & { billingAccountId?: string | null }
}) {
  if (
    !input.invoice.billingAccountId ||
    !input.deps.sendTopupInvoicePaidEmail
  ) {
    return
  }

  const organizationId = await input.deps.getOrganizationIdByBillingAccount(
    input.invoice.billingAccountId
  )
  if (!organizationId) return

  await input.deps.sendTopupInvoicePaidEmail(input.invoice, organizationId)
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
            include: { billingAccount: { select: { organizationId: true } } },
          })

          if (!invoice) {
            return toNotFound(set, "Invoice not found.")
          }

          if (
            actor.platformRole !== "super_admin" &&
            invoice.billingAccount &&
            invoice.billingAccount.organizationId !== auth.organizationId
          ) {
            return toForbidden(
              set,
              "Cannot update invoices belonging to another organization."
            )
          }

          // Validate status transitions
          const validTransitions: Record<string, string[]> = {
            DRAFT: ["ISSUED", "CANCELLED"],
            ISSUED: ["CANCELLED"],
            OPEN: ["PAID", "CANCELLED"],
            OVERDUE: ["PAID", "CANCELLED"],
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

          if (targetStatus === "PAID") {
            updateData.paidAt = new Date()
          }

          const updatedInvoice = await prisma.billingInvoice.update({
            where: { id },
            data: updateData,
          })

          // Update billing account balance for PAID invoices
          if (targetStatus === "PAID" && invoice.billingAccountId) {
            try {
              await prisma.billingAccount.update({
                where: { id: invoice.billingAccountId },
                data: { balance: { increment: invoice.totalAmount } },
              })
            } catch (balErr) {
              console.error(
                "[AdminInvoiceUpdate] Failed to update balance:",
                balErr
              )
            }
          }

          // Audit logging
          if (targetStatus === "PAID") {
            emitBillingAudit({
              billingAccountId: invoice.billingAccountId ?? undefined,
              entityType: "Invoice",
              entityId: invoice.id,
              action: "PAYMENT_CONFIRMED",
              actorId: auth.user?.id,
              context: {
                invoiceNumber: invoice.invoiceNumber,
                fromStatus: invoice.status,
                toStatus: targetStatus,
                totalAmount: invoice.totalAmount.toFixed(2),
                currency: invoice.currency,
              },
            })
          } else {
            emitBillingAudit({
              billingAccountId: invoice.billingAccountId ?? undefined,
              entityType: "Invoice",
              entityId: invoice.id,
              action: "UPDATED",
              actorId: auth.user?.id,
              context: {
                invoiceNumber: invoice.invoiceNumber,
                fromStatus: invoice.status,
                toStatus: targetStatus,
              },
            })
          }

          const isTopUpInvoice =
            updatedInvoice.type === "TOP_UP" || updatedInvoice.type === "TOPUP"

          if (targetStatus === "PAID" && isTopUpInvoice) {
            notifyTopupInvoicePaid({
              deps: routeDeps,
              invoice: updatedInvoice,
            }).catch((err) => {
              console.error(
                "[AdminInvoiceUpdate] Failed to send top-up paid email:",
                err
              )
            })
          } else {
            const invoiceEmailItem = toInvoiceEmailItem(updatedInvoice)
            notifyInvoiceRecipients({
              deps: routeDeps,
              invoice: updatedInvoice,
              send: (recipient, { organizationId, billedTo }) =>
                targetStatus === "ISSUED"
                  ? emailService.sendInvoiceCreated(
                      invoiceEmailItem,
                      recipient.email,
                      organizationId,
                      billedTo
                    )
                  : targetStatus === "PAID"
                    ? emailService.sendInvoicePaid(
                        invoiceEmailItem,
                        recipient.email,
                        organizationId,
                        billedTo
                      )
                    : emailService.sendInvoiceCancelled(
                        invoiceEmailItem,
                        recipient.email,
                        undefined,
                        organizationId,
                        billedTo
                      ),
            }).catch((err) => {
              console.error(
                "[AdminInvoiceUpdate] Failed to send invoice status email:",
                err
              )
            })
          }

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
