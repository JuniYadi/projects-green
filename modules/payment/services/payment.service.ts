import { Prisma } from "@prisma/client"
import type { PrismaClient } from "@prisma/client"
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
   * Resolve per-currency top-up bounds from the PaymentCurrency table.
   * Falls back to the base-currency (USD) constants when no row exists so
   * validation never crashes on an unseeded currency.
   */
  private async getTopupBounds(
    currencyCode: string
  ): Promise<{ minTopup: number; maxTopup: number }> {
    const currencyRow = await prisma.paymentCurrency.findUnique({
      where: { code: currencyCode },
    })

    return {
      minTopup: currencyRow?.minTopup?.toNumber() ?? PAYMENT_CONSTANTS.MIN_TOPUP_AMOUNT,
      maxTopup: currencyRow?.maxTopup?.toNumber() ?? PAYMENT_CONSTANTS.MAX_TOPUP_AMOUNT,
    }
  }

  async createTopupInvoice(input: {
    organizationId: string
    amount: number
    paymentMethod?: string
    gatewayId?: string
  }) {
    const { amount, organizationId, paymentMethod, gatewayId } = input

    // Get or create billing account for organization
    let account = await prisma.billingAccount.findUnique({
      where: { organizationId },
    })

    if (!account) {
      account = await prisma.billingAccount.create({
        data: {
          organizationId,
          // TODO(P1): Wire currency from onboarding selector / WorkOS locale.
          // Hardcoded IDR fallback is a known debt (see CURRENCY-FIX-STRATEGY).
          currency: "IDR",
        },
      })
    }

    // Validate amount against currency-specific bounds. The PaymentCurrency
    // table holds correct per-currency limits (e.g. IDR min 250k / max 250M);
    // fall back to the base-currency (USD) constants only when no row exists.
    const { minTopup, maxTopup } = await this.getTopupBounds(account.currency)

    if (amount < minTopup) {
      throw new Error(`Minimum top-up amount is ${minTopup} ${account.currency}`)
    }
    if (amount > maxTopup) {
      throw new Error(`Maximum top-up amount is ${maxTopup} ${account.currency}`)
    }

    const now = new Date()
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + PAYMENT_CONSTANTS.DEFAULT_EXPIRY_DAYS)

    // Generate invoice number using UUID to avoid race condition
    const invoiceNumber = `TOP-${crypto.randomUUID().split("-")[0].toUpperCase()}`

    const invoice = await prisma.billingInvoice.create({
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
        currency: account.currency,
        periodStart: now,
        periodEnd: dueDate,
        // Every invoice must carry at least one line so the detail view and PDF
        // render a meaningful description / qty / unit price / total.
        lines: {
          create: {
            lineType: "ADJUSTMENT",
            description: "Balance Top-Up",
            quantity: new Prisma.Decimal(1),
            unitPrice: new Prisma.Decimal(amount),
            amount: new Prisma.Decimal(amount),
            currency: account.currency,
            periodStart: now,
            periodEnd: dueDate,
          },
        },
      },
    })

    return invoice
  }

  async getInvoiceForUser(invoiceId: string, organizationId: string) {
    const invoice = await prisma.billingInvoice.findFirst({
      where: {
        id: invoiceId,
        billingAccount: { organizationId },
      },
    })
    return invoice
  }

  async getInvoicesForOrganization(organizationId: string, limit = 50) {
    const invoices = await prisma.billingInvoice.findMany({
      where: { billingAccount: { organizationId } },
      orderBy: { createdAt: "desc" },
      take: limit,
    })
    return invoices
  }

  async getActiveBankAccounts() {
    const accounts = await prisma.paymentBankAccount.findMany({
      where: { isActive: true },
      orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }],
    })
    return accounts
  }

  async markInvoiceAsPaid(invoiceId: string) {
    return prisma.billingInvoice.update({
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
    const invoice = await prisma.billingInvoice.findFirst({
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

    await prisma.billingInvoice.update({
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
          // TODO(P1): Wire currency from onboarding selector / WorkOS locale.
          // Hardcoded IDR fallback is a known debt (see CURRENCY-FIX-STRATEGY).
          currency: "IDR",
        },
      })
    }

    // Generate invoice number using UUID to avoid race condition
    const invoiceNumber = `TOP-${crypto.randomUUID().split("-")[0].toUpperCase()}`

    return prisma.billingInvoice.create({
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
        lines: {
          create: {
            lineType: "ADJUSTMENT",
            description: "Balance Top-Up",
            quantity: new Prisma.Decimal(1),
            unitPrice: new Prisma.Decimal(gapAmount),
            amount: new Prisma.Decimal(gapAmount),
            currency: account.currency,
          },
        },
      },
    })
  }
}
