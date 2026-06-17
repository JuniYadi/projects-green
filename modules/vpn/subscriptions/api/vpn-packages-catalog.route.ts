import { Elysia } from "elysia"

import { prisma } from "@/lib/prisma"
import {
  publicPackageInclude,
  toVpnPublicPackageDTO,
  toVpnPublicPackageDetailDTO,
} from "../vpn-package-public.dto"



type PrismaLike = Pick<typeof prisma, "vpnPackage">

type Deps = { db?: PrismaLike }

/**
 * Public (no-auth) VPN package catalog. Listing and detail are read-only and
 * safe to expose since they never include SSH key material (see public DTO).
 */
export const createVpnPackageCatalogRoutes = (deps: Deps = {}) => {
  const db = deps.db ?? prisma

  return new Elysia()
    .get("/vpn/packages", async () => {
      const packages = await db.vpnPackage.findMany({
        where: { isActive: true },
        include: publicPackageInclude,
        orderBy: { price: "asc" },
      })
      return { ok: true as const, data: packages.map(toVpnPublicPackageDTO) }
    })
    .get("/vpn/packages/:id", async ({ params, set }) => {
      const pkg = await db.vpnPackage.findFirst({
        where: { id: params.id, isActive: true },
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
      return { ok: true as const, data: toVpnPublicPackageDetailDTO(pkg) }
    })
}
