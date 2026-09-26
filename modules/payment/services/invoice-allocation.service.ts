import { Prisma } from "@prisma/client"
import type { PrismaClient } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { BillingTransactionService } from "@/modules/billing/billing-transaction.service"
import { settleProductOrdersForInvoice } from "@/modules/billing/orders/payment-settlement"
import { DuitkuService } from "./duitku.service"
import { GatewayService } from "./gateway.service"
import { PaymentService } from "./payment.service"

// Transaction client type returned by Prisma $transaction callback
type TxClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$use" | "$extends"
>

/**
 * Money slack for comparisons. Amounts are stored as 6-decimal decimals, so
 * anything under this is float noise rather than a real difference.
 */
const MONEY_EPSILON = 0.0001

type AllocationRow = {
  id: string
  status: string
  source: string
  amount: Prisma.Decimal
  referenceId: string | null
}

function sumAllocations(allocations?: AllocationRow[] | null): number {
  return (allocations ?? []).reduce((sum, a) => sum + a.amount.toNumber(), 0)
}

/**
 * Compare two amounts as decimals. Float arithmetic must never decide whether
 * a gateway callback paid what the invoice asked for.
 */
function amountsEqual(a: Prisma.Decimal, b: Prisma.Decimal): boolean {
  return a.toFixed(6) === b.toFixed(6)
}

function readInvoiceMetadata(metadata: unknown): Record<string, unknown> {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? (metadata as Record<string, unknown>)
    : {}
}

/**
 * Take a row-level lock on the invoice. Every tender path (balance, gateway
 * callback) locks the same row first, so the remainingDue computed afterwards
 * cannot be stale and two tenders can never allocate more than the total.
 */
async function lockInvoice(tx: TxClient, invoiceId: string): Promise<void> {
  await tx.$queryRaw(
    Prisma.sql`SELECT id FROM "BillingInvoice" WHERE id = ${invoiceId} FOR UPDATE`
  )
}

