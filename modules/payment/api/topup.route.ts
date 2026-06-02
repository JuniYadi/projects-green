import { Elysia } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"

import { prisma } from "@/lib/prisma"
import { PaymentService } from "../services/payment.service"
import { BankAccountService } from "../services/bank-account.service"
import { DuitkuService } from "../services/duitku.service"
import { GatewayService } from "../services/gateway.service"
import { CreateTopupSchema } from "../types/payment.types"

const paymentService = new PaymentService()
const bankAccountService = new BankAccountService()
const duitkuService = new DuitkuService()
const gatewayService = new GatewayService()

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
        if (paymentMethod === "VA" || paymentMethod === "QRIS") {
          const gateway = await gatewayService.findByType("GATEWAY")
          if (!gateway) {
            set.status = 400
            return {
              ok: false,
              error: "GATEWAY_NOT_CONFIGURED",
              message: "Payment gateway not configured",
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
            productDetails: `Top Up Balance - ${invoice.invoiceNumber}`,
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