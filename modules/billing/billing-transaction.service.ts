import { Prisma } from "@prisma/client"
import type { PrismaClient } from "@prisma/client"

// Transaction client type returned by Prisma $transaction callback
type TxClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$use" | "$extends"
>

export type BillingChargeSource =
  | "TOPUP"
  | "APP_HOSTING"
  | "WHATSAPP"
  | "VPN"
  | "PACKAGE"
  | "ADJUSTMENT"

export type BalanceMutationInput = {
  organizationId: string
  amount: Prisma.Decimal
  currency: "IDR" | "USD" | string
  source: BillingChargeSource
  reason: string
  idempotencyKey: string
  invoiceId?: string
  invoiceLineId?: string
  metadata?: Record<string, unknown>
}

export type BalanceMutationResult = {
  billingAccountId: string
  adjustmentId: string
  balanceBefore: Prisma.Decimal
  balanceAfter: Prisma.Decimal
  amount: Prisma.Decimal
  currency: string
  alreadyProcessed: boolean
}

export type ServiceLineInput = {
  description: string
  quantity: Prisma.Decimal
  unitPrice: Prisma.Decimal
  lineType?: "USAGE" | "SUBSCRIPTION"
}

export type ServiceBalanceInput = BalanceMutationInput & {
  line: ServiceLineInput
}

const MAX_BALANCE = new Prisma.Decimal("999999999.99")

