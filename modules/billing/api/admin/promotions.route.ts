import { Elysia } from "elysia"
import { Prisma, type PrismaClient } from "@prisma/client"
import { z } from "zod"

import { prisma as defaultPrisma } from "@/lib/prisma"
import { fieldErrorMapFromIssues } from "@/lib/validation"
import {
  requireSuperAdmin,
  type AdminApiError,
  type RouteSet,
} from "@/modules/admin/api/admin.guards"
import { VoucherService } from "@/modules/vouchers/vouchers.service"
import {
  createPromotionSchema,
  updatePromotionSchema,
  listPromotionsQuerySchema,
  voucherIdParamSchema,
} from "@/modules/vouchers/api/vouchers.schemas"
import {
  toVoucherDTO,
  toVoucherClaimDTO,
} from "@/modules/vouchers/vouchers.dto"
import {
  VoucherNotFoundError,
  VoucherNotAPromotionError,
  VoucherAlreadyPublishedError,
  VoucherAlreadyDisabledError,
  VoucherNotPublishableError,
  VoucherDiscountConfigurationError,
} from "@/modules/vouchers/vouchers.errors"

type PromotionDb = Pick<
  PrismaClient,
  "voucher" | "voucherClaim" | "$transaction"
>

type AdminPromotionsRouteDeps = {
  requireSuperAdmin?: typeof requireSuperAdmin
  prisma?: PromotionDb
  service?: VoucherService
}

const validationError = (
  set: RouteSet,
  issues: z.ZodIssue[]
): AdminApiError => {
  set.status = 422
  return {
    ok: false,
    error: "VALIDATION_ERROR",
    message: "Please fix the highlighted fields and try again.",
    fieldErrors: fieldErrorMapFromIssues(issues),
  }
}

const notFoundError = (set: RouteSet, message: string): AdminApiError => {
  set.status = 404
  return {
    ok: false,
    error: "NOT_FOUND",
    message,
  }
}

const notPromotionError = (set: RouteSet, message: string): AdminApiError => {
  set.status = 400
  return {
    ok: false,
    error: "VOUCHER_NOT_A_PROMOTION",
    message,
  }
}

const publishableError = (set: RouteSet, message: string): AdminApiError => {
  set.status = 422
  return {
    ok: false,
    error: "VOUCHER_NOT_PUBLISHABLE",
    message,
  }
}

const discountConfigError = (set: RouteSet, message: string): AdminApiError => {
  set.status = 422
  return {
    ok: false,
    error: "VOUCHER_DISCOUNT_CONFIG_ERROR",
    message,
  }
}

const alreadyPublishedError = (
  set: RouteSet,
  message: string
): AdminApiError => {
  set.status = 409
  return {
    ok: false,
    error: "VOUCHER_ALREADY_PUBLISHED",
    message,
  }
}

const alreadyDisabledError = (
  set: RouteSet,
  message: string
): AdminApiError => {
  set.status = 409
  return {
    ok: false,
    error: "VOUCHER_ALREADY_DISABLED",
    message,
  }
}

const serverError = (set: RouteSet): AdminApiError => {
  set.status = 500
  return {
    ok: false,
    error: "INTERNAL_SERVER_ERROR",
    message: "An unexpected error occurred.",
  }
}

function toAdminApiError(set: RouteSet, error: unknown): AdminApiError {
  if (error instanceof VoucherNotFoundError) {
    return notFoundError(set, error.message)
  }
  if (error instanceof VoucherNotAPromotionError) {
    return notPromotionError(set, error.message)
  }
  if (error instanceof VoucherAlreadyPublishedError) {
    return alreadyPublishedError(set, error.message)
  }
  if (error instanceof VoucherAlreadyDisabledError) {
    return alreadyDisabledError(set, error.message)
  }
  if (error instanceof VoucherNotPublishableError) {
    return publishableError(set, error.message)
  }
  if (error instanceof VoucherDiscountConfigurationError) {
    return discountConfigError(set, error.message)
  }

  console.error("[AdminPromotions] Error:", error)
  return serverError(set)
}

