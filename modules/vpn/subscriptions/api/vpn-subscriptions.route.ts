import { Elysia, t } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"

import { prisma } from "@/lib/prisma"
import { BillingTransactionService } from "@/modules/billing/billing-transaction.service"
import { VpnProvisioningJob } from "@/lib/queue/vpn-provisioning"
import {
  decryptVpnConfig,
  decryptProxyPassword,
} from "@/modules/vpn/vpn-crypto"

import {
  VpnBillingAccountNotFoundError,
  VpnDuplicateSubscriptionError,
  VpnInsufficientBalanceError,
  VpnPackageUnavailableError,
  VpnSubscriptionNotFoundError,
  VpnSubscriptionService,
} from "../vpn-subscription.service"
import { toVpnSubscriptionDTO } from "../vpn-subscription.dto"

type AuthContext = {
  organizationId?: string | null
  user: { id: string } | null
}

type RouteSet = { status?: number | string }

type Deps = {
  authenticate?: () => Promise<AuthContext>
  service?: VpnSubscriptionService
}

const TOPUP_URL = "/console/billing/topup"

const defaultService = () =>
  new VpnSubscriptionService(prisma, {
    transactions: new BillingTransactionService(prisma),
    dispatch: (serverAccountId) => VpnProvisioningJob.dispatch(serverAccountId),
  })

const unauthorized = (set: RouteSet) => {
  set.status = 401
  return {
    ok: false as const,
    error: "UNAUTHORIZED" as const,
    message: "You must be signed in to manage VPN subscriptions.",
  }
}

const forbidden = (set: RouteSet) => {
  set.status = 403
  return {
    ok: false as const,
    error: "FORBIDDEN" as const,
    message: "No active organization found for VPN subscriptions.",
  }
}

const notFound = (set: RouteSet) => {
  set.status = 404
  return {
    ok: false as const,
    error: "NOT_FOUND" as const,
    message: "Subscription not found.",
  }
}

async function resolvePackageNames(packageIds: string[]) {
  const ids = [...new Set(packageIds)]
  if (ids.length === 0) return new Map<string, string>()

  const packages = await prisma.vpnPackage.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
  })

  return new Map(packages.map((pkg) => [pkg.id, pkg.name]))
}

