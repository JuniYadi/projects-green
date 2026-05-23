import { Elysia } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { z } from "zod"

import { fieldErrorMapFromIssues } from "@/lib/validation"
import type { PlatformAccessRole } from "@/lib/platform-role"
import { buildInvoicePdfBytes } from "@/modules/invoices/invoice-pdf"
import { canManageInvoiceCancellation } from "@/modules/invoices/invoices.policy"
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
}

const createDefaultDependencies = (): InvoiceRouteDependencies => ({
  authenticate: () => withAuth(),
  getPlatformRole: async (input) => {
    const platformRoleModule = await import("@/lib/platform-role")
    return platformRoleModule.getPlatformRoleForUser(input)
  },
  service: createInvoiceService(),
  emailService: createInvoiceEmailService(),
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

      if (!auth.organizationId) {
        return toForbidden(set, "No active organization found for invoices.")
      }

      const parsedQuery = listQuerySchema.safeParse(query)

      if (!parsedQuery.success) {
        return toValidationError(set, parsedQuery.error.issues)
      }

      try {
        const invoices = await dependencies.service.listInvoices({
          organizationId: auth.organizationId,
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

      if (!auth.organizationId) {
        return toForbidden(set, "No active organization found for invoices.")
      }

      const parsedParams = paramsSchema.safeParse(params)

      if (!parsedParams.success) {
        return toValidationError(set, parsedParams.error.issues)
      }

      try {
        const invoice = await dependencies.service.getInvoiceDetail({
          organizationId: auth.organizationId,
          invoiceId: parsedParams.data.invoiceId,
        })

        const actorRoles = await toActorRoles({
          auth,
          getPlatformRole: dependencies.getPlatformRole,
        })

        return {
          ok: true as const,
          invoice,
          canMarkCanceled:
            canManageInvoiceCancellation(actorRoles) &&
            isCancelableStatus(invoice.status),
        }
      } catch (error) {
        if (error instanceof InvoiceNotFoundError) {
          return toNotFound(set, error.message)
        }

        return toServerError(set, "Unable to load invoice detail right now.")
      }
    })
    .get("/:invoiceId/pdf", async ({ params, set }) => {
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

      try {
        const invoice = await dependencies.service.getInvoiceDetail({
          organizationId: auth.organizationId,
          invoiceId: parsedParams.data.invoiceId,
        })

        const bytes = buildInvoicePdfBytes(invoice)
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

        return toServerError(set, "Unable to download invoice PDF right now.")
      }
    })
    .post("/:invoiceId/cancel", async ({ params, set }) => {
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

      try {
        const actorRoles = await toActorRoles({
          auth,
          getPlatformRole: dependencies.getPlatformRole,
        })

        if (!canManageInvoiceCancellation(actorRoles)) {
          return toForbidden(
            set,
            "Only owner/admin members can mark invoices as canceled."
          )
        }

        const invoice = await dependencies.service.cancelInvoice({
          organizationId: auth.organizationId,
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

        if (!canManageInvoiceCancellation(actorRoles)) {
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

        if (!canManageInvoiceCancellation(actorRoles)) {
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

        if (!canManageInvoiceCancellation(actorRoles)) {
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

        if (!canManageInvoiceCancellation(actorRoles)) {
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

        if (!canManageInvoiceCancellation(actorRoles)) {
          return toForbidden(set, "Only owner/admin members can send notifications.")
        }

        const invoice = await dependencies.service.getInvoiceDetail({
          organizationId: auth.organizationId,
          invoiceId: parsedParams.data.invoiceId,
        })

        dependencies.emailService.sendInvoiceCancelled(
          invoice,
          recipientEmail,
          parsedBody.data.reason,
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

        return toServerError(set, "Unable to send notification right now.")
      }
    })
}

export const invoicesRoutes = createInvoicesRoutes()
export type App = ReturnType<typeof createInvoicesRoutes>
