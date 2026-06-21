import { Elysia } from "elysia"
import { z } from "zod"
import { withAuth } from "@workos-inc/authkit-nextjs"

import { CurrencyService } from "@/modules/billing/currency.service"
import { toCurrencyDTO } from "@/modules/billing/currency.dto"
import { getPlatformRoleForUser } from "@/lib/platform-role"

const currencyService = new CurrencyService()

const CreateCurrencySchema = z.object({
  code: z.string().min(2).max(8),
  name: z.string().min(1),
  symbol: z.string().min(1).max(8),
  isBase: z.boolean().optional(),
  ratePerBase: z.number().positive(),
  minTopup: z.number().nonnegative(),
  maxTopup: z.number().positive(),
  sortOrder: z.number().int().optional(),
})

const UpdateCurrencySchema = z.object({
  name: z.string().min(1).optional(),
  symbol: z.string().min(1).max(8).optional(),
  isBase: z.boolean().optional(),
  ratePerBase: z.number().positive().optional(),
  minTopup: z.number().nonnegative().optional(),
  maxTopup: z.number().positive().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
})

async function requireSuperAdmin() {
  const auth = await withAuth()
  if (!auth.user || !auth.organizationId) {
    return {
      ok: false as const,
      status: 401,
      error: "UNAUTHORIZED",
      message: "Authentication required",
    }
  }
  const platformRole = await getPlatformRoleForUser(auth.user)
  if (platformRole !== "super_admin") {
    return {
      ok: false as const,
      status: 403,
      error: "FORBIDDEN",
      message: "Admin access required",
    }
  }
  return { ok: true as const }
}

export const createAdminCurrencyRoutes = () =>
  new Elysia({ prefix: "/currencies" })
    .get("/", async ({ set }) => {
      const guard = await requireSuperAdmin()
      if (!guard.ok) {
        set.status = guard.status
        return { ok: false, error: guard.error, message: guard.message }
      }

      return currencyService.listDTO(true)
    })
    .post("/", async ({ body, set }) => {
      const guard = await requireSuperAdmin()
      if (!guard.ok) {
        set.status = guard.status
        return { ok: false, error: guard.error, message: guard.message }
      }

      const parsed = CreateCurrencySchema.safeParse(body)
      if (!parsed.success) {
        set.status = 400
        return {
          ok: false,
          error: "VALIDATION_ERROR",
          message: "Invalid input",
          fieldErrors: parsed.error.flatten().fieldErrors,
        }
      }

      try {
        const currency = await currencyService.create(parsed.data)
        return toCurrencyDTO(currency)
      } catch (error) {
        set.status = 400
        return {
          ok: false,
          error: "CLIENT_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to create currency",
        }
      }
    })
    .put("/:id", async ({ body, params, set }) => {
      const guard = await requireSuperAdmin()
      if (!guard.ok) {
        set.status = guard.status
        return { ok: false, error: guard.error, message: guard.message }
      }

      const parsed = UpdateCurrencySchema.safeParse(body)
      if (!parsed.success) {
        set.status = 400
        return {
          ok: false,
          error: "VALIDATION_ERROR",
          message: "Invalid input",
          fieldErrors: parsed.error.flatten().fieldErrors,
        }
      }

      try {
        const currency = await currencyService.update(params.id, parsed.data)
        return toCurrencyDTO(currency)
      } catch (error) {
        set.status = 400
        return {
          ok: false,
          error: "CLIENT_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to update currency",
        }
      }
    })
    .patch("/:id/toggle", async ({ params, set }) => {
      const guard = await requireSuperAdmin()
      if (!guard.ok) {
        set.status = guard.status
        return { ok: false, error: guard.error, message: guard.message }
      }

      try {
        const currency = await currencyService.toggle(params.id)
        return toCurrencyDTO(currency)
      } catch (error) {
        set.status = 400
        return {
          ok: false,
          error: "CLIENT_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to toggle currency",
        }
      }
    })
