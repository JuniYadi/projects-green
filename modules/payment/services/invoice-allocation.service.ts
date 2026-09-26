import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { BillingTransactionService } from "@/modules/billing/billing-transaction.service"
import { settleProductOrdersForInvoice } from "@/modules/billing/orders/payment-settlement"
import { DuitkuService } from "./duitku.service"
import { GatewayService } from "./gateway.service"
import { PaymentService } from "./payment.service"

export class InvoiceAllocationService {
  private billingTransactions: BillingTransactionService
  private duitkuService: DuitkuService
  private gatewayService: GatewayService
  private paymentService: PaymentService

  constructor(
    billingTransactions?: BillingTransactionService,
    duitkuService?: DuitkuService,
    gatewayService?: GatewayService,
    paymentService?: PaymentService
  ) {
    this.billingTransactions =
      billingTransactions ?? new BillingTransactionService(prisma)
    this.duitkuService = duitkuService ?? new DuitkuService()
    this.gatewayService = gatewayService ?? new GatewayService()
    this.paymentService = paymentService ?? new PaymentService()
  }

  /**
   * Calculate total amount, total completed allocations, and remaining due.
   */
  async calculateRemainingDue(invoiceId: string) {
    const invoice = await prisma.billingInvoice.findUnique({
      where: { id: invoiceId },
      include: {
        allocations: {
          where: { status: "COMPLETED" },
        },
      },
    })

    if (!invoice) {
      throw new Error("Invoice not found")
    }

    const totalAmount = invoice.totalAmount.toNumber()
    const totalPaid = (invoice.allocations ?? []).reduce(
      (sum, a) => sum + a.amount.toNumber(),
      0
    )
    const remainingDue = Math.max(0, totalAmount - totalPaid)

    return {
      invoice,
      totalAmount,
      totalPaid,
      remainingDue,
      currency: invoice.currency,
    }
  }

  /**
   * Partially (or fully) pay an invoice using account balance.
   */
  async payPartialWithBalance(input: {
    invoiceId: string
    organizationId: string
    amountToUse: number
  }) {
    const { invoiceId, organizationId, amountToUse } = input

    if (amountToUse <= 0) {
      throw new Error("Amount must be greater than zero")
    }

    return prisma.$transaction(async (tx) => {
      // Lock billing account and invoice row atomically
      const invoice = await tx.billingInvoice.findFirst({
        where: {
          id: invoiceId,
          billingAccount: { organizationId },
        },
        include: {
          allocations: {
            where: { status: "COMPLETED" },
          },
        },
      })

      if (!invoice) {
        throw new Error("Invoice not found")
      }

      if (
        invoice.status !== "OPEN" &&
        invoice.status !== "PARTIALLY_PAID" &&
        invoice.status !== "ISSUED"
      ) {
        throw new Error("Invoice is not open for payment")
      }

      const totalAmount = invoice.totalAmount.toNumber()
      const currentPaid = (invoice.allocations ?? []).reduce(
        (sum, a) => sum + a.amount.toNumber(),
        0
      )
      const remainingDue = Math.max(0, totalAmount - currentPaid)

      if (remainingDue <= 0.000001) {
        throw new Error("Invoice is already fully paid")
      }

      // Rounding safety: allow paying up to remainingDue
      const roundedRemaining = Math.round(remainingDue * 100) / 100
      const roundedToUse = Math.round(amountToUse * 100) / 100

      if (roundedToUse > roundedRemaining) {
        throw new Error(
          `Amount to use (${amountToUse}) exceeds remaining due (${remainingDue})`
        )
      }

      const account = await tx.billingAccount.findUnique({
        where: { organizationId },
      })

      if (!account) {
        throw new Error("Billing account not found")
      }

      if (account.balance.toNumber() < roundedToUse) {
        throw new Error("Insufficient balance")
      }

      const idempotencyKey = `alloc:balance:${invoiceId}:${Date.now()}`

      // Debit balance atomically inside the same transaction
      await this.billingTransactions.debitBalance(
        {
          organizationId,
          amount: new Prisma.Decimal(roundedToUse),
          currency: invoice.currency,
          source: "ADJUSTMENT",
          reason: `Partial payment for invoice ${invoice.invoiceNumber}`,
          idempotencyKey,
          invoiceId,
        },
        tx
      )

      // Record completed allocation inside the same transaction
      const allocation = await tx.billingInvoicePaymentAllocation.create({
        data: {
          invoiceId,
          billingAccountId: account.id,
          amount: new Prisma.Decimal(roundedToUse),
          currency: invoice.currency,
          source: "BALANCE",
          status: "COMPLETED",
          completedAt: new Date(),
          idempotencyKey,
        },
      })

      const newPaid = currentPaid + roundedToUse
      const newRemaining = Math.max(0, totalAmount - newPaid)
      const isFullyPaid = newRemaining <= 0.0001

      const newStatus = isFullyPaid ? "PAID" : "PARTIALLY_PAID"

      await tx.billingInvoice.update({
        where: { id: invoiceId },
        data: {
          status: newStatus,
          paidAt: isFullyPaid ? new Date() : undefined,
        },
      })

      if (isFullyPaid) {
        await settleProductOrdersForInvoice(invoiceId)
        this.paymentService
          .sendInvoicePaidEmail(invoice, organizationId)
          .catch((err) =>
            console.error(
              `[InvoiceAllocation] Failed to send paid email for ${invoice.invoiceNumber}:`,
              err
            )
          )
      }

      return {
        ok: true as const,
        allocationId: allocation.id,
        invoiceStatus: newStatus,
        allocatedAmount: roundedToUse,
        totalPaid: newPaid,
        remainingDue: newRemaining,
      }
    })
  }

