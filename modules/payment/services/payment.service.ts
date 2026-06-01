import { prisma } from "@/lib/prisma"
import { PAYMENT_CONSTANTS } from "../constants"
import type { InvoiceTypeValue } from "@/modules/payment/types/payment.types"

export class PaymentService {
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

    const invoice = await prisma.invoice.create({
      data: {
        billingAccountId: account.id,
        invoiceNumber,
        type: "TOP_UP" as InvoiceTypeValue,
        paymentMethod,
        gatewayId,
        dueDate,
        status: "OPEN",
        subtotalAmount: amount,
        totalAmount: amount,
        currency: "IDR",
        periodStart: now,
        periodEnd: dueDate,
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

  async creditBalance(organizationId: string, amount: number, reference: string) {
    const account = await prisma.billingAccount.findUnique({
      where: { organizationId },
    })

    if (!account) {
      throw new Error("Billing account not found")
    }

    await prisma.billingAdjustment.create({
      data: {
        billingAccountId: account.id,
        invoiceId: reference,
        adjustmentType: "CREDIT",
        amount,
        currency: "IDR",
        reason: "Top-up payment received",
        appliedAt: new Date(),
      },
    })

    await prisma.billingAccount.update({
      where: { organizationId },
      data: {
        balance: { increment: amount },
      },
    })
  }

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

    await prisma.billingAdjustment.create({
      data: {
        billingAccountId: account.id,
        invoiceId,
        adjustmentType: "DEBIT",
        amount,
        currency: invoice.currency,
        reason: `Payment for invoice ${invoice.invoiceNumber}`,
        appliedAt: new Date(),
      },
    })

    await prisma.billingAccount.update({
      where: { organizationId },
      data: { balance: { decrement: amount } },
    })

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: "PAID" },
    })
  }

  async createTopupInvoiceForGap(
    organizationId: string,
    gapAmount: number
  ) {
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
        currency: "IDR",
        periodStart: new Date(),
        periodEnd: dueDate,
      },
    })
  }
}