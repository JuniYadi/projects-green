import { Elysia } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { z } from "zod"
import { Prisma } from "@prisma/client"

import { BillingOrderService } from "@/modules/billing/orders/order.service"
import { RecurringPriceResolutionError } from "@/modules/billing/pricing/pricing.service"

const checkoutSchema = z.object({
  pricingId: z.string().min(1).max(128),
  quantity: z.number().int().min(1).max(9999).optional(),
  idempotencyKey: z.string().min(1).max(128),
})

type CheckoutSuccess = {
  ok: true
  orderId: string
  status: "CHARGED" | "FULFILLED" | "PENDING"
  subscriptionId: string | null
  invoiceId: string | null
  invoiceLineId: string | null
  subtotal: string
  discount: "0"
  firstPayment: string
  nextRenewal: string | null
  currency: string
  billingPeriod: string
  periodStart: string
  periodEnd: string
}

type CheckoutError = {
  ok: false
  error: string
  message: string
}

type BillingAuthContext = {
  organizationId?: string | null
  user: { id: string; email?: string | null } | null
}

type BillingCheckoutRouteDeps = {
  authenticate: () => Promise<BillingAuthContext>
  orderService?: BillingOrderService
}

const defaultDeps: BillingCheckoutRouteDeps = {
  authenticate: () => withAuth(),
}

const toError = (
  set: { status?: number | string },
  httpStatus: number,
  code: string,
  message: string
): CheckoutError => {
  set.status = httpStatus
  return { ok: false, error: code, message }
}

export const createBillingCheckoutRoutes = (
  deps: Partial<BillingCheckoutRouteDeps> = {}
) => {
  const { authenticate } = { ...defaultDeps, ...deps }
  const orderService = deps.orderService ?? new BillingOrderService()

  return (
    new Elysia()
      // ─── POST /billing/checkout ─────────────────────────────────────────
      .post("/checkout", async ({ set, body }) => {
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

        const parsed = checkoutSchema.safeParse(body)
        if (!parsed.success) {
          return toError(set, 400, "VALIDATION_ERROR", parsed.error.message)
        }

        const { pricingId, quantity, idempotencyKey } = parsed.data

        // Step 1 — Create order (validates pricing, idempotent)
        let orderResult: Awaited<ReturnType<BillingOrderService["createOrder"]>>
        try {
          orderResult = await orderService.createOrder({
            organizationId: auth.organizationId,
            pricingId,
            quantity:
              quantity !== undefined ? new Prisma.Decimal(quantity) : undefined,
            idempotencyKey,
          })
        } catch (err) {
          if (err instanceof RecurringPriceResolutionError) {
            return toError(
              set,
              400,
              "PRICING_NOT_FOUND",
              "The selected pricing plan was not found or is not available."
            )
          }
          const msg = err instanceof Error ? err.message : String(err)
          if (msg === "BILLING_ACCOUNT_NOT_FOUND") {
            return toError(
              set,
              400,
              "BILLING_ACCOUNT_NOT_FOUND",
              "No billing account found for this organization."
            )
          }
          console.error("[Checkout] createOrder error:", err)
          return toError(set, 500, "INTERNAL_ERROR", "Unable to create order.")
        }

        // Step 2 — Charge (balance check happens here)
        let chargedResult: typeof orderResult
        try {
          chargedResult = await orderService.chargeOrder(orderResult.orderId)
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          if (msg === "INSUFFICIENT_BALANCE") {
            return toError(
              set,
              422,
              "INSUFFICIENT_BALANCE",
              "Insufficient balance. Please top up your account and try again."
            )
          }
          if (msg === "CURRENCY_MISMATCH") {
            return toError(
              set,
              422,
              "CURRENCY_MISMATCH",
              "Currency mismatch between account and order."
            )
          }
          if (msg === "ORDER_NOT_CHARGEABLE") {
            return toError(
              set,
              409,
              "ORDER_NOT_CHARGEABLE",
              "Order is not in a chargeable state."
            )
          }
          console.error("[Checkout] chargeOrder error:", err)
          return toError(set, 500, "INTERNAL_ERROR", "Unable to charge order.")
        }

        // Step 3 — Fulfill (may throw for unsupported package codes)
        try {
          const fulfilledResult = await orderService.fulfillOrder(
            chargedResult.orderId
          )

          const firstPayment = fulfilledResult.amount
          const periodStart = fulfilledResult.periodStart
          const periodEnd = fulfilledResult.periodEnd

          // Calculate next renewal: periodEnd for first payment
          const nextRenewal = periodEnd

          const response: CheckoutSuccess = {
            ok: true,
            orderId: fulfilledResult.orderId,
            status: fulfilledResult.status as CheckoutSuccess["status"],
            subscriptionId: fulfilledResult.subscriptionId,
            invoiceId: fulfilledResult.invoiceId,
            invoiceLineId: fulfilledResult.invoiceLineId,
            subtotal: fulfilledResult.amount,
            discount: "0",
            firstPayment,
            nextRenewal,
            currency: fulfilledResult.currency,
            billingPeriod: fulfilledResult.billingPeriod,
            periodStart,
            periodEnd,
          }

          return response
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)

          // Detect unsupported fulfillment packages
          if (
            msg.startsWith("FULFILLMENT_ADAPTER_NOT_FOUND") ||
            msg === "FULFILLMENT_NOT_IMPLEMENTED" ||
            msg.includes("does not have a fulfillment adapter")
          ) {
            // Reject precisely — charge was made but we cannot fulfill.
            // We do not throw a 500 because this is a known product gap.
            return toError(
              set,
              422,
              "FULFILLMENT_NOT_SUPPORTED",
              `The product for this pricing plan is not yet available for purchase. Fulfillment is not configured for this product type.`
            )
          }

          if (msg === "ADVISORY_LOCK_UNAVAILABLE") {
            return toError(
              set,
              503,
              "SERVICE_UNAVAILABLE",
              "Unable to acquire a lock. Please try again."
            )
          }

          // Catch-all for other fulfillment errors — still return a useful
          // error rather than a generic 500.
          console.error("[Checkout] fulfillOrder error:", err)
          return toError(
            set,
            500,
            "FULFILLMENT_ERROR",
            `Fulfillment failed: ${msg}`
          )
        }
      })
  )
}

export const billingCheckoutRoutes = createBillingCheckoutRoutes()
