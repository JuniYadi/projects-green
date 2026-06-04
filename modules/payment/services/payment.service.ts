import { Prisma } from "@prisma/client"
import type { PrismaClient } from "@prisma/client"
import { randomInt } from "node:crypto"
import { prisma } from "@/lib/prisma"
import { BillingTransactionService } from "@/modules/billing/billing-transaction.service"
import { PAYMENT_CONSTANTS } from "../constants"
import type { InvoiceTypeValue } from "../types/payment.types"

export class PaymentService {
  private billingTransactions: BillingTransactionService

  constructor(billingTransactions?: BillingTransactionService) {
    this.billingTransactions =
      billingTransactions ?? new BillingTransactionService(prisma as unknown as PrismaClient)
  }

  /**
   * Generate a 3-digit unique code for manual transfer verification.
   * Uses crypto.randomInt for cryptographic security (financial context).
   */
  private generateUniqueCode(): number {
    return randomInt(1, 1000)
  }

  async createTopupInvoice(input: {
    organizationId: string
    amount: number
    paymentMethod?: string
    gatewayId?: string
  }) {
    const { amount, organizationId, paymentMethod, gatewayId } = input

    if (amount < PAYMENT_CONSTANTS.MIN_TOPUP_AMOUNT) {
      throw new Error(`Minimum top-up amount is ${PAYMENT_CONSTANTS.MIN_TOPUP_AMOUNT}`)
    }
    if (amount > PAYMENT_CONSTANTS.MAX_TOPUP_AMOUNT) {
      throw new Error(`Maximum top-up amount is ${PAYMENT_CONSTANTS.MAX_TOPUP_AMOUNT}`)
    }

    // Get or create billing account for organization
    let account = await prisma.billingAccount.findUnique({
      where: { organizationId },
    })

    if (!account) {
      account = await prisma.billingAccount.create({
        data: {
          organizationId,
          currency: "IDR",
        },
      })
    }

    const now = new Date()
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + PAYMENT_CONSTANTS.DEFAULT_EXPIRY_DAYS)

    // Generate invoice number using UUID to avoid race condition
    const invoiceNumber = `TOP-${crypto.randomUUID().split("-")[0].toUpperCase()}`

    // Generate unique code for manual transfer if enabled
    const uniqueCodeEnabled = process.env.MANUAL_TRANSFER_UNIQUE_CODE_ENABLED !== "false"
    let uniqueCode: number | undefined
    let finalAmount = amount
    let metadata: Record<string, unknown> | undefined

    if (paymentMethod === "MANUAL_BANK" && uniqueCodeEnabled) {
      uniqueCode = this.generateUniqueCode()
      finalAmount = amount + uniqueCode
      metadata = {
        baseAmount: amount,
        uniqueCode,
        finalAmount,
      }
    }

    const invoice = await prisma.invoice.create({
      data: {
        billingAccountId: account.id,
        invoiceNumber,
        type: "TOP_UP" as InvoiceTypeValue,
        paymentMethod,
        gatewayId,
        dueDate,
        status: "OPEN",
        subtotalAmount: finalAmount,
        totalAmount: finalAmount,
        currency: account.currency,
        periodStart: now,
        periodEnd: dueDate,
        metadataJson: (metadata ?? Prisma.DbNull) as Prisma.InputJsonValue,
      },
    })

    return invoice
  }

  async getInvoiceForUser(invoiceId: string, organizationId: string) {
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        billingAccount: { organizationId },
      },
    })
    return invoice
  }

  async getInvoicesForOrganization(organizationId: string, limit = 50) {
    const invoices = await prisma.invoice.findMany({
      where: { billingAccount: { organizationId } },
      orderBy: { createdAt: "desc" },
      take: limit,
    })
    return invoices
  }

  async getActiveBankAccounts() {
    const accounts = await prisma.bankAccount.findMany({
      where: { isActive: true },
      orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }],
    })
    return accounts
  }

  async markInvoiceAsPaid(invoiceId: string) {
    return prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: "PAID" },
    })
  }

  /**
   * Credit balance via BillingTransactionService with idempotency guard.
   * Uses invoiceId as the idempotency key to prevent double-crediting.
   */
  async creditBalance(organizationId: string, amount: number, invoiceId: string) {
    const account = await prisma.billingAccount.findUnique({
      where: { organizationId },
    })

    if (!account) {
      throw new Error("Billing account not found")
    }

    await this.billingTransactions.creditBalance({
      organizationId,
      amount: new Prisma.Decimal(amount),
      currency: account.currency,
      source: "TOPUP",
      reason: "Top-up payment received",
      idempotencyKey: `topup:${invoiceId}`,
      invoiceId,
      metadata: { reference: invoiceId },
    })
  }

  /**
   * Pay an invoice using balance. Uses BillingTransactionService for atomic debit.
   */
  async payWithBalance(invoiceId: string, organizationId: string) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, status: "OPEN", billingAccount: { organizationId } },
    })

    if (!invoice) {
      throw new Error("Invoice not found or not open")
    }

    const amount = invoice.totalAmount?.toNumber() || 0

    const account = await prisma.billingAccount.findUnique({
      where: { organizationId },
    })

    if (!account) {
      throw new Error("Billing account not found")
    }

    if (account.balance.toNumber() < amount) {
      throw new Error("Insufficient balance")
    }

    await this.billingTransactions.debitBalance({
      organizationId,
      amount: new Prisma.Decimal(amount),
      currency: invoice.currency,
      source: "ADJUSTMENT",
      reason: `Payment for invoice ${invoice.invoiceNumber}`,
      idempotencyKey: `pay:${invoiceId}`,
      invoiceId,
    })

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: "PAID" },
    })
  }

  async createTopupInvoiceForGap(organizationId: string, gapAmount: number) {
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 7)

    // Get or create billing account
    let account = await prisma.billingAccount.findUnique({
      where: { organizationId },
    })

    if (!account) {
      account = await prisma.billingAccount.create({
        data: {
          organizationId,
          currency: "IDR",
        },
      })
    }

    // Generate invoice number using UUID to avoid race condition
    const invoiceNumber = `TOP-${crypto.randomUUID().split("-")[0].toUpperCase()}`

    return prisma.invoice.create({
      data: {
        billingAccountId: account.id,
        invoiceNumber,
        type: "TOP_UP",
        status: "OPEN",
        dueDate,
        subtotalAmount: gapAmount,
        totalAmount: gapAmount,
        currency: account.currency,
        periodStart: new Date(),
        periodEnd: dueDate,
      },
    })
  }
}
