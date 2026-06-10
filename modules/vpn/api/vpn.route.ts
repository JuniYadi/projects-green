import { Elysia, t } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"

import { BillingTransactionService } from "@/modules/billing/billing-transaction.service"
import { prisma } from "@/lib/prisma"
import { VpnClientService } from "../vpn-client.service"
import { VpnBillingService } from "../billing/vpn-billing.service"
import {
  OpenVpnSshAdapter,
  openVpnSshEnvFromProcessEnv,
} from "../openvpn/openvpn-ssh-adapter"
import {
  VpnPriceNotConfiguredError,
  resolveVpnMonthlyPrice,
} from "../billing/vpn-pricing"
import {
  VpnSubscriptionRefsNotFoundError,
  resolveVpnSubscriptionRefs,
} from "../billing/vpn-subscription-refs"

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
type OpenVpnLike = Pick<OpenVpnSshAdapter, "createClient" | "fetchConfig">
type VpnClientServiceLike = Pick<
  VpnClientService,
  "createActiveClient" | "createProvisioningFailure"
>

type VpnRouteDeps = {
  authenticate?: () => Promise<VpnAuthContext>
  billing?: VpnBillingLike
  openVpn?: OpenVpnLike
  vpnClients?: VpnClientServiceLike
}

const defaultAuthenticate = async (): Promise<VpnAuthContext> => withAuth()

const defaultBilling = (): VpnBillingLike =>
  new VpnBillingService(prisma, new BillingTransactionService(prisma))

const defaultOpenVpn = (): OpenVpnLike =>
  new OpenVpnSshAdapter({ env: openVpnSshEnvFromProcessEnv() })

const defaultVpnClients = (): VpnClientServiceLike => new VpnClientService(prisma)

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

