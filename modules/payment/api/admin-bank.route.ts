import { Elysia } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"

import { BankAccountService } from "../services/bank-account.service"
import { getPlatformRoleForUser } from "@/lib/platform-role"
import { requireSuperAdmin } from "@/modules/admin/api/admin.guards"
import { BANK_CODES } from "../constants"

const bankAccountService = new BankAccountService()

const requireBankAuth = async (set: { status?: number | string }) => {
  const auth = await withAuth()
  if (!auth.user || !auth.organizationId) {
    set.status = 401
    return {
      ok: false as const,
      error: "UNAUTHORIZED" as const,
      message: "Authentication required",
    }
  }
  const platformRole = await getPlatformRoleForUser(auth.user)
  if (platformRole !== "super_admin") {
    set.status = 403
    return {
      ok: false as const,
      error: "FORBIDDEN" as const,
      message: "Admin access required",
    }
  }
  return null
}

export const createAdminBankRoutes = () =>
  new Elysia({ prefix: "/bank-accounts" })
    .get("/", async ({ set }) => {
      const actor = await requireSuperAdmin(set)
      if (!actor.ok) return actor
      return bankAccountService.list({ includeInactive: true })
    })
    .post("/", async ({ body, set }) => {
      const err = await requireBankAuth(set)
      if (err) return err

      const {
        bankCode,
        bankName,
        accountName,
        accountNumber,
        currency,
        supportedCurrencies,
        swiftCode,
        bankAddress,
        isDefault,
      } = body as {
        bankCode: string
        bankName: string
        accountName: string
        accountNumber: string
        currency?: string
        supportedCurrencies?: string[]
        swiftCode?: string | null
        bankAddress?: string | null
        isDefault?: boolean
      }

      const resolvedBankName =
        BANK_CODES[bankCode as keyof typeof BANK_CODES]?.name || bankName

      return bankAccountService.create({
        bankCode,
        bankName: resolvedBankName,
        accountName,
        accountNumber,
        currency,
        supportedCurrencies,
        swiftCode,
        bankAddress,
        isDefault,
      })
    })
    .put("/:id", async ({ body, params, set }) => {
      const err = await requireBankAuth(set)
      if (err) return err

      const {
        bankCode,
        bankName,
        accountName,
        accountNumber,
        currency,
        supportedCurrencies,
        swiftCode,
        bankAddress,
        isDefault,
      } = body as {
        bankCode?: string
        bankName?: string
        accountName?: string
        accountNumber?: string
        currency?: string
        supportedCurrencies?: string[]
        swiftCode?: string | null
        bankAddress?: string | null
        isDefault?: boolean
      }

      const resolvedBankName = bankCode
        ? BANK_CODES[bankCode as keyof typeof BANK_CODES]?.name
        : undefined

      return bankAccountService.update(params.id, {
        bankCode,
        bankName: resolvedBankName || bankName,
        accountName,
        accountNumber,
        currency,
        supportedCurrencies,
        swiftCode,
        bankAddress,
        isDefault,
      })
    })
    .patch("/:id/toggle", async ({ params, set }) => {
      const err = await requireBankAuth(set)
      if (err) return err

      return bankAccountService.toggle(params.id)
    })
