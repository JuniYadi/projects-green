import { Elysia } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"

import { prisma } from "@/lib/prisma"

import {
  getOrCreateAccountWithContacts,
  addBillingContact,
  updateBillingContact,
  deactivateBillingContact,
  updatePreferredCurrency,
  updateAlertPreferences,
  hasInvoices,
} from "../billing-account.service"
import {
  createBillingContactSchema,
  updateBillingContactSchema,
  updateCurrencySchema,
  updateAlertPreferencesSchema,
  toBillingAccountDTO,
  toBillingContactDTO,
} from "../billing.dto"

type BillingAuthContext = {
  organizationId?: string | null
  user: { id: string; email?: string | null } | null
}

type BillingRouteDeps = {
  authenticate: () => Promise<BillingAuthContext>
}

const defaultDeps: BillingRouteDeps = {
  authenticate: () => withAuth(),
}

const toError = (
  set: { status?: number | string },
  status: number,
  code: string,
  message: string
) => {
  set.status = status
  return { ok: false as const, error: code, message }
}

export const createBillingRoutes = (deps: Partial<BillingRouteDeps> = {}) => {
  const { authenticate } = { ...defaultDeps, ...deps }

  return (
    new Elysia()
      // ─── GET /billing/account/detail ───────────────────────────────────────
      // Detailed account payload (contacts, alert prefs, currency). Served on a
      // distinct path so it never collides with the summary GET /account handler
      // in account.route.ts (which powers the dashboard balance card + topup).
      .get("/account/detail", async ({ set }) => {
        const auth = await authenticate()

        if (!auth.user) {
          return toError(set, 401, "UNAUTHORIZED", "You must be signed in.")
        }

        if (!auth.organizationId) {
          return toError(
            set,
            403,
            "NO_ORGANIZATION",
            "No active organization found."
          )
        }

        try {
          const account = await getOrCreateAccountWithContacts({
            organizationId: auth.organizationId,
            userEmail: auth.user.email ?? "",
          })
          return { ok: true as const, ...toBillingAccountDTO(account) }
        } catch (err) {
          console.error("[Billing] GET /account/detail error:", err)
          return toError(
            set,
            500,
            "INTERNAL_ERROR",
            "Unable to load billing account."
          )
        }
      })

      // ─── GET /billing/contacts/count ───────────────────────────────────────
      // Lightweight check — does NOT auto-create contacts or billing accounts.
      // Single-purpose: guard knows whether to redirect without side effects.
      .get("/contacts/count", async ({ set }) => {
        const auth = await authenticate()

        if (!auth.user) {
          return toError(set, 401, "UNAUTHORIZED", "You must be signed in.")
        }

        if (!auth.organizationId) {
          return toError(
            set,
            403,
            "NO_ORGANIZATION",
            "No active organization found."
          )
        }

        try {
          const account = await prisma.billingAccount.findUnique({
            where: { organizationId: auth.organizationId },
            select: { id: true },
          })

          if (!account) {
            return { ok: true as const, count: 0 }
          }

          const count = await prisma.billingContact.count({
            where: { billingAccountId: account.id, isActive: true },
          })

          return { ok: true as const, count }
        } catch (err) {
          console.error("[Billing] GET /contacts/count error:", err)
          return toError(
            set,
            500,
            "INTERNAL_ERROR",
            "Unable to check contacts."
          )
        }
      })

      // ─── POST /billing/contacts ───────────────────────────────────────────
      .post("/contacts", async ({ set, body }) => {
        const auth = await authenticate()

        if (!auth.user) {
          return toError(set, 401, "UNAUTHORIZED", "You must be signed in.")
        }

        if (!auth.organizationId) {
          return toError(
            set,
            403,
            "NO_ORGANIZATION",
            "No active organization found."
          )
        }

        const parsed = createBillingContactSchema.safeParse(body)
        if (!parsed.success) {
          return toError(set, 400, "VALIDATION_ERROR", parsed.error.message)
        }

        const input = parsed.data

        // Ensure account exists (creates if needed, pre-fills owner contact)
        const account = await getOrCreateAccountWithContacts({
          organizationId: auth.organizationId,
          userEmail: auth.user.email ?? "",
        })

        // Prevent duplicate email within same billing account
        const existing = account.contacts.find(
          (c) => c.email.toLowerCase() === input.email.toLowerCase()
        )
        if (existing) {
          return toError(
            set,
            409,
            "DUPLICATE_EMAIL",
            "A billing contact with this email already exists."
          )
        }

        try {
          const contact = await addBillingContact({
            billingAccountId: account.id,
            email: input.email,
            name: input.name,
            role: input.role,
            notifyOnInvoice: input.notifyOnInvoice,
            notifyOnLowBalance: input.notifyOnLowBalance,
            notifyOnSupport: input.notifyOnSupport,
          })
          return { ok: true as const, ...toBillingContactDTO(contact) }
        } catch (err) {
          console.error("[Billing] POST /contacts error:", err)
          return toError(
            set,
            500,
            "INTERNAL_ERROR",
            "Unable to add billing contact."
          )
        }
      })

      // ─── PATCH /billing/contacts/:contactId ──────────────────────────────
      .patch("/contacts/:contactId", async ({ set, params, body }) => {
        const auth = await authenticate()

        if (!auth.user) {
          return toError(set, 401, "UNAUTHORIZED", "You must be signed in.")
        }

        if (!auth.organizationId) {
          return toError(
            set,
            403,
            "NO_ORGANIZATION",
            "No active organization found."
          )
        }

        const { contactId } = params as { contactId: string }

        const parsed = updateBillingContactSchema.safeParse(body)
        if (!parsed.success) {
          return toError(set, 400, "VALIDATION_ERROR", parsed.error.message)
        }

        const input = parsed.data

        try {
          const contact = await updateBillingContact(
            auth.organizationId,
            contactId,
            input
          )
          return { ok: true as const, ...toBillingContactDTO(contact) }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)

          if (msg === "CONTACT_NOT_FOUND") {
            return toError(set, 404, "NOT_FOUND", "Billing contact not found.")
          }

          console.error("[Billing] PATCH /contacts/:id error:", err)
          return toError(
            set,
            500,
            "INTERNAL_ERROR",
            "Unable to update billing contact."
          )
        }
      })

      // ─── DELETE /billing/contacts/:contactId ──────────────────────────────
      .delete("/contacts/:contactId", async ({ set, params }) => {
        const auth = await authenticate()

        if (!auth.user) {
          return toError(set, 401, "UNAUTHORIZED", "You must be signed in.")
        }

        if (!auth.organizationId) {
          return toError(
            set,
            403,
            "NO_ORGANIZATION",
            "No active organization found."
          )
        }

        const { contactId } = params as { contactId: string }

        try {
          await deactivateBillingContact(auth.organizationId, contactId)
          return { ok: true as const }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)

          if (msg === "CONTACT_NOT_FOUND") {
            return toError(set, 404, "NOT_FOUND", "Billing contact not found.")
          }

          if (msg === "OWNER_PROTECTED") {
            return toError(
              set,
              403,
              "OWNER_PROTECTED",
              "Cannot deactivate the OWNER billing contact."
            )
          }

          console.error("[Billing] DELETE /contacts/:id error:", err)
          return toError(
            set,
            500,
            "INTERNAL_ERROR",
            "Unable to remove billing contact."
          )
        }
      })

      // ─── PATCH /billing/currency ──────────────────────────────────────────
      .patch("/currency", async ({ set, body }) => {
        const auth = await authenticate()

        if (!auth.user) {
          return toError(set, 401, "UNAUTHORIZED", "You must be signed in.")
        }

        if (!auth.organizationId) {
          return toError(
            set,
            403,
            "NO_ORGANIZATION",
            "No active organization found."
          )
        }

        const parsed = updateCurrencySchema.safeParse(body)
        if (!parsed.success) {
          return toError(set, 400, "VALIDATION_ERROR", parsed.error.message)
        }

        const { preferredCurrency } = parsed.data

        // Check for existing transactions
        const txExists = await hasInvoices(auth.organizationId)
        if (txExists) {
          return toError(
            set,
            409,
            "CURRENCY_LOCKED",
            "Cannot change currency after invoices exist. Current currency is locked."
          )
        }

        try {
          const account = await updatePreferredCurrency(
            auth.organizationId,
            preferredCurrency
          )
          return {
            ok: true as const,
            preferredCurrency: account.preferredCurrency,
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)

          if (msg === "BILLING_ACCOUNT_NOT_FOUND") {
            return toError(set, 404, "NOT_FOUND", "Billing account not found.")
          }

          console.error("[Billing] PATCH /currency error:", err)
          return toError(
            set,
            500,
            "INTERNAL_ERROR",
            "Unable to update currency preference."
          )
        }
      })

      // ─── PATCH /billing/alerts ────────────────────────────────────────────
      .patch("/alerts", async ({ set, body }) => {
        const auth = await authenticate()

        if (!auth.user) {
          return toError(set, 401, "UNAUTHORIZED", "You must be signed in.")
        }

        if (!auth.organizationId) {
          return toError(
            set,
            403,
            "NO_ORGANIZATION",
            "No active organization found."
          )
        }

        const parsed = updateAlertPreferencesSchema.safeParse(body)
        if (!parsed.success) {
          return toError(set, 400, "VALIDATION_ERROR", parsed.error.message)
        }

        try {
          const account = await updateAlertPreferences(
            auth.organizationId,
            parsed.data as Record<string, unknown>
          )
          return { ok: true as const, ...toBillingAccountDTO(account) }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)

          if (msg === "BILLING_ACCOUNT_NOT_FOUND") {
            return toError(set, 404, "NOT_FOUND", "Billing account not found.")
          }

          console.error("[Billing] PATCH /alerts error:", err)
          return toError(
            set,
            500,
            "INTERNAL_ERROR",
            "Unable to update alert preferences."
          )
        }
      })
  )
}

export const billingRoutes = createBillingRoutes()
