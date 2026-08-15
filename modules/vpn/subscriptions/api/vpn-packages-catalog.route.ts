import type { Prisma } from "@prisma/client"
import { Elysia } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"

import { prisma } from "@/lib/prisma"
import { CurrencyService } from "@/modules/billing/currency.service"
import {
  publicPackageInclude,
  toVpnPublicPackageDTO,
  toVpnPublicPackageDetailDTO,
  type PackageConversion,
} from "../vpn-package-public.dto"

type PrismaLike = Pick<
  typeof prisma,
  "vpnPackage" | "billingAccount" | "servicePricing"
>
type CurrencyServiceLike = Pick<CurrencyService, "convert" | "getRate">

type AuthContext = {
  organizationId?: string | null
  user: { id: string } | null
}

type Deps = {
  db?: PrismaLike
  currency?: CurrencyServiceLike
  authenticate?: () => Promise<AuthContext>
}

/**
 * Public (no-auth) VPN package catalog with optional currency conversion.
 * When authenticated, packages show converted prices for the buyer's currency.
 */
export const createVpnPackageCatalogRoutes = (deps: Deps = {}) => {
  const db = deps.db ?? prisma
  const currency = deps.currency ?? new CurrencyService(prisma)
  const authenticate =
    deps.authenticate ?? (() => withAuth() as Promise<AuthContext>)

  async function resolveConversion(
    pkgCurrency: string,
    pkgPrice: Prisma.Decimal
  ): Promise<PackageConversion | undefined> {
    try {
      const auth = await authenticate()
      if (!auth.user || !auth.organizationId) return undefined

      const account = await db.billingAccount.findUnique({
        where: { organizationId: auth.organizationId },
      })
      if (!account || account.currency === pkgCurrency) return undefined

      const converted = await currency.convert(
        pkgPrice,
        pkgCurrency,
        account.currency
      )
      const fromRate = await currency.getRate(pkgCurrency)
      const toRate = await currency.getRate(account.currency)

      return {
        convertedPrice: converted,
        convertedCurrency: account.currency,
        exchangeRate: Number(toRate.div(fromRate)),
      }
    } catch {
      // Auth or conversion failure — return without conversion.
      return undefined
    }
  }

  async function mapPackage(
    pkg: Prisma.VpnPackageGetPayload<{ include: typeof publicPackageInclude }>
  ) {
    const at = new Date()
    const planId = pkg.servicePlan.id
    const pricings = await db.servicePricing.findMany({ where: { planId } })
    const packageWithPricing = {
      ...pkg,
      servicePlan: { ...pkg.servicePlan, pricings },
    }
    const conversions = new Map<string, PackageConversion>()
    await Promise.all(
      pricings.map(async (pricing) => {
        if (!pricing.periodPrice || !pricing.billingPeriod) return
        const conversion = await resolveConversion(
          pricing.currency,
          pricing.periodPrice
        )
        if (conversion) conversions.set(pricing.id, conversion)
      })
    )
    return toVpnPublicPackageDTO(packageWithPricing, conversions, at)
  }

  return new Elysia()
    .get("/vpn/packages", async () => {
      const packages = await db.vpnPackage.findMany({
        where: {
          isActive: true,
          servicePlan: { isActive: true },
        },
        include: publicPackageInclude,
        orderBy: { createdAt: "desc" },
      })

      const results = (await Promise.all(packages.map(mapPackage))).filter(
        (pkg) => pkg.offers.length > 0
      )

      return { ok: true as const, data: results }
    })
    .get("/vpn/packages/:id", async ({ params, set }) => {
      const pkg = await db.vpnPackage.findFirst({
        where: {
          id: params.id,
          isActive: true,
          servicePlan: { isActive: true },
        },
        include: publicPackageInclude,
      })
      if (!pkg) {
        set.status = 404
        return {
          ok: false as const,
          error: "PACKAGE_UNAVAILABLE" as const,
          message: "Package not found or unavailable.",
        }
      }
      const at = new Date()
      const planId = pkg.servicePlan.id
      const pricings = await db.servicePricing.findMany({ where: { planId } })
      const packageWithPricing = {
        ...pkg,
        servicePlan: { ...pkg.servicePlan, pricings },
      }
      const conversions = new Map<string, PackageConversion>()
      await Promise.all(
        pricings.map(async (pricing) => {
          if (!pricing.periodPrice || !pricing.billingPeriod) return
          const conversion = await resolveConversion(
            pricing.currency,
            pricing.periodPrice
          )
          if (conversion) conversions.set(pricing.id, conversion)
        })
      )
      const dto = toVpnPublicPackageDetailDTO(
        packageWithPricing,
        conversions,
        at
      )
      if (dto.offers.length === 0) {
        set.status = 404
        return {
          ok: false as const,
          error: "PACKAGE_UNAVAILABLE" as const,
          message: "Package not found or unavailable.",
        }
      }
      return {
        ok: true as const,
        data: dto,
      }
    })
}
