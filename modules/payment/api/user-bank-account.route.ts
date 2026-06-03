import { Elysia } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"

import { BankAccountService } from "../services/bank-account.service"

type BankAuthContext = {
  organizationId?: string | null
  user: { id: string; email?: string | null } | null
}

type RouteSet = {
  status?: number | string
}

function toUnauthorized(set: RouteSet) {
  set.status = 401
  return {
    success: false as const,
    error: "UNAUTHORIZED" as const,
    message: "You must be signed in to access payment methods.",
  }
}

function toForbidden(set: RouteSet, message: string) {
  set.status = 403
  return {
    success: false as const,
    error: "FORBIDDEN" as const,
    message,
  }
}

function toValidationError(set: RouteSet, message: string) {
  set.status = 422
  return {
    success: false as const,
    error: "VALIDATION_ERROR" as const,
    message,
  }
}

function toNotFoundError(set: RouteSet) {
  set.status = 404
  return {
    success: false as const,
    error: "NOT_FOUND" as const,
    message: "Payment method not found.",
  }
}

const bankAccountService = new BankAccountService()

export function createUserBankAccountRoutes() {
  return new Elysia({ prefix: "/bank-accounts" })
    .get("/", async ({ set }) => {
      const auth = (await withAuth()) as BankAuthContext

      if (!auth.user) {
        return toUnauthorized(set)
      }

      if (!auth.organizationId) {
        return toForbidden(set, "No active organization found.")
      }

      const accounts = await bankAccountService.getActiveAccounts()

      return {
        success: true,
        data: {
          accounts,
        },
      }
    })
    .patch("/:id/default", async ({ params, set }) => {
      const auth = (await withAuth()) as BankAuthContext

      if (!auth.user) {
        return toUnauthorized(set)
      }

      if (!auth.organizationId) {
        return toForbidden(set, "No active organization found.")
      }

      const account = await bankAccountService.findById(params.id)
      if (!account) {
        return toNotFoundError(set)
      }

      const updated = await bankAccountService.update(params.id, {
        isDefault: true,
      })

      return {
        success: true,
        data: {
          account: updated,
        },
      }
    })
    .delete("/:id", async ({ params, set }) => {
      const auth = (await withAuth()) as BankAuthContext

      if (!auth.user) {
        return toUnauthorized(set)
      }

      if (!auth.organizationId) {
        return toForbidden(set, "No active organization found.")
      }

      const account = await bankAccountService.findById(params.id)
      if (!account) {
        return toNotFoundError(set)
      }

      if (account.isDefault) {
        return toValidationError(
          set,
          "Cannot remove the default payment method. Set another as default first."
        )
      }

      await bankAccountService.toggle(params.id)

      return {
        success: true,
        data: {
          message: "Payment method removed successfully.",
        },
      }
    })
}
