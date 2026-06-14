import { Elysia } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { z } from "zod"

import { fieldErrorMapFromIssues } from "@/lib/validation"
import type { PlatformAccessRole } from "@/lib/platform-role"
import { buildInvoicePdfBytes } from "@/modules/invoices/invoice-pdf"
import {
  canManageInvoiceCancellation,
  canManageInvoiceNotifications,
  canManagePaymentConfirmations,
  canManuallyMarkPaid,
} from "@/modules/invoices/invoices.policy"
import {
  createInvoiceService,
  InvoiceCancelNotAllowedError,
  InvoiceNotFoundError,
  type InvoiceService,
} from "@/modules/invoices/invoices.service"
import type {
  InvoiceListSortBy,
  InvoiceSortDirection,
  InvoiceStatus,
} from "@/modules/invoices/invoices.types"
import {
  resolveTenantRoleFromClaims,
  type TenantRole,
} from "@/modules/tenants/tenant-policy"
import {
  createInvoiceEmailService,
  type InvoiceEmailService,
} from "@/modules/invoices/email.service"
import { getTenantOrganizationById } from "@/modules/tenants/services/tenant-workos.service"
// prisma imported dynamically in routes below

const listQuerySchema = z.object({
  search: z.string().trim().min(1).optional(),
  status: z
    .enum(["draft", "open", "paid", "canceled", "uncollectible"])
    .optional(),
  sortBy: z
    .enum(["invoiceNumber", "issuedAt", "dueAt", "totalAmount", "status"])
    .optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
})

const paramsSchema = z.object({
  invoiceId: z.string().trim().min(1),
})

const notifyRecipientSchema = z.object({
  recipientEmail: z.string().email().optional(),
})

const notifyCancelledSchema = z.object({
  recipientEmail: z.string().email().optional(),
  reason: z.string().trim().optional(),
})

const markPaidBodySchema = z.object({
  paymentMethod: z.enum(["MANUAL_BANK", "CASH", "CHEQUE", "OTHER"]).optional(),
  referenceNumber: z.string().trim().optional(),
  notes: z.string().trim().optional(),
})

type InvoicesAuthContext = {
  organizationId?: string | null
  role?: string | null
  roles?: string[] | null
  user: {
    id: string
    email?: string | null
  } | null
}

type RouteSet = {
  status?: number | string
}

type InvoiceRouteDependencies = {
  authenticate: () => Promise<InvoicesAuthContext>
  getPlatformRole: (input: {
    id?: string | null
    email?: string | null
  }) => Promise<PlatformAccessRole>
  service: InvoiceService
  emailService: InvoiceEmailService
  getOrganizationIdByBillingAccount: (billingAccountId: string) => Promise<string | null>
}

const createDefaultDependencies = (): InvoiceRouteDependencies => ({
  authenticate: () => withAuth(),
  getPlatformRole: async (input) => {
    const platformRoleModule = await import("@/lib/platform-role")
    return platformRoleModule.getPlatformRoleForUser(input)
  },
  service: createInvoiceService(),
  emailService: createInvoiceEmailService(),
  getOrganizationIdByBillingAccount: async (billingAccountId) => {
    const { prisma } = await import("@/lib/prisma")
    const billingAccount = await prisma.billingAccount.findUnique({
      where: { id: billingAccountId },
      select: { organizationId: true },
    })
    return billingAccount?.organizationId ?? null
  },
})

