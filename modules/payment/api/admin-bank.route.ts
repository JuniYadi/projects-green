import { Elysia } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"

import { BankAccountService } from "../services/bank-account.service"
import { getPlatformRoleForUser } from "@/lib/platform-role"
import { requireSuperAdmin } from "@/modules/admin/api/admin.guards"
import { BANK_CODES } from "../constants"

const bankAccountService = new BankAccountService()

export const createAdminBankRoutes = () =>
  new Elysia({ prefix: "/bank-accounts" })
    .get("/", async ({ set }) => {
      const actor = await requireSuperAdmin(set)
      if (!actor.ok) return actor
      const accounts = await bankAccountService.list({ includeInactive: true })
      return { ok: true, data: accounts }
    })
    .post("/", async ({ body }) => {
      const auth = await withAuth()
      if (!auth.user || !auth.organizationId) {
        return { ok: false, error: "UNAUTHORIZED", message: "Authentication required" }
      }

      // Check super_admin role
      const platformRole = await getPlatformRoleForUser(auth.user)
      if (platformRole !== "super_admin") {
        return { ok: false, error: "FORBIDDEN", message: "Admin access required" }
      }

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

      const resolvedBankName = BANK_CODES[bankCode as keyof typeof BANK_CODES]?.name || bankName

      const account = await bankAccountService.create({
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

      return { ok: true, data: account }
    })
    .put("/:id", async ({ body, params }) => {
      const auth = await withAuth()
      if (!auth.user || !auth.organizationId) {
        return { ok: false, error: "UNAUTHORIZED", message: "Authentication required" }
      }

      const platformRole = await getPlatformRoleForUser(auth.user)
      if (platformRole !== "super_admin") {
        return { ok: false, error: "FORBIDDEN", message: "Admin access required" }
      }

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

      const account = await bankAccountService.update(params.id, {
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

      return { ok: true, data: account }
    })
    .patch("/:id/toggle", async ({ params }) => {
      const auth = await withAuth()
      if (!auth.user || !auth.organizationId) {
        return { ok: false, error: "UNAUTHORIZED", message: "Authentication required" }
      }

      const platformRole = await getPlatformRoleForUser(auth.user)
      if (platformRole !== "super_admin") {
        return { ok: false, error: "FORBIDDEN", message: "Admin access required" }
      }

      const account = await bankAccountService.toggle(params.id)
      return { ok: true, data: account }
    })