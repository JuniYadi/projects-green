import { Elysia } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"

import { GatewayService } from "../services/gateway.service"
import { getPlatformRoleForUser } from "@/lib/platform-role"

const gatewayService = new GatewayService()

export const createAdminGatewayRoutes = () =>
  new Elysia({ prefix: "/gateways" })
    .get("/", async () => {
      const auth = await withAuth()
      if (!auth.user || !auth.organizationId) {
        return { ok: false, error: "UNAUTHORIZED", message: "Authentication required" }
      }

      const platformRole = await getPlatformRoleForUser(auth.user)
      if (platformRole !== "super_admin") {
        return { ok: false, error: "FORBIDDEN", message: "Admin access required" }
      }

      const gateways = await gatewayService.list(true)
      return { ok: true, data: gateways }
    })
    .post("/", async ({ body }) => {
      const auth = await withAuth()
      if (!auth.user || !auth.organizationId) {
        return { ok: false, error: "UNAUTHORIZED", message: "Authentication required" }
      }

      const platformRole = await getPlatformRoleForUser(auth.user)
      if (platformRole !== "super_admin") {
        return { ok: false, error: "FORBIDDEN", message: "Admin access required" }
      }

      const { name, type, config, isDefault, supportedCurrencies } = body as {
        name: string
        type: string
        config: { merchantCode: string; apiKey: string; sandboxUrl: string; productionUrl: string }
        isDefault?: boolean
        supportedCurrencies?: string[]
      }

      const gateway = await gatewayService.create({ name, type, config, isDefault, supportedCurrencies })
      return { ok: true, data: gateway }
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

      const { name, config, isDefault, supportedCurrencies } = body as {
        name?: string
        config?: { merchantCode: string; apiKey: string; sandboxUrl: string; productionUrl: string }
        isDefault?: boolean
        supportedCurrencies?: string[]
      }

      const gateway = await gatewayService.update(params.id, { name, config, isDefault, supportedCurrencies })
      return { ok: true, data: gateway }
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

      const gateway = await gatewayService.toggle(params.id)
      return { ok: true, data: gateway }
    })