const buildOpenVpnClientName = (
  organizationId: string,
  subscriptionId: string,
): string => {
  const safeOrgId = organizationId.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 24)
  const safeSubscriptionId = subscriptionId
    .replace(/[^A-Za-z0-9_-]/g, "_")
    .slice(0, 32)

  return `org_${safeOrgId}_${safeSubscriptionId}`
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
  const openVpn = deps.openVpn ?? defaultOpenVpn()
  const vpnClients = deps.vpnClients ?? defaultVpnClients()

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
        // We first fetch the billing account to resolve the price using
        // the account's locked currency (IDR/USD) per Issue 5.
        const account = await prisma.billingAccount.findUnique({
          where: { organizationId: auth.organizationId },
        })
        if (!account) {
          return toServerError(
            set,
            "No billing account found for this organization. Please contact support.",
          )
        }

        let price
        try {
          price = resolveVpnMonthlyPrice({
            regionCode: body.regionCode,
            planCode: body.planCode,
            currency: account.currency as "IDR" | "USD",
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

        // ── Resolve subscription FK refs (Package/ServicePlan/Pricing) ──
        // Done BEFORE the charge so a misconfigured (plan, region) returns
        // 422 without debiting the customer's balance.
        let refs
        try {
          refs = await resolveVpnSubscriptionRefs(prisma, {
            planCode: body.planCode,
            regionCode: body.regionCode,
          })
        } catch (error) {
          if (error instanceof VpnSubscriptionRefsNotFoundError) {
            set.status = 422
            return {
              ok: false as const,
              error: "VPN_PRICE_NOT_CONFIGURED" as const,
              message: error.message,
            }
          }
          throw error
        }

        // ── Billing gate: debit balance upfront ─────────────────────
        const period = currentPeriod()
        const now = new Date()
        const periodEnd = new Date(now)
        periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1)

        let vpnSubscriptionId: string | undefined
        let periodStart = now
        let isNewOrSuspended = false
        let vpnClientId: string | undefined

        try {
          // Find or create the Subscription record first so we can use
          // its stable DB id for the idempotency key. The route is the
          // sole owner of VPN subscription creation; the renewal worker
          // (Task 3) is the sole owner of period extension.
          //
          // Issue 6 Fix: we check for status !== "ACTIVE". If the subscription
          // is suspended, we reset it to "SUSPENDED" (pending activation)
          // and try charging again.
          const existing = await prisma.subscription.findUnique({
            where: {
              organizationId_packageId_planId: {
                organizationId: auth.organizationId,
                packageId: refs.packageId,
                planId: refs.planId,
              },
            },
          })

          if (existing && existing.status === "ACTIVE") {
            vpnSubscriptionId = existing.id
            periodStart = existing.currentPeriodStart
          } else if (existing && existing.status === "SUSPENDED") {
            await prisma.subscription.update({
              where: { id: existing.id },
              data: {
                status: "SUSPENDED", // Keep SUSPENDED (pending activation)
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
              },
            })
            vpnSubscriptionId = existing.id
            isNewOrSuspended = true
          } else {
            // Issue 1 Fix: Create with status: "SUSPENDED" to avoid
            // orphaned ACTIVE records on billing failure (402).
            const subscription = await prisma.subscription.create({
              data: {
                organizationId: auth.organizationId,
                packageId: refs.packageId,
                planId: refs.planId,
                pricingId: refs.pricingId,
                type: "BUNDLE",
                billingMode: "PACKAGE",
                status: "SUSPENDED",
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                metadata: {
                  regionCode: body.regionCode,
                  regionId: refs.regionId,
                  planCode: body.planCode,
                },
              },
            })
            vpnSubscriptionId = subscription.id
            isNewOrSuspended = true
          }

          await billing.chargeMonthly({
            organizationId: auth.organizationId,
            vpnSubscriptionId,
            regionCode: body.regionCode,
            amount: price.amount,
            period,
          })

          const clientName = buildOpenVpnClientName(
            auth.organizationId,
            vpnSubscriptionId,
          )

          try {
            await openVpn.createClient(clientName)
            const ovpnConfig = await openVpn.fetchConfig(clientName)
            const vpnClient = await vpnClients.createActiveClient({
              organizationId: auth.organizationId,
              subscriptionId: vpnSubscriptionId,
              clientName,
              currentPeriodStart: periodStart,
              currentPeriodEnd: periodEnd,
              createdBy: auth.user.id,
              ovpnConfig,
            })
            vpnClientId = vpnClient.id
          } catch (provisioningError) {
            await vpnClients.createProvisioningFailure({
              organizationId: auth.organizationId,
              subscriptionId: vpnSubscriptionId,
              clientName,
              currentPeriodStart: periodStart,
              currentPeriodEnd: periodEnd,
              createdBy: auth.user.id,
              reason:
                provisioningError instanceof Error
                  ? provisioningError.message
                  : "OpenVPN provisioning failed",
            })

            set.status = 502
            return {
              ok: false as const,
              error: "VPN_PROVISIONING_FAILED" as const,
              message:
                "VPN billing succeeded, but OpenVPN provisioning failed. Please contact support.",
            }
          }

          // Charge and provisioning succeeded -> activate subscription
          if (isNewOrSuspended && vpnSubscriptionId) {
            await prisma.subscription.update({
              where: { id: vpnSubscriptionId },
              data: { status: "ACTIVE" },
            })
          }
        } catch (error) {
          // Issue 1 Fix: Ensure the subscription is left as SUSPENDED if charge fails
          if (isNewOrSuspended && vpnSubscriptionId) {
            try {
              await prisma.subscription.update({
                where: { id: vpnSubscriptionId },
                data: {
                  status: "SUSPENDED",
                  metadata: {
                    regionCode: body.regionCode,
                    regionId: refs.regionId,
                    planCode: body.planCode,
                    suspendedAt: new Date().toISOString(),
                    suspensionReason: "INITIAL_CHARGE_FAILED",
                  },
                },
              })
            } catch (cleanupError) {
              console.error("[VpnRoute] Failed to suspend subscription after failed charge:", cleanupError)
            }
          }

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
        // Issue 8 Fix: format monthlyPrice to consistent decimal places and
        // provide monthlyPriceMinor.
        const formattedPrice = price.amount.toFixed(price.currency === "USD" ? 4 : 2)
        const priceMinor = price.currency === "USD"
          ? Math.round(Number(price.amount) * 100)
          : Math.round(Number(price.amount))

        return {
          ok: true as const,
          subscriptionId: vpnSubscriptionId,
          organizationId: auth.organizationId,
          regionCode: body.regionCode,
          planCode: body.planCode,
          status: "ACTIVE" as const,
          monthlyPrice: formattedPrice,
          monthlyPriceMinor: priceMinor,
          currency: price.currency,
          period,
          topupUrl: TOPUP_URL,
          vpnClientId,
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