export const createVpnSubscriptionRoutes = (deps: Deps = {}) => {
  const authenticate = deps.authenticate ?? (() => withAuth())
  const service = deps.service ?? defaultService()

  const resolveOrg = async (set: RouteSet) => {
    const auth = await authenticate()
    if (!auth.user) return { error: unauthorized(set) }
    if (!auth.organizationId) return { error: forbidden(set) }
    return { organizationId: auth.organizationId, userId: auth.user.id }
  }

  return new Elysia()
    .get("/vpn/subscriptions", async ({ set }) => {
      const ctx = await resolveOrg(set)
      if ("error" in ctx) return ctx.error
      const subs = await service.listForOrganization(ctx.organizationId)
      const packageNames = await resolvePackageNames(
        subs.map((sub) => sub.packageId)
      )
      return {
        ok: true as const,
        data: subs.map((sub) =>
          toVpnSubscriptionDTO(
            sub,
            null,
            packageNames.get(sub.packageId) ?? null
          )
        ),
      }
    })
    .get("/vpn/subscriptions/:id", async ({ params, set }) => {
      const ctx = await resolveOrg(set)
      if ("error" in ctx) return ctx.error
      const sub = await service.getForOrganization(
        ctx.organizationId,
        params.id
      )
      if (!sub) return notFound(set)
      const packageNames = await resolvePackageNames([sub.packageId])
      return {
        ok: true as const,
        data: toVpnSubscriptionDTO(
          sub,
          null,
          packageNames.get(sub.packageId) ?? null
        ),
      }
    })
    .get(
      "/vpn/subscriptions/:id/servers/:saId/config",
      async ({ params, set }) => {
        const ctx = await resolveOrg(set)
        if ("error" in ctx) return ctx.error
        const sub = await service.getForOrganization(
          ctx.organizationId,
          params.id
        )
        if (!sub) return notFound(set)
        const account = sub.serverAccounts.find((a) => a.id === params.saId)
        if (!account || !account.configEncrypted) return notFound(set)
        if (account.protocol === "PROXY") {
          set.status = 400
          return {
            ok: false as const,
            error: "NO_CONFIG" as const,
            message: "Proxy accounts expose credentials, not a config file.",
          }
        }
        const ext = account.protocol === "WIREGUARD" ? "conf" : "ovpn"
        return new Response(decryptVpnConfig(account.configEncrypted), {
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "content-disposition": `attachment; filename="${account.username}.${ext}"`,
          },
        })
      }
    )
    .get(
      "/vpn/subscriptions/:id/servers/:saId/credentials",
      async ({ params, set }) => {
        const ctx = await resolveOrg(set)
        if ("error" in ctx) return ctx.error
        const sub = await service.getForOrganization(
          ctx.organizationId,
          params.id
        )
        if (!sub) return notFound(set)
        const account = sub.serverAccounts.find((a) => a.id === params.saId)
        if (!account || account.protocol !== "PROXY") return notFound(set)
        return {
          ok: true as const,
          data: {
            username: account.username,
            // Proxy password is encrypted (reversible) at rest so the
            // customer can view it on demand (Story 17).
            password: account.password
              ? decryptProxyPassword(account.password)
              : null,
          },
        }
      }
    )
    .post(
      "/vpn/packages/:id/purchase",
      async ({ params, set }) => {
        const ctx = await resolveOrg(set)
        if ("error" in ctx) return ctx.error
        try {
          const sub = await service.purchase({
            organizationId: ctx.organizationId,
            packageId: params.id,
          })
          set.status = 201
          const packageNames = await resolvePackageNames([sub.packageId])
          return {
            ok: true as const,
            data: toVpnSubscriptionDTO(
              sub,
              null,
              packageNames.get(sub.packageId) ?? null
            ),
          }
        } catch (error) {
          return toPurchaseError(set, error)
        }
      },
      { body: t.Optional(t.Object({})) }
    )
    .get("/vpn/subscriptions/:id/billing", async ({ params, set }) => {
      const ctx = await resolveOrg(set)
      if ("error" in ctx) return ctx.error
      try {
        const info = await service.getBillingInfo(ctx.organizationId, params.id)
        return {
          ok: true as const,
          data: {
            id: info.id,
            status: info.status,
            price: info.priceLocked.toString(),
            currency: info.currency,
            originalPrice: info.originalPrice?.toString() ?? null,
            originalCurrency: info.originalCurrency ?? null,
            exchangeRate: info.exchangeRate ? Number(info.exchangeRate) : null,
            currentPeriodStart: info.currentPeriodStart.toISOString(),
            currentPeriodEnd: info.currentPeriodEnd.toISOString(),
            cancelAtPeriodEnd: info.cancelAtPeriodEnd,
            renewalFailedAt: info.renewalFailedAt
              ? info.renewalFailedAt.toISOString()
              : null,
          },
        }
      } catch (error) {
        if (error instanceof VpnSubscriptionNotFoundError) return notFound(set)
        console.error(
          "[VPN SUBSCRIPTION] billing info error:",
          error instanceof Error
            ? (error.stack ?? error.message)
            : String(error)
        )
        set.status = 500
        return {
          ok: false as const,
          error: "INTERNAL_ERROR" as const,
          message: "Something went wrong while loading billing info.",
        }
      }
    })
    .post(
      "/vpn/subscriptions/:id/cancel",
      async ({ params, set }) => {
        const ctx = await resolveOrg(set)
        if ("error" in ctx) return ctx.error
        try {
          const sub = await service.cancelAtPeriodEnd(
            ctx.organizationId,
            params.id
          )
          const packageNames = await resolvePackageNames([sub.packageId])
          return {
            ok: true as const,
            data: toVpnSubscriptionDTO(
              sub,
              null,
              packageNames.get(sub.packageId) ?? null
            ),
          }
        } catch (error) {
          if (error instanceof VpnSubscriptionNotFoundError)
            return notFound(set)
          console.error(
            "[VPN SUBSCRIPTION] cancel error:",
            error instanceof Error
              ? (error.stack ?? error.message)
              : String(error)
          )
          set.status = 500
          return {
            ok: false as const,
            error: "INTERNAL_ERROR" as const,
            message: "Something went wrong while cancelling the subscription.",
          }
        }
      },
      { body: t.Optional(t.Object({})) }
    )
}

function toPurchaseError(set: RouteSet, error: unknown) {
  if (error instanceof VpnPackageUnavailableError) {
    set.status = 404
    return {
      ok: false as const,
      error: "PACKAGE_UNAVAILABLE" as const,
      message: error.message,
    }
  }
  if (error instanceof VpnDuplicateSubscriptionError) {
    set.status = 409
    return {
      ok: false as const,
      error: "DUPLICATE_SUBSCRIPTION" as const,
      message: error.message,
    }
  }
  if (error instanceof VpnInsufficientBalanceError) {
    set.status = 402
    return {
      ok: false as const,
      error: "INSUFFICIENT_BALANCE" as const,
      message: error.message,
      topupUrl: TOPUP_URL,
    }
  }
  if (error instanceof VpnBillingAccountNotFoundError) {
    set.status = 402
    return {
      ok: false as const,
      error: "BILLING_ACCOUNT_REQUIRED" as const,
      message: error.message,
    }
  }
  console.error(
    "[VPN PURCHASE] unexpected error:",
    error instanceof Error ? (error.stack ?? error.message) : String(error)
  )
  set.status = 500
  return {
    ok: false as const,
    error: "INTERNAL_ERROR" as const,
    message: "Something went wrong while processing the purchase.",
  }
}
