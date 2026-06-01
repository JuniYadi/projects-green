import { Elysia } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"

import { prisma } from "@/lib/prisma"
import { PaymentService } from "../services/payment.service"
import { BankAccountService } from "../services/bank-account.service"
import { CreateTopupSchema } from "../types/payment.types"

const paymentService = new PaymentService()
const bankAccountService = new BankAccountService()

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

      const { amount } = parseResult.data

      try {
        const invoice = await paymentService.createTopupInvoice({
          organizationId: auth.organizationId,
          amount,
        })

        return {
          ok: true,
          invoice: {
            id: invoice.id,
            amount: invoice.totalAmount?.toNumber() || amount,
            status: invoice.status,
            dueDate: invoice.dueDate?.toISOString(),
            type: invoice.type,
          },
        }
      } catch (error) {
        set.status = 400
        return {
          ok: false,
          error: "CREATE_FAILED",
          message: error instanceof Error ? error.message : "Failed to create invoice",
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