  /**
   * Initiate a gateway session (Duitku POP) specifically for the remaining due.
   */
  async initiateGatewayPayment(input: {
    invoiceId: string
    organizationId: string
    paymentMethod?: string
  }) {
    const { invoiceId, organizationId, paymentMethod } = input

    const invoice = await prisma.billingInvoice.findFirst({
      where: {
        id: invoiceId,
        billingAccount: { organizationId },
      },
      include: {
        allocations: {
          where: {
            status: { in: ["COMPLETED", "PENDING"] },
          },
        },
      },
    })

    if (!invoice) {
      throw new Error("Invoice not found")
    }

    if (
      invoice.status !== "OPEN" &&
      invoice.status !== "PARTIALLY_PAID" &&
      invoice.status !== "ISSUED"
    ) {
      throw new Error("Invoice is not open for payment")
    }

    // Guard against creating another gateway session when a pending gateway attempt already exists
    const existingPendingGateway = (invoice.allocations ?? []).find(
      (a) => a.status === "PENDING" && a.source === "GATEWAY_DUITKU"
    )

    if (existingPendingGateway) {
      // Reuse existing active pending session details from invoice metadata if available
      const existingMetadata =
        invoice.metadata &&
        typeof invoice.metadata === "object" &&
        !Array.isArray(invoice.metadata)
          ? (invoice.metadata as Record<string, unknown>)
          : {}

      const pendingAmount = existingPendingGateway.amount.toNumber()
      return {
        ok: true as const,
        mode: (existingMetadata.mode as string) || "POP",
        reference:
          existingPendingGateway.referenceId ||
          (existingMetadata.reference as string),
        clientScriptUrl: existingMetadata.clientScriptUrl as string | undefined,
        paymentUrl: existingMetadata.paymentUrl as string | undefined,
        remainingDue: pendingAmount,
      }
    }

    const totalAmount = invoice.totalAmount.toNumber()
    const currentPaid = (invoice.allocations ?? [])
      .filter((a) => a.status === "COMPLETED")
      .reduce((sum, a) => sum + a.amount.toNumber(), 0)
    const remainingDue = Math.max(0, totalAmount - currentPaid)

    if (remainingDue <= 0.000001) {
      throw new Error("Invoice is already fully paid")
    }

    const gateway = await this.gatewayService.findByTypeForCurrency(
      "GATEWAY",
      invoice.currency
    )

    if (!gateway) {
      throw new Error(`Gateway is not available for ${invoice.currency}`)
    }

    const gatewayConfig = await this.gatewayService.getDecryptedConfig(
      gateway.id
    )
    const isPopMode = gatewayConfig?.checkoutMode !== "REDIRECT"

    const duitkuMethod = isPopMode ? "" : paymentMethod === "QRIS" ? "QR" : "VC"

    // Call Duitku for remainingDue
    const roundedGatewayAmount = Math.round(remainingDue)
    const duitkuResult = await this.duitkuService.createPayment({
      invoiceId: invoice.id,
      amount: roundedGatewayAmount,
      paymentMethod: duitkuMethod,
      customerName: `Org ${organizationId}`,
      email: `${organizationId}@payment.local`,
      productDetails: `Payment for ${invoice.invoiceNumber}`,
    })

    // Create a pending allocation for this gateway attempt with exact requested amount
    await prisma.billingInvoicePaymentAllocation.create({
      data: {
        invoiceId,
        billingAccountId: invoice.billingAccountId,
        amount: new Prisma.Decimal(roundedGatewayAmount),
        currency: invoice.currency,
        source: "GATEWAY_DUITKU",
        status: "PENDING",
        referenceId: duitkuResult.reference ?? null,
        metadataJson: {
          mode: duitkuResult.mode,
          paymentUrl: duitkuResult.paymentUrl,
          clientScriptUrl: duitkuResult.clientScriptUrl,
        },
      },
    })

    // Update invoice metadata so existing re-trigger buttons have latest checkout refs
    const existingMetadata =
      invoice.metadata &&
      typeof invoice.metadata === "object" &&
      !Array.isArray(invoice.metadata)
        ? (invoice.metadata as Record<string, unknown>)
        : {}

    await prisma.billingInvoice.update({
      where: { id: invoiceId },
      data: {
        paymentMethod: paymentMethod ?? "GATEWAY",
        metadata: {
          ...existingMetadata,
          paymentUrl: duitkuResult.paymentUrl,
          duitkuReference: duitkuResult.reference,
          reference: duitkuResult.reference,
          mode: duitkuResult.mode,
          clientScriptUrl: duitkuResult.clientScriptUrl,
          vaNumber: duitkuResult.vaNumber ?? null,
        },
      },
    })

    return {
      ok: true as const,
      mode: duitkuResult.mode,
      reference: duitkuResult.reference,
      clientScriptUrl: duitkuResult.clientScriptUrl,
      paymentUrl: duitkuResult.paymentUrl,
      remainingDue,
    }
  }

