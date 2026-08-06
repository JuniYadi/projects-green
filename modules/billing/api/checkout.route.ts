import { Elysia } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { z } from "zod"
import { Prisma } from "@prisma/client"

import {
  BillingOrderService,
  type BillingOrderResult,
} from "@/modules/billing/orders/order.service"
import { RecurringPriceResolutionError } from "@/modules/billing/pricing/pricing.service"
import {
  CheckoutQuoteError,
  CheckoutQuoteService,
  type CheckoutQuote,
} from "../checkout/quote.service"

const checkoutSchema = z.object({
  pricingId: z.string().min(1).max(128),
  quantity: z.number().int().min(1).max(9999).optional(),
  addonIds: z.array(z.string().min(1).max(128)).max(50).optional(),
  voucherCode: z.string().trim().min(1).max(128).optional(),
  quoteToken: z.string().min(1).max(512).optional(),
  mode: z.enum(["PURCHASE", "UPGRADE", "CHANGE_TERM"]).optional(),
  subscriptionId: z.string().min(1).max(128).optional(),
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
  discount: string
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
  quoteService?: Pick<CheckoutQuoteService, "createQuote">
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
const toQuoteError = (
  set: { status?: number | string },
  error: unknown
): CheckoutError => {
  if (error instanceof RecurringPriceResolutionError) {
    return toError(
      set,
      400,
      "PRICING_NOT_FOUND",
      "The selected pricing plan was not found or is not available."
    )
  }
  if (error instanceof CheckoutQuoteError) {
    const status =
      error.code === "VOUCHER_NOT_FOUND" || error.code === "PRICING_NOT_FOUND"
        ? 404
        : 422
    return toError(set, status, error.code, error.message)
  }
  console.error("[Checkout] quote error:", error)
  return toError(set, 500, "INTERNAL_ERROR", "Unable to create checkout quote.")
}

export const createBillingCheckoutRoutes = (
  deps: Partial<BillingCheckoutRouteDeps> = {}
) => {
  const { authenticate } = { ...defaultDeps, ...deps }
  const orderService = deps.orderService ?? new BillingOrderService()
  const quoteService = deps.quoteService ?? new CheckoutQuoteService()

  return (
    new Elysia()
      .post("/checkout/quote", async ({ set, body }) => {
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
        try {
          const now = new Date()
          const quote = await quoteService.createQuote({
            userId: auth.user.id,
            organizationId: auth.organizationId,
            pricingId: parsed.data.pricingId,
            quantity:
              parsed.data.quantity !== undefined
                ? new Prisma.Decimal(parsed.data.quantity)
                : undefined,
            addonIds: parsed.data.addonIds,
            voucherCode: parsed.data.voucherCode,
            idempotencyKey: parsed.data.idempotencyKey,
            mode: parsed.data.mode,
            subscriptionId: parsed.data.subscriptionId,
            now,
          })
          return { ok: true as const, ...quote }
        } catch (error) {
          return toQuoteError(set, error)
        }
      })
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

        const {
          pricingId,
          quantity,
          addonIds,
          voucherCode,
          quoteToken,
          mode,
          subscriptionId,
          idempotencyKey,
        } = parsed.data

        let quote: CheckoutQuote | null = null
        if (quoteToken || addonIds?.length || voucherCode) {
          try {
            const now = new Date()
            quote = await quoteService.createQuote({
              userId: auth.user.id,
              organizationId: auth.organizationId,
              pricingId,
              quantity:
                quantity !== undefined
                  ? new Prisma.Decimal(quantity)
                  : undefined,
              addonIds,
              voucherCode,
              idempotencyKey,
              mode,
              subscriptionId,
              now,
            })
          } catch (error) {
            return toQuoteError(set, error)
          }
        }

        // Step 1 — Create order (validates pricing, idempotent)
        let orderResult: BillingOrderResult
        try {
          orderResult = await orderService.createOrder({
            organizationId: auth.organizationId,
            pricingId,
            quantity:
              quantity !== undefined ? new Prisma.Decimal(quantity) : undefined,
            amount: quote ? new Prisma.Decimal(quote.subtotal) : undefined,
            discountAmount: quote
              ? new Prisma.Decimal(quote.discount)
              : undefined,
            periodStart: quote ? new Date(quote.periodStart) : undefined,
            periodEnd: quote ? new Date(quote.periodEnd) : undefined,
            voucherId: quote?.voucher?.id,
            voucherCode: quote?.voucher?.code,
            voucherCurrency: quote?.voucher?.discountCurrency,
            voucherExchangeRate: quote?.voucher?.exchangeRate
              ? new Prisma.Decimal(quote.voucher.exchangeRate)
              : undefined,
            metadata: quote
              ? {
                  checkoutQuote: quote,
                  addons: quote.addons,
                  voucher: quote.voucher,
                }
              : undefined,
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

        try {
          const fulfilledResult = await orderService.checkoutOrder(
            orderResult.orderId
          )
          const firstPayment = fulfilledResult.amount
          const periodStart = fulfilledResult.periodStart
          const periodEnd = fulfilledResult.periodEnd
          const nextRenewal = periodEnd

          const response: CheckoutSuccess = {
            ok: true,
            orderId: fulfilledResult.orderId,
            status: fulfilledResult.status as CheckoutSuccess["status"],
            subscriptionId: fulfilledResult.subscriptionId,
            invoiceId: fulfilledResult.invoiceId,
            invoiceLineId: fulfilledResult.invoiceLineId,
            subtotal: quote?.subtotal ?? fulfilledResult.amount,
            discount: quote?.discount ?? "0",
            firstPayment,
            nextRenewal: quote?.nextRenewal ?? nextRenewal,
            currency: fulfilledResult.currency,
            billingPeriod: fulfilledResult.billingPeriod,
            periodStart,
            periodEnd,
          }

          return response
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          if (
            msg.startsWith("FULFILLMENT_ADAPTER_NOT_FOUND") ||
            msg === "FULFILLMENT_NOT_IMPLEMENTED" ||
            msg.includes("does not have a fulfillment adapter") ||
            msg === "FULFILLMENT_NOT_CONFIGURED"
          ) {
            return toError(
              set,
              422,
              "FULFILLMENT_NOT_SUPPORTED",
              `The product for this pricing plan is not yet available for purchase. Fulfillment is not configured for this product type.`
            )
          }
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
          if (msg === "CHARGE_ERROR" || msg === "BILLING_ACCOUNT_NOT_FOUND") {
            return toError(
              set,
              500,
              "INTERNAL_ERROR",
              "Unable to charge order."
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
          console.error("[Checkout] checkoutOrder error:", err)
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
