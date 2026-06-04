import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import type { PrismaClient } from "@prisma/client"
import { BillingTransactionService } from "@/modules/billing/billing-transaction.service"
import Decimal = Prisma.Decimal

export class ConfirmationService {
  private billingTransactions: BillingTransactionService

  constructor(billingTransactions?: BillingTransactionService) {
    this.billingTransactions =
      billingTransactions ?? new BillingTransactionService(prisma as unknown as PrismaClient)
  }

  async create(input: {
    invoiceId: string
    organizationId: string
    data: {
      bankAccountId: string
      amount: number
      paymentDateTime: Date
      senderBankName?: string
      senderName?: string
      senderAccount?: string
      screenshotUrl?: string
      notes?: string
    }
  }) {
    const { invoiceId, data } = input

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, status: "OPEN" },
    })

    if (!invoice) {
      throw new Error("Invoice not found or not open")
    }

    const confirmation = await prisma.paymentConfirmation.create({
      data: {
        invoiceId,
        bankAccountId: data.bankAccountId,
        amount: data.amount,
        paymentDateTime: data.paymentDateTime,
        senderBankName: data.senderBankName,
        senderName: data.senderName,
        senderAccount: data.senderAccount,
        screenshotUrl: data.screenshotUrl,
        notes: data.notes,
        status: "PENDING",
      },
      include: {
        bankAccount: true,
      },
    })

    return confirmation
  }

  async listPending(limit = 20, offset = 0) {
    const confirmations = await prisma.paymentConfirmation.findMany({
      where: { status: "PENDING" },
      include: {
        invoice: true,
        bankAccount: true,
      },
      orderBy: { createdAt: "asc" },
      take: limit,
      skip: offset,
    })

    return confirmations
  }

  async findById(id: string) {
    return prisma.paymentConfirmation.findUnique({
      where: { id },
      include: {
        invoice: true,
        bankAccount: true,
      },
    })
  }

  async approve(id: string, adminUserId: string) {
    // Wrap all operations in a single transaction for atomicity.
    // If creditBalance succeeds but the subsequent updates fail, the transaction
    // rolls back entirely — no orphaned credits.
    await prisma.$transaction(async (tx) => {
      const confirmation = await tx.paymentConfirmation.findUnique({
        where: { id },
        include: { invoice: { include: { billingAccount: true } } },
      })

      if (!confirmation) throw new Error("Confirmation not found")
      if (confirmation.status !== "PENDING") throw new Error("Confirmation already processed")

      const invoice = confirmation.invoice
      const amount = confirmation.amount

      if (!invoice?.billingAccount?.organizationId) {
        throw new Error("Billing account not found for invoice")
      }

      // Credit balance via BillingTransactionService with transaction-scoped Prisma client
      const billingTx = new BillingTransactionService(tx as unknown as PrismaClient)
      await billingTx.creditBalance({
        organizationId: invoice.billingAccount.organizationId,
        amount: new Decimal(amount),
        currency: invoice.billingAccount.currency,
        source: "TOPUP",
        reason: "Manual payment confirmed",
        idempotencyKey: `manual:${id}`,
        invoiceId: invoice.id,
        metadata: { confirmedBy: adminUserId, confirmationId: id },
      })

      // Mark confirmation as approved
      await tx.paymentConfirmation.update({
        where: { id },
        data: {
          status: "APPROVED",
          reviewedBy: adminUserId,
          reviewedAt: new Date(),
        },
      })

      // Mark invoice as paid
      await tx.invoice.update({
        where: { id: confirmation.invoiceId },
        data: { status: "PAID" },
      })

      // Audit log
      await tx.paymentAuditLog.create({
        data: {
          action: "PAYMENT_APPROVED",
          entityType: "PaymentConfirmation",
          entityId: id,
          actorId: adminUserId,
          details: { amount, invoiceId: confirmation.invoiceId },
        },
      })
    })
  }

  async reject(id: string, adminUserId: string, reason: string) {
    const confirmation = await prisma.paymentConfirmation.findUnique({
      where: { id },
    })

    if (!confirmation) throw new Error("Confirmation not found")
    if (confirmation.status !== "PENDING") throw new Error("Confirmation already processed")

    await prisma.paymentConfirmation.update({
      where: { id },
      data: {
        status: "REJECTED",
        reviewedBy: adminUserId,
        reviewedAt: new Date(),
        rejectReason: reason,
      },
    })

    await prisma.paymentAuditLog.create({
      data: {
        action: "PAYMENT_REJECTED",
        entityType: "PaymentConfirmation",
        entityId: id,
        actorId: adminUserId,
        details: { reason },
      },
    })
  }
}
