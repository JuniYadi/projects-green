import { Elysia } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"

import { prisma } from "@/lib/prisma"
import { fieldErrorMapFromIssues } from "@/lib/validation"
import { VoucherService } from "../vouchers.service"
import { redeemVoucherSchema } from "./vouchers.schemas"
import { toVoucherClaimDTO } from "../vouchers.dto"
import {
  VoucherNotFoundError,
  VoucherExpiredError,
  VoucherDepletedError,
  VoucherDisabledError,
  VoucherAlreadyClaimedError,
  VoucherTargetUserMismatchError,
  VoucherTargetOrgMismatchError,
} from "../vouchers.errors"

type VoucherAuthContext = {
  organizationId?: string | null
  role?: string | null
  roles?: string[] | null
  user: { id: string; email?: string | null } | null
}

type RouteSet = {
  status?: number | string
}

type ConsoleVoucherRouteDeps = {
  authenticate: () => Promise<VoucherAuthContext>
  service: VoucherService
}

const defaultDeps: ConsoleVoucherRouteDeps = {
  authenticate: () => withAuth(),
  service: new VoucherService(prisma),
}

const toUnauthorized = (set: RouteSet) => {
  set.status = 401
  return {
    ok: false as const,
    error: "UNAUTHORIZED" as const,
    message: "You must be signed in to redeem vouchers.",
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

const toServerError = (set: RouteSet, message: string) => {
  set.status = 500
  return {
    ok: false as const,
    error: "INTERNAL_SERVER_ERROR" as const,
    message,
  }
}

const toErrorResponse = (set: RouteSet, error: unknown) => {
  if (error instanceof VoucherNotFoundError) {
    set.status = 404
    return {
      ok: false as const,
      error: "VOUCHER_NOT_FOUND" as const,
      message: error.message,
    }
  }

  if (error instanceof VoucherExpiredError) {
    set.status = 400
    return {
      ok: false as const,
      error: "VOUCHER_EXPIRED" as const,
      message: error.message,
    }
  }

  if (error instanceof VoucherDepletedError) {
    set.status = 400
    return {
      ok: false as const,
      error: "VOUCHER_DEPLETED" as const,
      message: error.message,
    }
  }

  if (error instanceof VoucherDisabledError) {
    set.status = 400
    return {
      ok: false as const,
      error: "VOUCHER_DISABLED" as const,
      message: error.message,
    }
  }

  if (error instanceof VoucherAlreadyClaimedError) {
    set.status = 409
    return {
      ok: false as const,
      error: "VOUCHER_ALREADY_CLAIMED" as const,
      message: error.message,
    }
  }

  if (
    error instanceof VoucherTargetUserMismatchError ||
    error instanceof VoucherTargetOrgMismatchError
  ) {
    set.status = 403
    return {
      ok: false as const,
      error: "VOUCHER_TARGET_MISMATCH" as const,
      message: error.message,
    }
  }

  // Handle unique constraint violation (already claimed)
  if (
    error instanceof Error &&
    "code" in error &&
    (error as { code: string }).code === "P2002"
  ) {
    set.status = 409
    return {
      ok: false as const,
      error: "VOUCHER_ALREADY_CLAIMED" as const,
      message: "This voucher has already been claimed.",
    }
  }

  console.error("[Console Vouchers] Error:", error)
  return toServerError(
    set,
    error instanceof Error ? error.message : "An unexpected error occurred."
  )
}

export const createConsoleVoucherRoutes = (
  deps: Partial<ConsoleVoucherRouteDeps> = {}
) => {
  const { authenticate, service } = {
    ...defaultDeps,
    ...deps,
  }

  return (
    new Elysia({ prefix: "/vouchers" })
      // POST /vouchers/redeem — redeem a voucher by code
      .post("/redeem", async ({ body, set }) => {
        const auth = await authenticate()

        if (!auth.user) {
          return toUnauthorized(set)
        }

        if (!auth.organizationId) {
          return toForbidden(set, "No active organization found.")
        }

        const parsed = redeemVoucherSchema.safeParse(body)
        if (!parsed.success) {
          set.status = 422
          return {
            ok: false as const,
            error: "VALIDATION_ERROR" as const,
            message: "Please fix the highlighted fields and try again.",
            fieldErrors: fieldErrorMapFromIssues(parsed.error.issues),
          }
        }

        try {
          const result = await service.redeemVoucher({
            code: parsed.data.code,
            workosUserId: auth.user.id,
            organizationId: auth.organizationId,
          })

          return {
            ok: true as const,
            data: result,
          }
        } catch (error) {
          return toErrorResponse(set, error)
        }
      })

      // GET /vouchers/claims — user claim history
      .get("/claims", async ({ set }) => {
        const auth = await authenticate()

        if (!auth.user) {
          return toUnauthorized(set)
        }

        if (!auth.organizationId) {
          return toForbidden(set, "No active organization found.")
        }

        try {
          const claims = await service.getUserClaims(
            auth.user.id,
            auth.organizationId
          )

          const result = claims.map((claim) => ({
            ...toVoucherClaimDTO(claim),
            voucher: {
              code: claim.voucher.code,
              amount: claim.voucher.amount.toFixed(2),
              currency: claim.voucher.currency,
            },
          }))

          return {
            ok: true as const,
            data: result,
          }
        } catch (error) {
          console.error("[Console Vouchers] Error:", error)
          return toServerError(
            set,
            error instanceof Error
              ? error.message
              : "An unexpected error occurred."
          )
        }
      })
  )
}

export const consoleVoucherRoutes = createConsoleVoucherRoutes()
