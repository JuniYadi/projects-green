import { Elysia } from "elysia"
import { Prisma } from "@prisma/client"
import { DuitkuService } from "../services/duitku.service"
import { PaymentService } from "../services/payment.service"
import { InvoiceAllocationService } from "../services/invoice-allocation.service"
import { prisma } from "@/lib/prisma"

const duitkuService = new DuitkuService()
const paymentService = new PaymentService()
const invoiceAllocationService = new InvoiceAllocationService()

export const createWebhookRoutes = () =>
  new Elysia()
    .post("/duitku/callback", async ({ body, set }) => {
      const params = body as Record<string, string>

      const isValid = await duitkuService.verifyCallback({
        merchantCode: params.merchantCode,
        amount: params.amount,
        merchantOrderId: params.merchantOrderId,
        signature: params.signature,
      })

      if (!isValid) {
        console.error("Invalid Duitku callback signature")
        set.status = 400
        return { ok: false, error: "INVALID_SIGNATURE" }
      }

      const { merchantOrderId, resultCode, reference, amount } = params

      const attemptKey = reference
        ? `${merchantOrderId}:${reference}`
        : merchantOrderId

      const existingLog = await prisma.paymentAuditLog.findFirst({
        where: {
          entityId: attemptKey,
          action: "DUITKU_CALLBACK_RECEIVED",
        },
      })

      if (existingLog) {
        console.log(`Callback already processed for ${attemptKey}`)
        return { ok: true, message: "Already processed" }
      }

      await prisma.paymentAuditLog.create({
        data: {
          action: "DUITKU_CALLBACK_RECEIVED",
          entityType: "Invoice",
          entityId: attemptKey,
          actorId: "SYSTEM",
          details: params,
        },
      })

      if (resultCode === "00") {
        try {
          // Look up invoice and billing account to get organizationId before crediting
          const invoice = await prisma.billingInvoice.findUnique({
            where: { id: merchantOrderId },
          })

          if (!invoice?.billingAccountId) {
            console.error(
              `Invoice ${merchantOrderId} not found or missing billingAccountId`
            )
            // Return 200 to prevent Duitku retries for invalid orders
            return { ok: true }
          }

          const billingAccount = await prisma.billingAccount.findUnique({
            where: { id: invoice.billingAccountId },
          })

          if (!billingAccount?.organizationId) {
            console.error(
              `Billing account not found for invoice ${merchantOrderId}`
            )
            return { ok: true }
          }

          const isTopUp =
            invoice.type === "TOP_UP" ||
            invoice.type === "TOPUP" ||
            invoice.type === null ||
            invoice.type === undefined

          if (isTopUp) {
            await paymentService.creditBalance(
              billingAccount.organizationId,
              parseInt(amount),
              merchantOrderId
            )

            const paidInvoice =
              await paymentService.markInvoiceAsPaid(merchantOrderId)

            try {
              await prisma.billingInvoicePaymentAllocation.create({
                data: {
                  invoiceId: merchantOrderId,
                  billingAccountId: invoice.billingAccountId,
                  amount: new Prisma.Decimal(parseInt(amount)),
                  currency: invoice.currency ?? "IDR",
                  source: "GATEWAY_DUITKU",
                  status: "COMPLETED",
                  referenceId: reference ?? null,
                  completedAt: new Date(),
                },
              })
            } catch {
              // Ignore duplicate or non-critical allocation creation error in webhook
            }

            // Fire-and-forget: send invoice paid email
            paymentService
              .sendInvoicePaidEmail(paidInvoice, billingAccount.organizationId)
              .catch((err) =>
                console.error(
                  `[Webhook] Failed to send paid email for ${merchantOrderId}:`,
                  err
                )
              )
          } else {
            // Service invoice payment via Duitku allocation
            await invoiceAllocationService.processGatewayCallback({
              merchantOrderId,
              reference,
              amount: parseInt(amount),
            })
          }

          await prisma.paymentAuditLog.create({
            data: {
              action: "DUITKU_PAYMENT_COMPLETED",
              entityType: "Invoice",
              entityId: attemptKey,
              actorId: "SYSTEM",
              details: { amount, reference },
            },
          })
        } catch (error) {
          console.error(
            `Failed to process payment for ${merchantOrderId}:`,
            error
          )
        }
      } else {
        console.log(`Payment failed for ${merchantOrderId}: ${resultCode}`)
      }

      return { ok: true }
    })
    .get("/duitku/return", async ({ query, set }) => {
      const { merchantOrderId, resultCode } = query as {
        merchantOrderId?: string
        resultCode?: string
      }

      if (!merchantOrderId) {
        set.status = 400
        return { ok: false, error: "INVALID_REQUEST" }
      }

      const status = resultCode === "00" ? "success" : "failed"
      return {
        ok: true,
        redirect: `/console/billing/invoices/${merchantOrderId}?payment=${status}`,
      }
    })