  /**
   * Process a gateway callback confirmation for an invoice.
   */
  async processGatewayCallback(input: {
    merchantOrderId: string
    reference?: string
    amount: number
  }) {
    const { merchantOrderId, reference, amount } = input

    const invoice = await prisma.billingInvoice.findUnique({
      where: { id: merchantOrderId },
      include: {
        allocations: true,
        billingAccount: true,
      },
    })

    if (!invoice) {
      console.error(
        `[InvoiceAllocation] Invoice ${merchantOrderId} not found for callback`
      )
      return { ok: false }
    }

    // Find pending allocation with matching reference or fallback to single pending allocation
    const allocations = invoice.allocations ?? []
    const pendingAllocation = allocations.find(
      (a) =>
        a.status === "PENDING" &&
        (reference ? a.referenceId === reference : true)
    )

    if (!pendingAllocation) {
      console.error(
        `[InvoiceAllocation] Pending allocation not found for invoice ${merchantOrderId} (ref: ${reference ?? "none"})`
      )
      return { ok: false, error: "PENDING_ALLOCATION_NOT_FOUND" }
    }

    // Validate callback amount against the requested pending allocation amount exactly
    const pendingAmount = pendingAllocation.amount.toNumber()

    if (Math.abs(pendingAmount - amount) > 0.0001) {
      console.error(
        `[InvoiceAllocation] Amount mismatch for invoice ${merchantOrderId} (ref: ${reference}): expected ${pendingAmount}, received ${amount}`
      )
      return { ok: false, error: "AMOUNT_MISMATCH" }
    }

    await prisma.billingInvoicePaymentAllocation.update({
      where: { id: pendingAllocation.id },
      data: {
        status: "COMPLETED",
        amount: new Prisma.Decimal(amount),
        completedAt: new Date(),
        referenceId: reference ?? pendingAllocation.referenceId,
      },
    })

    // Re-query all completed allocations
    const completedAllocations =
      await prisma.billingInvoicePaymentAllocation.findMany({
        where: {
          invoiceId: merchantOrderId,
          status: "COMPLETED",
        },
      })

    const totalPaid = completedAllocations.reduce(
      (sum, a) => sum + a.amount.toNumber(),
      0
    )
    const isFullyPaid = totalPaid >= invoice.totalAmount.toNumber() - 0.0001
    const newStatus = isFullyPaid ? "PAID" : "PARTIALLY_PAID"

    const updatedInvoice = await prisma.billingInvoice.update({
      where: { id: merchantOrderId },
      data: {
        status: newStatus,
        paidAt: isFullyPaid ? new Date() : undefined,
      },
    })

    if (isFullyPaid) {
      await settleProductOrdersForInvoice(merchantOrderId)
      if (invoice.billingAccount?.organizationId) {
        this.paymentService
          .sendInvoicePaidEmail(
            updatedInvoice,
            invoice.billingAccount.organizationId
          )
          .catch((err) =>
            console.error(
              `[InvoiceAllocation] Failed to send email for ${invoice.invoiceNumber}:`,
              err
            )
          )
      }
    }

    return {
      ok: true as const,
      status: newStatus,
      totalPaid,
    }
  }
}
