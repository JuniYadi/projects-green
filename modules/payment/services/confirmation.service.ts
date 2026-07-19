import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { BillingTransactionService } from "@/modules/billing/billing-transaction.service"
import Decimal = Prisma.Decimal
import { emitBillingAudit } from "@/modules/billing/audit/audit.service"

export class ConfirmationService {
  private billingTransactions: BillingTransactionService

  constructor(billingTransactions?: BillingTransactionService) {
    this.billingTransactions =
      billingTransactions ?? new BillingTransactionService(prisma)
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
    const { invoiceId, organizationId, data } = input

    const invoice = await prisma.billingInvoice.findFirst({
      where: {
        id: invoiceId,
        status: "OPEN",
        billingAccount: { organizationId },
      },
    })

    if (!invoice) {
      throw new Error("Invoice not found or not open")
    }

    // Reject if a PENDING or APPROVED confirmation already exists for this invoice
    const existing = await prisma.paymentConfirmation.findFirst({
      where: {
        invoiceId,
        status: { in: ["PENDING", "APPROVED"] },
      },
    })
    if (existing) {
      if (existing.status === "PENDING") {
        throw new Error("CONFIRMATION_ALREADY_EXISTS_PENDING")
      }
      throw new Error("CONFIRMATION_INVOICE_ALREADY_PAID")
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

  async approve(
    id: string,
    adminUserId: string
  ): Promise<{
    invoiceId: string
    invoiceNumber: string
    totalAmount: number
    currency: string
    organizationId: string
  }> {
    // Wrap all operations in a single transaction for atomicity.
    // If creditBalance succeeds but the subsequent updates fail, the transaction
    // rolls back entirely — no orphaned credits.
    const result = await prisma.$transaction(async (tx) => {
      const confirmation = await tx.paymentConfirmation.findUnique({
        where: { id },
        include: { invoice: { include: { billingAccount: true } } },
      })

      if (!confirmation) throw new Error("Confirmation not found")
      if (confirmation.status !== "PENDING")
        throw new Error("Confirmation already processed")

      const invoice = confirmation.invoice
      const amount = confirmation.amount

      if (!invoice?.billingAccount?.organizationId) {
        throw new Error("Billing account not found for invoice")
      }

      // Credit balance within the same transaction via the injected service.
      await this.billingTransactions.creditBalance(
        {
          organizationId: invoice.billingAccount.organizationId,
          amount: new Decimal(amount),
          currency: invoice.billingAccount.currency,
          source: "TOPUP",
          reason: "Manual payment confirmed",
          idempotencyKey: `manual:${id}`,
          invoiceId: invoice.id,
          metadata: { confirmedBy: adminUserId, confirmationId: id },
        },
        tx
      )

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
      await tx.billingInvoice.update({
        where: { id: confirmation.invoiceId },
        data: { status: "PAID", paidAt: new Date() },
      })

      // Audit log (payment-specific)
      await tx.paymentAuditLog.create({
        data: {
          action: "PAYMENT_APPROVED",
          entityType: "PaymentConfirmation",
          entityId: id,
          actorId: adminUserId,
          details: { amount, invoiceId: confirmation.invoiceId },
        },
      })

      return {
        billingAccountId: invoice.billingAccountId,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        totalAmount: invoice.totalAmount.toNumber(),
        currency: invoice.billingAccount.currency,
        organizationId: invoice.billingAccount.organizationId,
      }
    })

    // Fire-and-forget billing audit (uses global prisma, not tx)
    emitBillingAudit({
      billingAccountId: result.billingAccountId ?? undefined,
      entityType: "Invoice",
      entityId: result.invoiceId,
      action: "PAYMENT_CONFIRMED",
      actorId: adminUserId,
      context: {
        invoiceNumber: result.invoiceNumber,
        totalAmount: result.totalAmount.toFixed(2),
        currency: result.currency,
        confirmationId: id,
      },
    })

    return result
  }

  async reject(id: string, adminUserId: string, reason: string) {
    const confirmation = await prisma.paymentConfirmation.findUnique({
      where: { id },
    })

    if (!confirmation) throw new Error("Confirmation not found")
    if (confirmation.status !== "PENDING")
      throw new Error("Confirmation already processed")

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
