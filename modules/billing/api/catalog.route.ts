import { Elysia } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"

import { prisma } from "@/lib/prisma"
import { CatalogService } from "../catalog/catalog.service"
import type {
  CatalogListResponse,
  CatalogProductDetailResponse,
} from "../catalog/catalog.dto"

type CatalogAuthContext = {
  organizationId?: string | null
  user: { id: string; email?: string | null } | null
}

type CatalogRouteDeps = {
  authenticate: () => Promise<CatalogAuthContext>
  catalogService: {
    getCatalog(currency: string): Promise<CatalogListResponse>
    getProduct(
      currency: string,
      code: string
    ): Promise<CatalogProductDetailResponse | null>
  }
}

const defaultDeps: CatalogRouteDeps = {
  authenticate: () => withAuth(),
  catalogService: new CatalogService(),
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

export const createCatalogRoutes = (deps: Partial<CatalogRouteDeps> = {}) => {
  const { authenticate, catalogService } = {
    ...defaultDeps,
    ...deps,
  }

  return (
    new Elysia({ prefix: "/catalog" })
      // ─── GET /billing/catalog ────────────────────────────
      .get("/", async ({ set }) => {
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
            select: { currency: true },
          })

          if (!account) {
            return toError(
              set,
              403,
              "NO_BILLING_ACCOUNT",
              "No billing account found for this organization."
            )
          }

          return {
            ok: true as const,
            ...(await catalogService.getCatalog(account.currency)),
          }
        } catch (err) {
          console.error("[Catalog] GET /billing/catalog error:", err)
          return toError(set, 500, "INTERNAL_ERROR", "Unable to load catalog.")
        }
      })

      // ─── GET /billing/catalog/:code ──────────────────────
      .get("/:code", async ({ set, params }) => {
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
            select: { currency: true },
          })

          if (!account) {
            return toError(
              set,
              403,
              "NO_BILLING_ACCOUNT",
              "No billing account found for this organization."
            )
          }

          const result = await catalogService.getProduct(
            account.currency,
            params.code as string
          )

          if (!result) {
            return toError(
              set,
              404,
              "PRODUCT_NOT_FOUND",
              `No catalog product found for code "${params.code}" in ${account.currency}.`
            )
          }

          return { ok: true as const, ...result }
        } catch (err) {
          console.error("[Catalog] GET /billing/catalog/:code error:", err)
          return toError(
            set,
            500,
            "INTERNAL_ERROR",
            "Unable to load catalog product."
          )
        }
      })
  )
}
