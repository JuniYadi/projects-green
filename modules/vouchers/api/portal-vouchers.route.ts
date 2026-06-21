import { Elysia } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"

import { prisma } from "@/lib/prisma"
import { getPlatformRoleForUser } from "@/lib/platform-role"
import type { PlatformAccessRole } from "@/lib/platform-role"
import { fieldErrorMapFromIssues } from "@/lib/validation"
import { getCachedUser, getCachedOrganization } from "@/lib/workos-directory"
import { VoucherService } from "../vouchers.service"
import {
  createVoucherSchema,
  updateVoucherSchema,
  listVouchersQuerySchema,
  voucherIdParamSchema,
} from "./vouchers.schemas"
import {
  toVoucherDTO,
  toVoucherDetailDTO,
  toVoucherClaimDTO,
} from "../vouchers.dto"
import {
  VoucherNotFoundError,
  VoucherCollisionRetryExhaustedError,
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

type PortalVoucherRouteDeps = {
  authenticate: () => Promise<VoucherAuthContext>
  getPlatformRole: (input: {
    id?: string | null
    email?: string | null
  }) => Promise<PlatformAccessRole>
  service: VoucherService
}

const defaultDeps: PortalVoucherRouteDeps = {
  authenticate: () => withAuth(),
  getPlatformRole: getPlatformRoleForUser,
  service: new VoucherService(prisma),
}

const isAdmin = (actor: {
  platformRole: PlatformAccessRole
  orgRole: string | null | undefined
}): boolean => {
  if (actor.platformRole === "super_admin") return true
  return actor.orgRole === "admin" || actor.orgRole === "owner"
}

const toUnauthorized = (set: RouteSet) => {
  set.status = 401
  return {
    ok: false as const,
    error: "UNAUTHORIZED" as const,
    message: "You must be signed in to manage vouchers.",
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

const toErrorResponse = (set: RouteSet, error: unknown) => {
  if (error instanceof VoucherNotFoundError) {
    return toNotFound(set, error.message)
  }

  if (error instanceof VoucherCollisionRetryExhaustedError) {
    set.status = 409
    return {
      ok: false as const,
      error: "VOUCHER_COLLISION_RETRY_EXHAUSTED" as const,
      message: error.message,
    }
  }

  if (
    error instanceof Error &&
    error.message.startsWith("Cannot reduce maxClaims")
  ) {
    set.status = 400
    return {
      ok: false as const,
      error: "INVALID_UPDATE" as const,
      message: error.message,
    }
  }

  console.error("[Portal Vouchers] Error:", error)
  return toServerError(
    set,
    error instanceof Error ? error.message : "An unexpected error occurred."
  )
}

async function resolveActor(
  auth: VoucherAuthContext,
  getPlatformRole: PortalVoucherRouteDeps["getPlatformRole"]
) {
  const platformRole = await getPlatformRole({
    id: auth.user?.id,
    email: auth.user?.email,
  })

  return {
    platformRole,
    orgRole: auth.role,
  }
}

export const createPortalVoucherRoutes = (
  deps: Partial<PortalVoucherRouteDeps> = {}
) => {
  const { authenticate, getPlatformRole, service } = {
    ...defaultDeps,
    ...deps,
  }

  return (
    new Elysia({ prefix: "/vouchers/portal" })
      // GET /vouchers/portal — list vouchers
      .get("/", async ({ query, set }) => {
        const auth = await authenticate()

        if (!auth.user) {
          return toUnauthorized(set)
        }

        const actor = await resolveActor(auth, getPlatformRole)
        if (!isAdmin(actor)) {
          return toForbidden(set, "Only administrators can manage vouchers.")
        }

        const parsed = listVouchersQuerySchema.safeParse(query)
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
          const { vouchers, total } = await service.listVouchers(parsed.data)

          return {
            ok: true as const,
            data: vouchers.map(toVoucherDTO),
            total,
          }
        } catch (error) {
          return toErrorResponse(set, error)
        }
      })

      // POST /vouchers/portal — create voucher
      .post("/", async ({ body, set }) => {
        const auth = await authenticate()

        if (!auth.user) {
          return toUnauthorized(set)
        }

        const actor = await resolveActor(auth, getPlatformRole)
        if (!isAdmin(actor)) {
          return toForbidden(set, "Only administrators can create vouchers.")
        }

        const parsed = createVoucherSchema.safeParse(body)
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
          const voucher = await service.createVoucher({
            ...parsed.data,
            createdByWorkosUserId: auth.user.id,
          })

          set.status = 201
          return {
            ok: true as const,
            data: toVoucherDTO(voucher),
          }
        } catch (error) {
          return toErrorResponse(set, error)
        }
      })

      // GET /vouchers/portal/:id — voucher detail with claims
      .get("/:id", async ({ params, set }) => {
        const auth = await authenticate()

        if (!auth.user) {
          return toUnauthorized(set)
        }

        const actor = await resolveActor(auth, getPlatformRole)
        if (!isAdmin(actor)) {
          return toForbidden(
            set,
            "Only administrators can view voucher details."
          )
        }

        const parsed = voucherIdParamSchema.safeParse(params)
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
          const voucher = await service.getVoucherById(parsed.data.id)

          // Enrich with cached WorkOS names
          const [targetUser, targetOrg] = await Promise.all([
            getCachedUser(voucher.targetWorkosUserId ?? ""),
            getCachedOrganization(voucher.targetOrganizationId ?? ""),
          ])

          // Enrich claim names — deduplicate user/org IDs for efficiency
          const userIds = [
            ...new Set(voucher.claims.map((c) => c.workosUserId)),
          ]
          const orgIds = [
            ...new Set(voucher.claims.map((c) => c.organizationId)),
          ]

          const [userResults, orgResults] = await Promise.all([
            Promise.all(userIds.map((id) => getCachedUser(id))),
            Promise.all(orgIds.map((id) => getCachedOrganization(id))),
          ])

          const userMap = new Map(
            userResults.filter(Boolean).map((u) => [u!.id, u!.name])
          )
          const orgMap = new Map(
            orgResults.filter(Boolean).map((o) => [o!.id, o!.name])
          )

          const claimNames = new Map<
            string,
            { userName?: string | null; orgName?: string | null }
          >()
          for (const claim of voucher.claims) {
            claimNames.set(claim.id, {
              userName: userMap.get(claim.workosUserId) ?? null,
              orgName: orgMap.get(claim.organizationId) ?? null,
            })
          }

          return {
            ok: true as const,
            data: toVoucherDetailDTO(voucher, {
              targetUserName: targetUser?.name ?? null,
              targetOrgName: targetOrg?.name ?? null,
              claimNames,
            }),
          }
        } catch (error) {
          return toErrorResponse(set, error)
        }
      })

      // PATCH /vouchers/portal/:id — update voucher
      .patch("/:id", async ({ params, body, set }) => {
        const auth = await authenticate()

        if (!auth.user) {
          return toUnauthorized(set)
        }

        const actor = await resolveActor(auth, getPlatformRole)
        if (!isAdmin(actor)) {
          return toForbidden(set, "Only administrators can update vouchers.")
        }

        const idParsed = voucherIdParamSchema.safeParse(params)
        if (!idParsed.success) {
          set.status = 422
          return {
            ok: false as const,
            error: "VALIDATION_ERROR" as const,
            message: "Please fix the highlighted fields and try again.",
            fieldErrors: fieldErrorMapFromIssues(idParsed.error.issues),
          }
        }

        const bodyParsed = updateVoucherSchema.safeParse(body)
        if (!bodyParsed.success) {
          set.status = 422
          return {
            ok: false as const,
            error: "VALIDATION_ERROR" as const,
            message: "Please fix the highlighted fields and try again.",
            fieldErrors: fieldErrorMapFromIssues(bodyParsed.error.issues),
          }
        }

        try {
          const voucher = await service.updateVoucher(
            idParsed.data.id,
            bodyParsed.data
          )

          return {
            ok: true as const,
            data: toVoucherDTO(voucher),
          }
        } catch (error) {
          return toErrorResponse(set, error)
        }
      })

      // POST /vouchers/portal/:id/disable — disable voucher
      .post("/:id/disable", async ({ params, set }) => {
        const auth = await authenticate()

        if (!auth.user) {
          return toUnauthorized(set)
        }

        const actor = await resolveActor(auth, getPlatformRole)
        if (!isAdmin(actor)) {
          return toForbidden(set, "Only administrators can disable vouchers.")
        }

        const parsed = voucherIdParamSchema.safeParse(params)
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
          const voucher = await service.disableVoucher(parsed.data.id)

          return {
            ok: true as const,
            data: toVoucherDTO(voucher),
          }
        } catch (error) {
          return toErrorResponse(set, error)
        }
      })

      // GET /vouchers/portal/:id/claims — claim history for a voucher
      .get("/:id/claims", async ({ params, set }) => {
        const auth = await authenticate()

        if (!auth.user) {
          return toUnauthorized(set)
        }

        const actor = await resolveActor(auth, getPlatformRole)
        if (!isAdmin(actor)) {
          return toForbidden(set, "Only administrators can view claim history.")
        }

        const parsed = voucherIdParamSchema.safeParse(params)
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
          const claims = await service.getVoucherClaims(parsed.data.id)

          return {
            ok: true as const,
            data: claims.map((claim) => toVoucherClaimDTO(claim)),
          }
        } catch (error) {
          return toErrorResponse(set, error)
        }
      })
  )
}

export const portalVoucherRoutes = createPortalVoucherRoutes()
