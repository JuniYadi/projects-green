import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import Decimal = Prisma.Decimal

export class ConfirmationService {
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
    const confirmation = await prisma.paymentConfirmation.findUnique({
      where: { id },
      include: { invoice: true },
    })

    if (!confirmation) throw new Error("Confirmation not found")
    if (confirmation.status !== "PENDING") throw new Error("Confirmation already processed")

    await prisma.paymentConfirmation.update({
      where: { id },
      data: {
        status: "APPROVED",
        reviewedBy: adminUserId,
        reviewedAt: new Date(),
      },
    })

    const invoice = confirmation.invoice
    const amount = confirmation.amount

    // Find billing account by invoice's billingAccountId
    const account = await prisma.billingAccount.findUnique({
      where: { id: invoice.billingAccountId },
    })

    if (!account) {
      throw new Error("Billing account not found")
    }

    const newBalance = account.balance.plus(amount)

    await prisma.billingAdjustment.create({
      data: {
        billingAccountId: account.id,
        adjustmentType: "CREDIT",
        amount: new Decimal(amount),
        currency: "IDR",
        reason: "Manual payment confirmed",
        metadataJson: {
          reference: `PAYMENT_CONFIRM_${id}`,
          source: "manual_bank_transfer",
        },
      },
    })

    await prisma.billingAccount.update({
      where: { id: account.id },
      data: {
        balance: newBalance,
      },
    })

    await prisma.invoice.update({
      where: { id: confirmation.invoiceId },
      data: { status: "PAID" },
    })

    await prisma.paymentAuditLog.create({
      data: {
        action: "PAYMENT_APPROVED",
        entityType: "PaymentConfirmation",
        entityId: id,
        actorId: adminUserId,
        details: { amount, invoiceId: confirmation.invoiceId },
      },
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
