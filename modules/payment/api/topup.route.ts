import { Elysia } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"

import { prisma } from "@/lib/prisma"
import { PaymentService } from "../services/payment.service"
import { BankAccountService } from "../services/bank-account.service"
import { DuitkuService } from "../services/duitku.service"
import { GatewayService } from "../services/gateway.service"
import { CreateTopupSchema } from "../types/payment.types"
import { PAYMENT_CONSTANTS } from "../constants"
import { paypalProvider } from "../providers/paypal.provider"
import { CurrencyService } from "@/modules/billing/currency.service"

const paymentService = new PaymentService()
const bankAccountService = new BankAccountService()
const duitkuService = new DuitkuService()
const gatewayService = new GatewayService()
const currencyService = new CurrencyService()

// Topup quick-pick presets are authored in the base currency (USD) and
// converted to the account currency at request time so a USD user sees clean
// USD buttons and an IDR user sees the converted IDR equivalents.
const BASE_TOPUP_PRESETS = [10, 25, 50, 100, 250]

function roundPreset(value: number, currencyCode: string): number {
  // Whole-unit currencies (IDR) round to the nearest 1,000; sub-unit
  // currencies (USD) keep two decimals.
  if (currencyCode === "USD") {
    return Math.round(value * 100) / 100
  }
  return Math.round(value / 1000) * 1000
}

