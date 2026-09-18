import { Elysia } from "elysia"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@workos-inc/authkit-nextjs"

type RouteDeps = {
  authenticate?: () => Promise<{ user?: unknown }>
}

export const createDefaultClusterRoutes = (deps: RouteDeps = {}) =>
  new Elysia({ prefix: "/deploy/default-cluster" }).get(
    "/",
    async ({ set }) => {
      const auth = deps.authenticate
        ? await deps.authenticate()
        : await withAuth()
      if (!auth.user) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Unauthorized" }
      }

      try {
        const cluster = await prisma.appHostingCluster.findFirst({
          where: { status: "ACTIVE", isDefault: true },
          include: { endpoint: true },
        })

        const managedBaseDomain =
          cluster?.endpoint?.managedBaseDomain || "sg.pfnapp.dev"

        return {
          ok: true,
          data: {
            clusterId: cluster?.id || null,
            clusterName: cluster?.name || "Singapore Production",
            managedBaseDomain,
          },
        }
      } catch {
        return {
          ok: true,
          data: {
            clusterId: null,
            clusterName: "Singapore Production",
            managedBaseDomain: "sg.pfnapp.dev",
          },
        }
      }
    }
  )

export const defaultClusterRoutes = createDefaultClusterRoutes()
