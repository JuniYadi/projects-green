import { Elysia, t } from "elysia"
import { randomUUID } from "crypto"

import { BillingTransactionService } from "@/modules/billing/billing-transaction.service"
import { prisma } from "@/lib/prisma"
import { VpnBillingService } from "../billing/vpn-billing.service"
import {
  VpnPriceNotConfiguredError,
  resolveVpnMonthlyPrice,
} from "../billing/vpn-pricing"

// ─── Types ──────────────────────────────────────────────────────────────

type VpnAuthContext = {
  organizationId?: string | null
  role?: string | null
  roles?: string[] | null
  user: { id: string; email?: string | null } | null
}

type RouteSet = {
  status?: number | string
}

type VpnBillingLike = Pick<VpnBillingService, "chargeMonthly">

type VpnRouteDeps = {
  authenticate?: () => Promise<VpnAuthContext>
  billing?: VpnBillingLike
}

const defaultAuthenticate = async (): Promise<VpnAuthContext> => {
  // Default: no auth — tests inject a real auth context.
  return { user: null, organizationId: null }
}

const defaultBilling = (): VpnBillingLike =>
  new VpnBillingService(prisma, new BillingTransactionService(prisma))

const TOPUP_URL = "/console/billing/topup"

const toUnauthorized = (set: RouteSet) => {
  set.status = 401
  return {
    ok: false as const,
    error: "UNAUTHORIZED" as const,
    message: "You must be signed in to provision a VPN subscription.",
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

const currentPeriod = (now: Date = new Date()): string => {
  const year = now.getUTCFullYear()
  const month = String(now.getUTCMonth() + 1).padStart(2, "0")
  return `${year}-${month}`
}

// ─── Routes factory ─────────────────────────────────────────────────────

/**
 * VPN monthly billing-gated subscription route.
 *
 * MVP behavior:
 *   - Resolves the monthly price from the static catalog.
 *   - Charges the customer's balance upfront via `VpnBillingService`.
 *   - On success, returns a subscription DTO with status `ACTIVE`.
 *   - On `INSUFFICIENT_BALANCE`, returns 402 with the top-up URL.
 *   - The route does NOT persist a `Subscription` record and does NOT
 *     call any VPN provider — that is the renewal worker's job and a
 *     future provisioning task, respectively.
 *
 * DI: callers (lib/api.ts) use the default factory; tests inject
 * their own `authenticate` and `billing` mocks so they do not need to
 * mock `@/lib/prisma` or sibling services.
 */
export const createVpnRoutes = (deps: Partial<VpnRouteDeps> = {}) => {
  const authenticate = deps.authenticate ?? defaultAuthenticate
  // Construct the default billing lazily so importing this module
  // does not require a live DATABASE_URL. lib/api.ts and the
  // production singleton below run after the env is loaded.
  const billing = deps.billing ?? defaultBilling()

  return new Elysia()
    .post(
      "/subscriptions",
      async ({ body, set }) => {
        const auth = await authenticate()

        if (!auth.user) {
          return toUnauthorized(set)
        }
        if (!auth.organizationId) {
          return toForbidden(
            set,
            "No active organization found for VPN provisioning.",
          )
        }

        // ── Resolve price from the static catalog ───────────────────
        let price
        try {
          price = resolveVpnMonthlyPrice({
            regionCode: body.regionCode,
            planCode: body.planCode,
          })
        } catch (error) {
          if (error instanceof VpnPriceNotConfiguredError) {
            set.status = 422
            return {
              ok: false as const,
              error: "VPN_PRICE_NOT_CONFIGURED" as const,
              message: `No VPN price configured for region=${body.regionCode} plan=${body.planCode}.`,
            }
          }
          throw error
        }

        // ── Billing gate: debit balance upfront ─────────────────────
        const vpnSubscriptionId = `vpn_sub_${randomUUID()}`
        const period = currentPeriod()

        try {
          await billing.chargeMonthly({
            organizationId: auth.organizationId,
            vpnSubscriptionId,
            regionCode: body.regionCode,
            amount: price.amount,
            period,
          })
        } catch (error) {
          if (
            error instanceof Error &&
            error.message === "INSUFFICIENT_BALANCE"
          ) {
            set.status = 402
            return {
              ok: false as const,
              error: "INSUFFICIENT_BALANCE" as const,
              message:
                "Your balance does not cover the VPN monthly fee. Please top up and try again.",
              topupUrl: TOPUP_URL,
            }
          }
          if (
            error instanceof Error &&
            error.message === "BILLING_ACCOUNT_NOT_FOUND"
          ) {
            return toServerError(
              set,
              "No billing account for this organization. Please contact support.",
            )
          }
          throw error
        }

        // ── Success: return subscription DTO ────────────────────────
        return {
          ok: true as const,
          subscriptionId: vpnSubscriptionId,
          organizationId: auth.organizationId,
          regionCode: body.regionCode,
          planCode: body.planCode,
          status: "ACTIVE" as const,
          monthlyPrice: price.amount.toString(),
          currency: price.currency,
          period,
          topupUrl: TOPUP_URL,
        }
      },
      {
        body: t.Object({
          regionCode: t.String({ minLength: 1 }),
          planCode: t.String({ minLength: 1 }),
        }),
      },
    )
}

// Default singleton — lib/api.ts mounts this. Tests build their own
// factory instance via `createVpnRoutes(deps)`.
export const vpnRoutes = createVpnRoutes()