/** Sum of the allocations already settled against an invoice. */
async function settledAllocationTotal(
  tx: TxClient,
  invoiceId: string
): Promise<number> {
  const allocations = (await tx.billingInvoicePaymentAllocation.findMany({
    where: { invoiceId, status: "COMPLETED" },
  })) as AllocationRow[]

  return sumAllocations(allocations)
}

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
    const totalPaid = sumAllocations(invoice.allocations ?? [])
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
   *
   * Locks the invoice, debits the balance, records the allocation, and flips
   * the invoice status in one transaction. Pending gateway allocations count
   * against the remaining due because that money is already committed to a
   * checkout session.
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
      await lockInvoice(tx, invoiceId)

      const invoice = await tx.billingInvoice.findFirst({
        where: {
          id: invoiceId,
          billingAccount: { organizationId },
        },
        include: {
          allocations: {
            where: { status: { in: ["COMPLETED", "PENDING"] } },
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

      const allocations = invoice.allocations ?? []
      const completedPaid = sumAllocations(
        allocations.filter((a) => a.status === "COMPLETED")
      )
      const pendingCommitted = sumAllocations(
        allocations.filter((a) => a.status === "PENDING")
      )
      const totalAmount = invoice.totalAmount.toNumber()
      const committed = completedPaid + pendingCommitted
      const remainingDue = Math.max(0, totalAmount - committed)

      if (remainingDue <= MONEY_EPSILON) {
        throw new Error("Invoice is already fully paid")
      }

      // Rounding safety: allow paying up to remainingDue
      const roundedRemaining = Math.round(remainingDue * 100) / 100
      const roundedToUse = Math.round(amountToUse * 100) / 100

      if (roundedToUse > roundedRemaining + MONEY_EPSILON) {
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

      if (account.balance.toNumber() < roundedToUse - MONEY_EPSILON) {
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

      // Only settled money decides the invoice status; a pending gateway
      // session has not been paid yet.
      const newPaid = completedPaid + roundedToUse
      const newRemaining = Math.max(0, totalAmount - newPaid)
      const isFullyPaid = newRemaining <= MONEY_EPSILON

      const newStatus = isFullyPaid ? "PAID" : "PARTIALLY_PAID"

      await tx.billingInvoice.update({
        where: { id: invoiceId },
        data: {
          status: newStatus,
          paidAt: isFullyPaid ? new Date() : undefined,
        },
      })

      if (isFullyPaid) {
        await settleProductOrdersForInvoice(invoiceId, tx)
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
   *
   * The invoice row is locked for the whole flow, so a double click cannot open
   * a second session for money that is already committed: the second call waits
   * for the first to commit and then returns that session.
   */
  async initiateGatewayPayment(input: {
    invoiceId: string
    organizationId: string
    paymentMethod?: string
  }) {
    const { invoiceId, organizationId, paymentMethod } = input

    return prisma.$transaction(async (tx) => {
      await lockInvoice(tx, invoiceId)

      const invoice = await tx.billingInvoice.findFirst({
        where: {
          id: invoiceId,
          billingAccount: { organizationId },
        },
        include: {
          allocations: {
            where: { status: { in: ["COMPLETED", "PENDING"] } },
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

      const existingMetadata = readInvoiceMetadata(invoice.metadata)

      // An active gateway attempt already covers its share of the invoice:
      // return it as-is instead of opening a duplicate session.
      const existingPendingGateway = (invoice.allocations ?? []).find(
        (a) => a.status === "PENDING" && a.source === "GATEWAY_DUITKU"
      )

      if (existingPendingGateway) {
        return {
          ok: true as const,
          mode: (existingMetadata.mode as string) || "POP",
          reference:
            existingPendingGateway.referenceId ||
            (existingMetadata.reference as string),
          clientScriptUrl: existingMetadata.clientScriptUrl as
            string | undefined,
          paymentUrl: existingMetadata.paymentUrl as string | undefined,
          remainingDue: existingPendingGateway.amount.toNumber(),
        }
      }

      const totalAmount = invoice.totalAmount.toNumber()
      const committed = sumAllocations(invoice.allocations ?? [])
      const remainingDue = Math.max(0, totalAmount - committed)

      if (remainingDue <= MONEY_EPSILON) {
        throw new Error("Invoice is already fully paid")
      }

      // Duitku charges whole units. Request the largest whole amount that
      // still fits in the invoice headroom, so the pending allocation created
      // below keeps completed + pending within the invoice total by
      // construction (gatewayAmount <= remainingDue = totalAmount - committed).
      const wholeUnits = Math.floor(Math.round(remainingDue * 100) / 100)
      const gatewayAmount = wholeUnits > 0 ? wholeUnits : remainingDue

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

      const duitkuMethod = isPopMode
        ? ""
        : paymentMethod === "QRIS"
          ? "QR"
          : "VC"

      // Call Duitku for exactly the amount we are about to reserve
      const duitkuResult = await this.duitkuService.createPayment({
        invoiceId: invoice.id,
        amount: gatewayAmount,
        paymentMethod: duitkuMethod,
        customerName: `Org ${organizationId}`,
        email: `${organizationId}@payment.local`,
        productDetails: `Payment for ${invoice.invoiceNumber}`,
      })

      // Create a pending allocation for this gateway attempt with exact
      // requested amount and reference so the callback can be matched to it.
      await tx.billingInvoicePaymentAllocation.create({
        data: {
          invoiceId,
          billingAccountId: invoice.billingAccountId,
          amount: new Prisma.Decimal(gatewayAmount),
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

      // Update invoice metadata so existing re-trigger buttons have latest
      // checkout refs
      await tx.billingInvoice.update({
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
        remainingDue: gatewayAmount,
      }
    })
  }

  /**
   * Process a gateway callback confirmation for an invoice.
   *
   * Matching the pending allocation, validating the amount, completing it, and
   * updating the invoice all happen in one transaction under a row lock, so a
   * retried or concurrent callback can never double-apply the same payment.
   */
  async processGatewayCallback(input: {
    merchantOrderId: string
    reference?: string
    amount: number
  }) {
    const { merchantOrderId, reference, amount } = input

    return prisma.$transaction(async (tx) => {
      await lockInvoice(tx, merchantOrderId)

      const invoice = await tx.billingInvoice.findUnique({
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
        return { ok: false as const, error: "INVOICE_NOT_FOUND" }
      }

      // Find the allocation for this attempt: by reference when the gateway
      // sent one, otherwise the only pending attempt.
      const allocations = (invoice.allocations ?? []) as AllocationRow[]
      const matchedAllocation = allocations.find((a) =>
        reference ? a.referenceId === reference : a.status === "PENDING"
      )

      if (!matchedAllocation) {
        console.error(
          `[InvoiceAllocation] Pending allocation not found for invoice ${merchantOrderId} (ref: ${reference ?? "none"})`
        )
        return {
          ok: false as const,
          error: "PENDING_ALLOCATION_NOT_FOUND",
        }
      }

      // Duplicate callback for an attempt already settled: acknowledge it so
      // the gateway stops retrying instead of failing the whole invoice.
      if (matchedAllocation.status === "COMPLETED") {
        return {
          ok: true as const,
          status: invoice.status,
          totalPaid: await settledAllocationTotal(tx, merchantOrderId),
        }
      }

      // Validate the callback amount against the exact amount requested for
      // this attempt. Anything else is not this payment: change nothing.
      const callbackAmount = new Prisma.Decimal(amount)

      if (!amountsEqual(callbackAmount, matchedAllocation.amount)) {
        console.error(
          `[InvoiceAllocation] Amount mismatch for invoice ${merchantOrderId} (ref: ${reference}): expected ${matchedAllocation.amount.toString()}, received ${callbackAmount.toString()}`
        )
        return { ok: false as const, error: "AMOUNT_MISMATCH" }
      }

      const settledBefore = await settledAllocationTotal(tx, merchantOrderId)

      await tx.billingInvoicePaymentAllocation.update({
        where: { id: matchedAllocation.id },
        data: {
          status: "COMPLETED",
          amount: callbackAmount,
          completedAt: new Date(),
          referenceId: reference ?? matchedAllocation.referenceId,
        },
      })

      const totalPaid = settledBefore + callbackAmount.toNumber()
      const isFullyPaid =
        totalPaid >= invoice.totalAmount.toNumber() - MONEY_EPSILON
      const newStatus = isFullyPaid ? "PAID" : "PARTIALLY_PAID"

      const updatedInvoice = await tx.billingInvoice.update({
        where: { id: merchantOrderId },
        data: {
          status: newStatus,
          paidAt: isFullyPaid ? new Date() : undefined,
        },
      })

      if (isFullyPaid) {
        await settleProductOrdersForInvoice(merchantOrderId, tx)
        const organizationId = invoice.billingAccount?.organizationId
        if (organizationId) {
          this.paymentService
            .sendInvoicePaidEmail(updatedInvoice, organizationId)
            .catch((err) =>
              console.error(
                `[InvoiceAllocation] Failed to send email for ${invoice.invoiceNumber}:`,
                err
              )
            )
        }
      }

      return { ok: true as const, status: newStatus, totalPaid }
    })
  }
}