export const createAdminPromotionsRoutes = (
  deps: AdminPromotionsRouteDeps = {}
) => {
  const db = deps.prisma ?? (defaultPrisma as unknown as PromotionDb)
  const service = deps.service ?? new VoucherService(db as never)
  const guard = deps.requireSuperAdmin ?? requireSuperAdmin

  return (
    new Elysia({ prefix: "/admin/promotions" })
      // ─── GET /admin/promotions — List vouchers (both kinds) ──────────────────

      .get("/", async ({ query, set }) => {
        const actor = await guard(set)
        if ("ok" in actor && !actor.ok) return actor as AdminApiError

        const parsed = listPromotionsQuerySchema.safeParse(query)
        if (!parsed.success) {
          return validationError(set, parsed.error.issues)
        }

        try {
          const { vouchers, total } = await service.listPromotions(parsed.data)

          return {
            ok: true as const,
            data: vouchers.map((v) => toVoucherDTO(v as never)),
            total,
          }
        } catch (error) {
          return toAdminApiError(set, error)
        }
      })

      // ─── POST /admin/promotions — Create promotion voucher ───────────────────

      .post(
        "/",
        async ({ body, set }) => {
          const actor = await guard(set)
          if ("ok" in actor && !actor.ok) return actor as AdminApiError

          const parsed = createPromotionSchema.safeParse(body)
          if (!parsed.success) {
            return validationError(set, parsed.error.issues)
          }

          try {
            const voucher = await service.createPromotion({
              ...parsed.data,
              createdByWorkosUserId: actor.userId,
            })

            set.status = 201
            return {
              ok: true as const,
              data: toVoucherDTO(voucher as never),
            }
          } catch (error) {
            if (
              error instanceof Prisma.PrismaClientKnownRequestError &&
              error.code === "P2002"
            ) {
              set.status = 409
              return {
                ok: false as const,
                error: "CONFLICT",
                message: "A voucher with this code already exists.",
              } as AdminApiError
            }
            return toAdminApiError(set, error)
          }
        },
        { body: z.record(z.string(), z.unknown()) }
      )

      // ─── GET /admin/promotions/:id — Voucher detail ─────────────────────────────

      .get("/:id", async ({ params, set }) => {
        const actor = await guard(set)
        if ("ok" in actor && !actor.ok) return actor as AdminApiError

        const parsed = voucherIdParamSchema.safeParse(params)
        if (!parsed.success) {
          return validationError(set, parsed.error.issues)
        }

        try {
          const voucher = await service.getVoucherById(parsed.data.id)

          return {
            ok: true as const,
            data: toVoucherDTO(voucher as never),
          }
        } catch (error) {
          return toAdminApiError(set, error)
        }
      })

      // ─── PATCH /admin/promotions/:id — Update promotion voucher ────────────────

      .patch(
        "/:id",
        async ({ params, body, set }) => {
          const actor = await guard(set)
          if ("ok" in actor && !actor.ok) return actor as AdminApiError

          const idParsed = voucherIdParamSchema.safeParse(params)
          if (!idParsed.success) {
            return validationError(set, idParsed.error.issues)
          }

          const bodyParsed = updatePromotionSchema.safeParse(body)
          if (!bodyParsed.success) {
            return validationError(set, bodyParsed.error.issues)
          }

          try {
            const voucher = await service.updatePromotion(
              idParsed.data.id,
              bodyParsed.data
            )

            return {
              ok: true as const,
              data: toVoucherDTO(voucher as never),
            }
          } catch (error) {
            return toAdminApiError(set, error)
          }
        },
        { body: z.record(z.string(), z.unknown()) }
      )

      // ─── POST /admin/promotions/:id/publish — Publish (activate) voucher ─────

      .post("/:id/publish", async ({ params, set }) => {
        const actor = await guard(set)
        if ("ok" in actor && !actor.ok) return actor as AdminApiError

        const parsed = voucherIdParamSchema.safeParse(params)
        if (!parsed.success) {
          return validationError(set, parsed.error.issues)
        }

        try {
          const voucher = await service.publishVoucher(parsed.data.id)

          return {
            ok: true as const,
            data: toVoucherDTO(voucher as never),
          }
        } catch (error) {
          return toAdminApiError(set, error)
        }
      })

      // ─── POST /admin/promotions/:id/disable — Disable voucher ──────────────────

      .post("/:id/disable", async ({ params, set }) => {
        const actor = await guard(set)
        if ("ok" in actor && !actor.ok) return actor as AdminApiError

        const parsed = voucherIdParamSchema.safeParse(params)
        if (!parsed.success) {
          return validationError(set, parsed.error.issues)
        }

        try {
          const voucher = await service.disablePromotionVoucher(parsed.data.id)

          return {
            ok: true as const,
            data: toVoucherDTO(voucher as never),
          }
        } catch (error) {
          return toAdminApiError(set, error)
        }
      })

      // ─── GET /admin/promotions/:id/claims — Claim history for a voucher ────────

      .get("/:id/claims", async ({ params, set }) => {
        const actor = await guard(set)
        if ("ok" in actor && !actor.ok) return actor as AdminApiError

        const parsed = voucherIdParamSchema.safeParse(params)
        if (!parsed.success) {
          return validationError(set, parsed.error.issues)
        }

        try {
          const claims = await service.getPromotionClaims(parsed.data.id)

          return {
            ok: true as const,
            data: claims.map((c) => toVoucherClaimDTO(c as never)),
          }
        } catch (error) {
          return toAdminApiError(set, error)
        }
      })
  )
}

export const adminPromotionsRoutes = createAdminPromotionsRoutes()