export class BillingTransactionService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Credit balance from top-up, admin adjustment, or manual transfer approval.
   * Idempotent — returns alreadyProcessed=true if the same idempotencyKey exists.
   */
  async creditBalance(input: BalanceMutationInput): Promise<BalanceMutationResult> {
    return this.mutateBalance(input, "CREDIT")
  }

  /**
   * Debit balance for product charges (App Hosting, WhatsApp, VPN, etc.).
   * Idempotent — returns alreadyProcessed=true if the same idempotencyKey exists.
   */
  async debitBalance(input: BalanceMutationInput): Promise<BalanceMutationResult> {
    return this.mutateBalance(input, "DEBIT")
  }

  /**
   * Debit balance AND attach a line to the current month's service invoice.
   * Creates a DRAFT service invoice if none exists for the current month.
   */
  async debitServiceBalance(
    input: ServiceBalanceInput,
  ): Promise<BalanceMutationResult> {
    return this.prisma.$transaction(async (tx) => {
      const account = await tx.billingAccount.findUnique({
        where: { organizationId: input.organizationId },
      })
      if (!account) throw new Error("BILLING_ACCOUNT_NOT_FOUND")
      if (account.currency !== input.currency) throw new Error("CURRENCY_MISMATCH")

      // Create or reuse current-month service invoice
      const invoice = await this.ensureMonthlyServiceInvoice(tx, account.id, account.currency)

      // Guard: reject adding lines to finalized/paid invoices
      if (invoice.status !== "DRAFT") {
        throw new Error("INVOICE_ALREADY_FINALIZED")
      }

      // Add invoice line
      const line = await tx.invoiceLine.create({
        data: {
          invoiceId: invoice.id,
          lineType: input.line.lineType === "SUBSCRIPTION" ? "SUBSCRIPTION" : "METERED",
          description: input.line.description,
          quantity: input.line.quantity,
          unitPrice: input.line.unitPrice,
          amount: input.amount,
          currency: account.currency,
          periodStart: invoice.periodStart,
          periodEnd: invoice.periodEnd,
          metadataJson: {
            source: input.source,
            idempotencyKey: input.idempotencyKey,
          },
        },
      })

      // Update invoice totals
      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          subtotalAmount: { increment: input.amount },
          totalAmount: { increment: input.amount },
        },
      })

      // Perform the balance debit
      return this.executeMutation(
        tx,
        account,
        input,
        "DEBIT",
        invoice.id,
        line.id,
      )
    })
  }

  // ─── Private ────────────────────────────────────────────────────────────

  private async mutateBalance(
    input: BalanceMutationInput,
    direction: "CREDIT" | "DEBIT",
  ): Promise<BalanceMutationResult> {
    return this.prisma.$transaction(async (tx) => {
      const account = await tx.billingAccount.findUnique({
        where: { organizationId: input.organizationId },
      })
      if (!account) throw new Error("BILLING_ACCOUNT_NOT_FOUND")
      if (account.currency !== input.currency) throw new Error("CURRENCY_MISMATCH")

      // Idempotency check — idempotencyKey is stored under _internal to avoid leaking into user-facing API responses
      const existing = await tx.billingAdjustment.findFirst({
        where: {
          billingAccountId: account.id,
          metadataJson: {
            path: ["_internal", "idempotencyKey"],
            equals: input.idempotencyKey,
          },
        },
      })
      if (existing) {
        return {
          billingAccountId: account.id,
          adjustmentId: existing.id,
          balanceBefore: account.balance,
          balanceAfter: account.balance,
          amount: input.amount,
          currency: account.currency,
          alreadyProcessed: true,
        }
      }

      return this.executeMutation(
        tx,
        account,
        input,
        direction,
        input.invoiceId,
        input.invoiceLineId,
      )
    })
  }

  private async executeMutation(
    tx: TxClient,
    account: {
      id: string
      balance: Prisma.Decimal
      currency: string
    },
    input: BalanceMutationInput,
    direction: "CREDIT" | "DEBIT",
    invoiceId?: string,
    invoiceLineId?: string,
  ): Promise<BalanceMutationResult> {
    const balanceBefore = account.balance
    const balanceAfter =
      direction === "CREDIT"
        ? balanceBefore.plus(input.amount)
        : balanceBefore.minus(input.amount)

    if (balanceAfter.lt(0)) throw new Error("INSUFFICIENT_BALANCE")
    if (balanceAfter.gt(MAX_BALANCE)) throw new Error("BALANCE_LIMIT_EXCEEDED")

    const updated = await tx.billingAccount.update({
      where: { id: account.id },
      data: { balance: balanceAfter },
    })

    const adjustment = await tx.billingAdjustment.create({
      data: {
        billingAccountId: account.id,
        invoiceId: invoiceId ?? null,
        adjustmentType: direction,
        amount: input.amount,
        currency: input.currency,
        reason: input.reason,
        appliedAt: new Date(),
        metadataJson: {
          ...input.metadata,
          source: input.source,
          invoiceLineId: invoiceLineId ?? null,
          balanceBefore: balanceBefore.toString(),
          balanceAfter: balanceAfter.toString(),
          // Internal fields — not exposed in user-facing API responses
          _internal: { idempotencyKey: input.idempotencyKey },
        },
      },
    })

    return {
      billingAccountId: account.id,
      adjustmentId: adjustment.id,
      balanceBefore,
      balanceAfter: updated.balance,
      amount: input.amount,
      currency: input.currency,
      alreadyProcessed: false,
    }
  }

  private async ensureMonthlyServiceInvoice(
    tx: TxClient,
    billingAccountId: string,
    currency: string,
  ) {
    const now = new Date()
    const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    const periodEnd = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999),
    )

    // Look for existing DRAFT service invoice for this period
    const existing = await tx.invoice.findFirst({
      where: {
        billingAccountId,
        type: "SERVICE",
        status: "DRAFT",
        periodStart: { gte: periodStart },
        periodEnd: { lte: periodEnd },
      },
    })
    if (existing) return existing

    // Generate invoice number: SVC-YYYYMM-NNNN
    const periodStr = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}`
    const count = await tx.invoice.count({
      where: {
        invoiceNumber: { startsWith: `SVC-${periodStr}` },
      },
    })
    const invoiceNumber = `SVC-${periodStr}-${String(count + 1).padStart(4, "0")}`

    return tx.invoice.create({
      data: {
        billingAccountId,
        invoiceNumber,
        type: "SERVICE",
        status: "DRAFT",
        currency,
        periodStart,
        periodEnd,
        subtotalAmount: new Prisma.Decimal(0),
        taxAmount: new Prisma.Decimal(0),
        discountAmount: new Prisma.Decimal(0),
        totalAmount: new Prisma.Decimal(0),
      },
    })
  }
}
