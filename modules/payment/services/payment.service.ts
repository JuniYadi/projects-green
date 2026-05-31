import { prisma } from "@/lib/prisma"
import { PAYMENT_CONSTANTS } from "../constants"
import type { InvoiceTypeValue } from "@/modules/payment/types/payment.types"

export class PaymentService {
  async createTopupInvoice(input: {
    tenantId: string
    amount: number
    paymentMethod?: string
    gatewayId?: string
  }) {
    const { amount, tenantId, paymentMethod, gatewayId } = input

    if (amount < PAYMENT_CONSTANTS.MIN_TOPUP_AMOUNT) {
      throw new Error(`Minimum top-up amount is ${PAYMENT_CONSTANTS.MIN_TOPUP_AMOUNT}`)
    }
    if (amount > PAYMENT_CONSTANTS.MAX_TOPUP_AMOUNT) {
      throw new Error(`Maximum top-up amount is ${PAYMENT_CONSTANTS.MAX_TOPUP_AMOUNT}`)
    }

    // Get or create billing account for tenant
    let account = await prisma.billingAccount.findUnique({
      where: { tenantId },
    })

    if (!account) {
      account = await prisma.billingAccount.create({
        data: {
          tenantId,
          organizationId: tenantId, // Use tenantId as organizationId fallback
          currency: "IDR",
        },
      })
    }

    const now = new Date()
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + PAYMENT_CONSTANTS.DEFAULT_EXPIRY_DAYS)

    // Generate invoice number
    const invoiceCount = await prisma.invoice.count()
    const invoiceNumber = `TOP-${Date.now()}-${invoiceCount + 1}`

    const invoice = await prisma.invoice.create({
      data: {
        billingAccountId: account.id,
        tenantId,
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

  async getInvoiceForUser(invoiceId: string, tenantId: string) {
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        tenantId,
      },
    })
    return invoice
  }

  async getInvoicesForTenant(tenantId: string, limit = 50) {
    const invoices = await prisma.invoice.findMany({
      where: { tenantId },
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

  async creditBalance(tenantId: string, amount: number, reference: string) {
    const account = await prisma.billingAccount.findUnique({
      where: { tenantId },
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
      where: { tenantId },
      data: {
        balance: { increment: amount },
      },
    })
  }

  async payWithBalance(invoiceId: string, tenantId: string) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, status: "OPEN" },
    })

    if (!invoice) {
      throw new Error("Invoice not found or not open")
    }

    const amount = invoice.totalAmount?.toNumber() || 0

    const account = await prisma.billingAccount.findUnique({
      where: { tenantId },
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
      where: { tenantId },
      data: { balance: { decrement: amount } },
    })

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: "PAID" },
    })
  }

  async createTopupInvoiceForGap(
    tenantId: string,
    organizationId: string,
    gapAmount: number
  ) {
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 7)

    // Get or create billing account
    let account = await prisma.billingAccount.findUnique({
      where: { tenantId },
    })

    if (!account) {
      account = await prisma.billingAccount.create({
        data: {
          tenantId,
          organizationId,
          currency: "IDR",
        },
      })
    }

    // Generate invoice number
    const invoiceCount = await prisma.invoice.count()
    const invoiceNumber = `TOP-${Date.now()}-${invoiceCount + 1}`

    return prisma.invoice.create({
      data: {
        billingAccountId: account.id,
        tenantId,
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