const toUnauthorized = (set: RouteSet) => {
  set.status = 401
  return {
    ok: false as const,
    error: "UNAUTHORIZED" as const,
    message: "You must be signed in to access invoices.",
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

const toValidationError = (
  set: RouteSet,
  issues: Array<{ path: Array<PropertyKey>; message: string }>
) => {
  set.status = 422
  return {
    ok: false as const,
    error: "VALIDATION_ERROR" as const,
    message: "Please fix the highlighted fields and try again.",
    fieldErrors: fieldErrorMapFromIssues(issues),
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

const toCancelNotAllowed = (set: RouteSet, message: string) => {
  set.status = 409
  return {
    ok: false as const,
    error: "INVOICE_CANCEL_NOT_ALLOWED" as const,
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

const toActorRoles = async ({
  auth,
  getPlatformRole,
}: {
  auth: InvoicesAuthContext
  getPlatformRole: InvoiceRouteDependencies["getPlatformRole"]
}): Promise<{
  tenantRole: TenantRole | null
  platformRole: PlatformAccessRole
}> => {
  const tenantRole = resolveTenantRoleFromClaims(auth.role, auth.roles ?? null)
  const platformRole = await getPlatformRole({
    id: auth.user?.id,
    email: auth.user?.email,
  })

  return {
    tenantRole,
    platformRole,
  }
}

const isCancelableStatus = (status: InvoiceStatus) => {
  return status !== "paid" && status !== "canceled"
}

export const createInvoicesRoutes = (
  dependencies: InvoiceRouteDependencies = createDefaultDependencies()
) => {
  return new Elysia({ prefix: "/invoices" })
    .get("/", async ({ query, set }) => {
      const auth = await dependencies.authenticate()

      if (!auth.user) {
        return toUnauthorized(set)
      }

      try {
        const actorRoles = await toActorRoles({
          auth,
          getPlatformRole: dependencies.getPlatformRole,
        })

        const isSuperAdmin = actorRoles.platformRole === "super_admin"
        if (!isSuperAdmin && !auth.organizationId) {
          return toForbidden(set, "No active organization found for invoices.")
        }

        const parsedQuery = listQuerySchema.safeParse(query)

        if (!parsedQuery.success) {
          return toValidationError(set, parsedQuery.error.issues)
        }

        const invoices = await dependencies.service.listInvoices({
          organizationId: isSuperAdmin ? null : auth.organizationId,
          query: {
            search: parsedQuery.data.search,
            status: parsedQuery.data.status,
            sortBy: parsedQuery.data.sortBy as InvoiceListSortBy | undefined,
            sortDir: parsedQuery.data.sortDir as InvoiceSortDirection | undefined,
          },
        })

        return {
          ok: true as const,
          invoices,
        }
      } catch {
        return toServerError(set, "Unable to load invoices right now.")
      }
    })
    .get("/:invoiceId", async ({ params, set }) => {
      const auth = await dependencies.authenticate()

      if (!auth.user) {
        return toUnauthorized(set)
      }

      const parsedParams = paramsSchema.safeParse(params)

      if (!parsedParams.success) {
        return toValidationError(set, parsedParams.error.issues)
      }

      try {
        const actorRoles = await toActorRoles({
          auth,
          getPlatformRole: dependencies.getPlatformRole,
        })

        const isSuperAdmin = actorRoles.platformRole === "super_admin"
        if (!isSuperAdmin && !auth.organizationId) {
          return toForbidden(set, "No active organization found for invoices.")
        }

        const invoice = await dependencies.service.getInvoiceDetail({
          organizationId: isSuperAdmin ? null : auth.organizationId,
          invoiceId: parsedParams.data.invoiceId,
        })

        const payment = await dependencies.service.getPaymentInfo({
          organizationId: isSuperAdmin ? null : auth.organizationId,
          invoiceId: parsedParams.data.invoiceId,
        })

        const billingAccountId = invoice.billingAccountId
        const orgId = billingAccountId
          ? await dependencies.getOrganizationIdByBillingAccount(billingAccountId)
          : null

        const org = orgId
          ? await getTenantOrganizationById(orgId)
          : null

        return {
          ok: true as const,
          invoice,
          payment,
          canMarkCanceled:
            canManageInvoiceCancellation(actorRoles) &&
            isCancelableStatus(invoice.status),
          canMarkPaid:
            canManuallyMarkPaid(actorRoles) && invoice.status === "open",
          canManageConfirmations: canManagePaymentConfirmations(actorRoles),
          organization: org ? {
            name: org.name,
            billingFullName: org.metadata?.billing_full_name ?? null,
            billingAddress: org.metadata?.billing_address ?? null,
            billingCity: org.metadata?.billing_city ?? null,
            billingState: org.metadata?.billing_state ?? null,
            billingCountry: org.metadata?.billing_country ?? null,
            billingPostCode: org.metadata?.billing_post_code ?? null,
          } : null,
        }
      } catch (error) {
        if (error instanceof InvoiceNotFoundError) {
          return toNotFound(set, error.message)
        }

        console.error(
          `[invoices] GET /invoices/:invoiceId —`,
          error instanceof Error ? error.stack ?? error.message : error
        )
        return toServerError(set, "Unable to load invoice detail right now.")
      }
    })
    .get("/:invoiceId/pdf", async ({ params, set }) => {
      const auth = await dependencies.authenticate()

      if (!auth.user) {
        return toUnauthorized(set)
      }

      const parsedParams = paramsSchema.safeParse(params)

      if (!parsedParams.success) {
        return toValidationError(set, parsedParams.error.issues)
      }

      try {
        const actorRoles = await toActorRoles({
          auth,
          getPlatformRole: dependencies.getPlatformRole,
        })

        const isSuperAdmin = actorRoles.platformRole === "super_admin"
        if (!isSuperAdmin && !auth.organizationId) {
          return toForbidden(set, "No active organization found for invoices.")
        }

        const invoice = await dependencies.service.getInvoiceDetail({
          organizationId: isSuperAdmin ? null : auth.organizationId,
          invoiceId: parsedParams.data.invoiceId,
        })

        const billingAccountId = invoice.billingAccountId
        const orgId = billingAccountId
          ? await dependencies.getOrganizationIdByBillingAccount(billingAccountId)
          : null

        const org = orgId
          ? await getTenantOrganizationById(orgId)
          : null

        const bytes = buildInvoicePdfBytes(invoice, org ? {
          name: org.name,
          billingFullName: org.metadata?.billing_full_name ?? null,
          billingAddress: org.metadata?.billing_address ?? null,
          billingCity: org.metadata?.billing_city ?? null,
          billingState: org.metadata?.billing_state ?? null,
          billingCountry: org.metadata?.billing_country ?? null,
          billingPostCode: org.metadata?.billing_post_code ?? null,
        } : null)
        const body = new Blob([new Uint8Array(bytes).buffer], {
          type: "application/pdf",
        })

        return new Response(body, {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Cache-Control": "no-store",
            "Content-Disposition": `attachment; filename=\"${invoice.invoiceNumber}.pdf\"`,
          },
        })
      } catch (error) {
        if (error instanceof InvoiceNotFoundError) {
          return toNotFound(set, error.message)
        }

        console.error(
          `[invoices] GET /invoices/:invoiceId/pdf —`,
          error instanceof Error ? error.stack ?? error.message : error
        )
        return toServerError(set, "Unable to download invoice PDF right now.")
      }
    })
    .post("/:invoiceId/cancel", async ({ params, set }) => {
      const auth = await dependencies.authenticate()

      if (!auth.user) {
        return toUnauthorized(set)
      }

      const parsedParams = paramsSchema.safeParse(params)

      if (!parsedParams.success) {
        return toValidationError(set, parsedParams.error.issues)
      }

      try {
        const actorRoles = await toActorRoles({
          auth,
          getPlatformRole: dependencies.getPlatformRole,
        })

        const isSuperAdmin = actorRoles.platformRole === "super_admin"
        if (!isSuperAdmin && !auth.organizationId) {
          return toForbidden(set, "No active organization found for invoices.")
        }

        if (!canManageInvoiceCancellation(actorRoles)) {
          return toForbidden(
            set,
            "Only portal administrators can mark invoices as canceled."
          )
        }

        const invoice = await dependencies.service.cancelInvoice({
          organizationId: isSuperAdmin ? null : auth.organizationId,
          invoiceId: parsedParams.data.invoiceId,
        })

        // Send cancellation notification email
        if (auth.user?.email) {
          dependencies.emailService.sendInvoiceCancelled(invoice, auth.user.email).catch((err) => {
            console.error("[Invoices] Failed to send invoice cancelled email:", err)
          })
        }

        return {
          ok: true as const,
          invoice,
        }
      } catch (error) {
        if (error instanceof InvoiceNotFoundError) {
          return toNotFound(set, error.message)
        }

        if (error instanceof InvoiceCancelNotAllowedError) {
          return toCancelNotAllowed(set, error.message)
        }

        console.error(
          `[invoices] POST /invoices/:invoiceId/cancel —`,
          error instanceof Error ? error.stack ?? error.message : error
        )
        return toServerError(set, "Unable to cancel invoice right now.")
      }
    })
    .post("/:invoiceId/notify/created", async ({ params, body, set }) => {
      const auth = await dependencies.authenticate()

      if (!auth.user) {
        return toUnauthorized(set)
      }

      if (!auth.organizationId) {
        return toForbidden(set, "No active organization found for invoices.")
      }

      const parsedParams = paramsSchema.safeParse(params)
      if (!parsedParams.success) {
        return toValidationError(set, parsedParams.error.issues)
      }

      const parsedBody = notifyRecipientSchema.safeParse(body ?? {})
      if (!parsedBody.success) {
        return toValidationError(set, parsedBody.error.issues)
      }
      const recipientEmail = parsedBody.data.recipientEmail ?? auth.user.email ?? undefined

      if (!recipientEmail) {
        return toValidationError(set, [{
          path: ["recipientEmail"],
          message: "Recipient email is required when user has no email",
        }])
      }

      try {
        const actorRoles = await toActorRoles({
          auth,
          getPlatformRole: dependencies.getPlatformRole,
        })

        if (!canManageInvoiceNotifications(actorRoles)) {
          return toForbidden(set, "Only owner/admin members can send notifications.")
        }

        const invoice = await dependencies.service.getInvoiceDetail({
          organizationId: auth.organizationId,
          invoiceId: parsedParams.data.invoiceId,
        })

        dependencies.emailService.sendInvoiceCreated(invoice, recipientEmail).catch((err) => {
          console.error("[Invoices] Failed to send invoice created email:", err)
        })

        return {
          ok: true as const,
          message: `Invoice ${invoice.invoiceNumber} created notification sent`,
        }
      } catch (error) {
        if (error instanceof InvoiceNotFoundError) {
          return toNotFound(set, error.message)
        }

        console.error(
          `[invoices] POST /invoices/:invoiceId/notify/created —`,
          error instanceof Error ? error.stack ?? error.message : error
        )
        return toServerError(set, "Unable to send notification right now.")
      }
    })
    .post("/:invoiceId/notify/paid", async ({ params, body, set }) => {
      const auth = await dependencies.authenticate()

      if (!auth.user) {
        return toUnauthorized(set)
      }

      if (!auth.organizationId) {
        return toForbidden(set, "No active organization found for invoices.")
      }

      const parsedParams = paramsSchema.safeParse(params)
      if (!parsedParams.success) {
        return toValidationError(set, parsedParams.error.issues)
      }

      const parsedBody = notifyRecipientSchema.safeParse(body ?? {})
      if (!parsedBody.success) {
        return toValidationError(set, parsedBody.error.issues)
      }
      const recipientEmail = parsedBody.data.recipientEmail ?? auth.user.email ?? undefined

      if (!recipientEmail) {
        return toValidationError(set, [{
          path: ["recipientEmail"],
          message: "Recipient email is required when user has no email",
        }])
      }

      try {
        const actorRoles = await toActorRoles({
          auth,
          getPlatformRole: dependencies.getPlatformRole,
        })

        if (!canManageInvoiceNotifications(actorRoles)) {
          return toForbidden(set, "Only owner/admin members can send notifications.")
        }

        const invoice = await dependencies.service.getInvoiceDetail({
          organizationId: auth.organizationId,
          invoiceId: parsedParams.data.invoiceId,
        })

        dependencies.emailService.sendInvoicePaid(invoice, recipientEmail).catch((err) => {
          console.error("[Invoices] Failed to send invoice paid email:", err)
        })

        return {
          ok: true as const,
          message: `Invoice ${invoice.invoiceNumber} paid notification sent`,
        }
      } catch (error) {
        if (error instanceof InvoiceNotFoundError) {
          return toNotFound(set, error.message)
        }

        console.error(
          `[invoices] POST /invoices/:invoiceId/notify/paid —`,
          error instanceof Error ? error.stack ?? error.message : error
        )
        return toServerError(set, "Unable to send notification right now.")
      }
    })
    .post("/:invoiceId/notify/reminder", async ({ params, body, set }) => {
      const auth = await dependencies.authenticate()

      if (!auth.user) {
        return toUnauthorized(set)
      }

      if (!auth.organizationId) {
        return toForbidden(set, "No active organization found for invoices.")
      }

      const parsedParams = paramsSchema.safeParse(params)
      if (!parsedParams.success) {
        return toValidationError(set, parsedParams.error.issues)
      }

      const parsedBody = notifyRecipientSchema.safeParse(body ?? {})
      if (!parsedBody.success) {
        return toValidationError(set, parsedBody.error.issues)
      }
      const recipientEmail = parsedBody.data.recipientEmail ?? auth.user.email ?? undefined

      if (!recipientEmail) {
        return toValidationError(set, [{
          path: ["recipientEmail"],
          message: "Recipient email is required when user has no email",
        }])
      }

      try {
        const actorRoles = await toActorRoles({
          auth,
          getPlatformRole: dependencies.getPlatformRole,
        })

        if (!canManageInvoiceNotifications(actorRoles)) {
          return toForbidden(set, "Only owner/admin members can send notifications.")
        }

        const invoice = await dependencies.service.getInvoiceDetail({
          organizationId: auth.organizationId,
          invoiceId: parsedParams.data.invoiceId,
        })

        dependencies.emailService.sendPaymentReminder(invoice, recipientEmail).catch((err) => {
          console.error("[Invoices] Failed to send payment reminder email:", err)
        })

        return {
          ok: true as const,
          message: `Invoice ${invoice.invoiceNumber} payment reminder sent`,
        }
      } catch (error) {
        if (error instanceof InvoiceNotFoundError) {
          return toNotFound(set, error.message)
        }

        console.error(
          `[invoices] POST /invoices/:invoiceId/notify/reminder —`,
          error instanceof Error ? error.stack ?? error.message : error
        )
        return toServerError(set, "Unable to send notification right now.")
      }
    })
    .post("/:invoiceId/notify/overdue", async ({ params, body, set }) => {
      const auth = await dependencies.authenticate()

      if (!auth.user) {
        return toUnauthorized(set)
      }

      if (!auth.organizationId) {
        return toForbidden(set, "No active organization found for invoices.")
      }

      const parsedParams = paramsSchema.safeParse(params)
      if (!parsedParams.success) {
        return toValidationError(set, parsedParams.error.issues)
      }

      const parsedBody = notifyRecipientSchema.safeParse(body ?? {})
      if (!parsedBody.success) {
        return toValidationError(set, parsedBody.error.issues)
      }
      const recipientEmail = parsedBody.data.recipientEmail ?? auth.user.email ?? undefined

      if (!recipientEmail) {
        return toValidationError(set, [{
          path: ["recipientEmail"],
          message: "Recipient email is required when user has no email",
        }])
      }

      try {
        const actorRoles = await toActorRoles({
          auth,
          getPlatformRole: dependencies.getPlatformRole,
        })

        if (!canManageInvoiceNotifications(actorRoles)) {
          return toForbidden(set, "Only owner/admin members can send notifications.")
        }

        const invoice = await dependencies.service.getInvoiceDetail({
          organizationId: auth.organizationId,
          invoiceId: parsedParams.data.invoiceId,
        })

        dependencies.emailService.sendInvoiceOverdue(invoice, recipientEmail).catch((err) => {
          console.error("[Invoices] Failed to send invoice overdue email:", err)
        })

        return {
          ok: true as const,
          message: `Invoice ${invoice.invoiceNumber} overdue notification sent`,
        }
      } catch (error) {
        if (error instanceof InvoiceNotFoundError) {
          return toNotFound(set, error.message)
        }

        console.error(
          `[invoices] POST /invoices/:invoiceId/notify/overdue —`,
          error instanceof Error ? error.stack ?? error.message : error
        )
        return toServerError(set, "Unable to send notification right now.")
      }
    })
    .post("/:invoiceId/notify/cancelled", async ({ params, body, set }) => {
      const auth = await dependencies.authenticate()

      if (!auth.user) {
        return toUnauthorized(set)
      }

      if (!auth.organizationId) {
        return toForbidden(set, "No active organization found for invoices.")
      }

      const parsedParams = paramsSchema.safeParse(params)
      if (!parsedParams.success) {
        return toValidationError(set, parsedParams.error.issues)
      }

      const parsedBody = notifyCancelledSchema.safeParse(body ?? {})
      if (!parsedBody.success) {
        return toValidationError(set, parsedBody.error.issues)
      }
      const recipientEmail = parsedBody.data.recipientEmail ?? auth.user.email ?? undefined
      const reason = parsedBody.data.reason

      if (!recipientEmail) {
        return toValidationError(set, [{
          path: ["recipientEmail"],
          message: "Recipient email is required when user has no email",
        }])
      }

      try {
        const actorRoles = await toActorRoles({
          auth,
          getPlatformRole: dependencies.getPlatformRole,
        })

        if (!canManageInvoiceNotifications(actorRoles)) {
          return toForbidden(set, "Only owner/admin members can send notifications.")
        }

        const invoice = await dependencies.service.getInvoiceDetail({
          organizationId: auth.organizationId,
          invoiceId: parsedParams.data.invoiceId,
        })

        dependencies.emailService.sendInvoiceCancelled(
          invoice,
          recipientEmail,
          reason,
        ).catch((err) => {
          console.error("[Invoices] Failed to send invoice cancelled email:", err)
        })

        return {
          ok: true as const,
          message: `Invoice ${invoice.invoiceNumber} cancelled notification sent`,
        }
      } catch (error) {
        if (error instanceof InvoiceNotFoundError) {
          return toNotFound(set, error.message)
        }

        console.error(
          `[invoices] POST /invoices/:invoiceId/notify/cancelled —`,
          error instanceof Error ? error.stack ?? error.message : error
        )
        return toServerError(set, "Unable to send notification right now.")
      }
    })
    .post("/:invoiceId/mark-paid", async ({ params, body, set }) => {
      const auth = await dependencies.authenticate()

      if (!auth.user) {
        return toUnauthorized(set)
      }

      const parsedParams = paramsSchema.safeParse(params)
      if (!parsedParams.success) {
        return toValidationError(set, parsedParams.error.issues)
      }

      const parsedBody = markPaidBodySchema.safeParse(body ?? {})
      if (!parsedBody.success) {
        return toValidationError(set, parsedBody.error.issues)
      }

      try {
        const actorRoles = await toActorRoles({
          auth,
          getPlatformRole: dependencies.getPlatformRole,
        })

        if (!canManuallyMarkPaid(actorRoles)) {
          return toForbidden(set, "Only super admins can manually mark invoices as paid.")
        }

        const invoice = await dependencies.service.markInvoiceAsPaid({
          organizationId: null,
          invoiceId: parsedParams.data.invoiceId,
          adminUserId: auth.user.id,
          paymentMethod: parsedBody.data.paymentMethod,
          referenceNumber: parsedBody.data.referenceNumber,
          notes: parsedBody.data.notes,
        })

        return {
          ok: true as const,
          invoice,
        }
      } catch (error) {
        if (error instanceof InvoiceNotFoundError) {
          return toNotFound(set, error.message)
        }

        if (
          error instanceof Error &&
          error.message === "INVOICE_ALREADY_MARKED_PAID"
        ) {
          set.status = 409
          return {
            ok: false as const,
            error: "CONFLICT" as const,
            message: "Invoice has already been marked as paid.",
          }
        }

        console.error(
          `[invoices] POST /invoices/:invoiceId/mark-paid —`,
          error instanceof Error ? error.stack ?? error.message : error
        )
        return toServerError(set, "Unable to mark invoice as paid right now.")
      }
    })
}

export const invoicesRoutes = createInvoicesRoutes()
export type App = ReturnType<typeof createInvoicesRoutes>
