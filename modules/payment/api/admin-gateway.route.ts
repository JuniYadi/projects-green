import { Elysia } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"

import { GatewayService } from "../services/gateway.service"
import { getPlatformRoleForUser } from "@/lib/platform-role"
import { listProviders } from "../providers"

const gatewayService = new GatewayService()

const requireGatewayAuth = async (set: { status?: number | string }) => {
  const auth = await withAuth()
  if (!auth.user || !auth.organizationId) {
    set.status = 401
    return {
      ok: false as const,
      error: "UNAUTHORIZED" as const,
      message: "Authentication required",
    }
  }
  const platformRole = await getPlatformRoleForUser(auth.user)
  if (platformRole !== "super_admin") {
    set.status = 403
    return {
      ok: false as const,
      error: "FORBIDDEN" as const,
      message: "Admin access required",
    }
  }
  return null
}

export const createAdminGatewayRoutes = () =>
  new Elysia({ prefix: "/gateways" })
    .get("/", async ({ set }) => {
      const err = await requireGatewayAuth(set)
      if (err) return err

      return gatewayService.list(true)
    })
    .post("/", async ({ body, set }) => {
      const err = await requireGatewayAuth(set)
      if (err) return err

      const { name, type, config, isDefault, supportedCurrencies } = body as {
        name: string
        type: string
        config: {
          merchantCode: string
          apiKey: string
          sandboxUrl: string
          productionUrl: string
        }
        isDefault?: boolean
        supportedCurrencies?: string[]
      }

      return gatewayService.create({
        name,
        type,
        config,
        isDefault,
        supportedCurrencies,
      })
    })
    .put("/:id", async ({ body, params, set }) => {
      const err = await requireGatewayAuth(set)
      if (err) return err

      const { name, config, isDefault, supportedCurrencies } = body as {
        name?: string
        config?: {
          merchantCode: string
          apiKey: string
          sandboxUrl: string
          productionUrl: string
        }
        isDefault?: boolean
        supportedCurrencies?: string[]
      }

      return gatewayService.update(params.id, {
        name,
        config,
        isDefault,
        supportedCurrencies,
      })
    })
    .get("/providers", async ({ set }) => {
      const err = await requireGatewayAuth(set)
      if (err) return err

      const providers = listProviders()

      return providers.map((p) => ({
        value: p.id,
        label: p.name,
        supportedCurrencies: p.supportedCurrencies,
        configFields: p.configFields.map((f) => ({
          key: f.key,
          type: f.type,
          label: f.label,
          placeholder: f.placeholder,
          required: f.required,
          defaultValue: f.defaultValue,
          options: f.options,
        })),
      }))
    })
    .patch("/:id/toggle", async ({ params, set }) => {
      const err = await requireGatewayAuth(set)
      if (err) return err

      return gatewayService.toggle(params.id)
    })