export const createTopupRoutes = () =>
  new Elysia({ prefix: "/topup" })
    .post("/", async ({ body, set }) => {
      const auth = await withAuth()
      if (!auth.organizationId) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Organization required" }
      }

      const parseResult = CreateTopupSchema.safeParse(body)
      if (!parseResult.success) {
        set.status = 400
        return {
          ok: false,
          error: "VALIDATION_ERROR",
          message: "Invalid input",
          fieldErrors: parseResult.error.flatten().fieldErrors,
        }
      }

      const { amount, paymentMethod } = parseResult.data

      try {
        let gatewayId: string | undefined
        const billingAccount = await prisma.billingAccount.findUnique({
          where: { organizationId: auth.organizationId },
          select: { currency: true },
        })
        const currency = billingAccount?.currency ?? "IDR"

        if (paymentMethod === "VA" || paymentMethod === "QRIS") {
          // VA/QRIS run through a payment gateway. Only offer a gateway that
          // declares support for the account currency (covers BOTH and
          // ONLY-ONE). This replaces the old hardcoded "Duitku = IDR only"
          // branch with the gateway's own supportedCurrencies list.
          const gateway = await gatewayService.findByTypeForCurrency("GATEWAY", currency)
          if (!gateway) {
            set.status = 400
            return {
              ok: false,
              error: "GATEWAY_NOT_AVAILABLE",
              message: `No payment gateway available for ${currency}. Please use manual bank transfer.`,
            }
          }
          gatewayId = gateway.id
        }

        if (paymentMethod === "PAYPAL") {
          const gateway = await gatewayService.findByTypeForCurrency("PAYPAL", currency)
          if (!gateway) {
            set.status = 400
            return {
              ok: false,
              error: "PAYPAL_NOT_AVAILABLE",
              message: `PayPal is not available for ${currency}. Please choose another payment method.`,
            }
          }
          gatewayId = gateway.id
        }

        const invoice = await paymentService.createTopupInvoice({
          organizationId: auth.organizationId,
          amount,
          paymentMethod,
          gatewayId,
        })

        if (paymentMethod === "VA" || paymentMethod === "QRIS") {
          const duitkuMethod = paymentMethod === "VA" ? "VC" : "QR"

          const duitkuResult = await duitkuService.createPayment({
            invoiceId: invoice.id,
            amount,
            email: `${auth.organizationId}@payment.local`,
            customerName: `Org ${auth.organizationId}`,
            productDetails: `Top Up Balance - ${invoice.invoiceNumber}`.trim(),
            paymentMethod: duitkuMethod,
          })

          await prisma.$transaction([
            prisma.invoice.update({
              where: { id: invoice.id },
              data: {
                metadata: {
                  paymentUrl: duitkuResult.paymentUrl,
                  vaNumber: duitkuResult.vaNumber,
                  duitkuReference: duitkuResult.reference,
                },
              },
            }),
          ])

          return {
            ok: true,
            invoice: {
              id: invoice.id,
              amount: invoice.totalAmount?.toNumber() || amount,
              status: invoice.status,
              paymentMethod: invoice.paymentMethod,
              gateway: "duitku",
              dueDate: invoice.dueDate?.toISOString(),
              type: invoice.type,
            },
            paymentUrl: duitkuResult.paymentUrl,
          }
        }

        if (paymentMethod === "PAYPAL") {
          if (!gatewayId) {
            throw new Error("PayPal gateway not configured")
          }

          const config = await gatewayService.getDecryptedConfig(gatewayId)
          if (!config) {
            throw new Error("PayPal gateway not configured")
          }

          const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""
          const paypalResult = await paypalProvider.createPayment(
            {
              invoiceId: invoice.id,
              amount,
              currency,
              email: `${auth.organizationId}@payment.local`,
              customerName: `Org ${auth.organizationId}`,
              productDetails: `Top Up Balance - ${invoice.invoiceNumber}`.trim(),
              paymentMethod: "paypal",
              callbackUrl: `${appUrl}/api/webhooks/paypal/callback`,
              returnUrl: `${appUrl}/console/billing/invoices/${invoice.id}`,
            },
            config as unknown as Record<string, string>
          )

          await prisma.invoice.update({
            where: { id: invoice.id },
            data: {
              metadata: {
                paypalReference: paypalResult.reference,
              },
            },
          })

          return {
            ok: true,
            invoice: {
              id: invoice.id,
              amount: invoice.totalAmount?.toNumber() || amount,
              status: invoice.status,
              paymentMethod: invoice.paymentMethod,
              gateway: "paypal",
              dueDate: invoice.dueDate?.toISOString(),
              type: invoice.type,
            },
            paymentUrl: paypalResult.redirectUrl,
          }
        }

        return {
          ok: true,
          invoice: {
            id: invoice.id,
            amount: invoice.totalAmount?.toNumber() || amount,
            status: invoice.status,
            paymentMethod: invoice.paymentMethod,
            dueDate: invoice.dueDate?.toISOString(),
            type: invoice.type,
          },
        }
      } catch (error) {
        const isClientError =
          error instanceof Error &&
          (error.message.includes("not configured") ||
            error.message.includes("not found") ||
            error.message.includes("Minimum") ||
            error.message.includes("Maximum"))

        console.error(
          `[payment] POST /topup —`,
          error instanceof Error ? error.stack ?? error.message : error
        )

        set.status = isClientError ? 400 : 500
        return {
          ok: false,
          error: isClientError ? "CLIENT_ERROR" : "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "An unexpected error occurred",
        }
      }
    })

    .get("/invoice/:id", async ({ params, set }) => {
      const auth = await withAuth()
      if (!auth.organizationId) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Organization required" }
      }

      const invoice = await paymentService.getInvoiceForUser(params.id, auth.organizationId)

      if (!invoice) {
        return { ok: false, error: "NOT_FOUND", message: "Invoice not found" }
      }

      return { ok: true, invoice }
    })

    .get("/bank-accounts", async ({ set }) => {
      const auth = await withAuth()
      if (!auth.organizationId) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Organization required" }
      }

      const accounts = await bankAccountService.getActiveAccounts()
      return { ok: true, data: accounts }
    })

    .get("/methods", async ({ set }) => {
      const auth = await withAuth()
      if (!auth.organizationId) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Organization required" }
      }

      const billingAccount = await prisma.billingAccount.findUnique({
        where: { organizationId: auth.organizationId },
        select: { currency: true },
      })

      const currency = billingAccount?.currency ?? "IDR"

      const [accounts, gateway, paypalGateway, currencyRow, baseCurrency] = await Promise.all([
        bankAccountService.getActiveAccounts(currency),
        gatewayService.findByTypeForCurrency("GATEWAY", currency),
        gatewayService.findByTypeForCurrency("PAYPAL", currency),
        currencyService.findByCode(currency),
        currencyService.getBase().catch(() => null),
      ])

      const manualEnabled = accounts.length > 0
      // VA/QRIS require a gateway that supports this currency.
      const gatewayEnabled = Boolean(gateway)
      const paypalEnabled = Boolean(paypalGateway)

      // Derive quick-pick presets from base-currency anchors converted into the
      // account currency, so amounts stay meaningful regardless of currency.
      const rate = currencyRow?.ratePerBase?.toNumber() ?? (currency === "IDR" ? 18000 : 1)
      const presets = BASE_TOPUP_PRESETS.map((base) => roundPreset(base * rate, currency))

      const minTopup = currencyRow?.minTopup?.toNumber() ?? PAYMENT_CONSTANTS.MIN_TOPUP_AMOUNT
      const maxTopup = currencyRow?.maxTopup?.toNumber() ?? PAYMENT_CONSTANTS.MAX_TOPUP_AMOUNT

      return {
        ok: true,
        currency,
        config: {
          symbol: currencyRow?.symbol ?? (currency === "IDR" ? "Rp" : "$"),
          ratePerBase: rate,
          baseCode: baseCurrency?.code ?? "USD",
          presets,
          minTopup,
          maxTopup,
        },
        methods: {
          MANUAL_BANK: manualEnabled,
          VA: gatewayEnabled,
          QRIS: gatewayEnabled,
          PAYPAL: paypalEnabled,
        },
      }
    })

export const createPaymentHistoryRoutes = () =>
  new Elysia({ prefix: "/history" }).get("/", async ({ set }) => {
    const auth = await withAuth()
    if (!auth.organizationId) {
      set.status = 401
      return { ok: false, error: "UNAUTHORIZED", message: "Organization required" }
    }

    const invoices = await paymentService.getInvoicesForOrganization(auth.organizationId)

    return { ok: true, data: invoices }
  })