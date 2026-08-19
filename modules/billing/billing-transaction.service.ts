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
  invoiceId: string | null
  invoiceLineId: string | null
}

export type ServiceLineInput = {
  description: string
  quantity: Prisma.Decimal
  unitPrice: Prisma.Decimal
  lineType?: "USAGE" | "SUBSCRIPTION"
  /** Exact subscription coverage dates (e.g. for upfront pro-rata/quarterly terms). */
  periodStart?: Date
  periodEnd?: Date
  /** Category for grouped invoice display (e.g. "vpn", "app-hosting", "whatsapp"). */
  category?: string
}

export type ServiceBalanceInput = BalanceMutationInput & {
  line: ServiceLineInput
}

const MAX_BALANCE = new Prisma.Decimal("999999999.99")

/**
 * Infer line category from description for grouping in invoice display.
 * Used as fallback when no explicit category is provided.
 */
function inferCategory(description: string): string {
  if (/^VPN package/.test(description)) return "vpn"
  if (/^App Hosting/.test(description)) return "app-hosting"
  if (/^WhatsApp/.test(description)) return "whatsapp"
  return "other"
}

export class BillingTransactionService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Credit balance from top-up, admin adjustment, or manual transfer approval.
   * Idempotent — returns alreadyProcessed=true if the same idempotencyKey exists.
   */
  async creditBalance(
    input: BalanceMutationInput,
    transactionClient: PrismaClient | TxClient = this.prisma
  ): Promise<BalanceMutationResult> {
    return this.mutateBalance(input, "CREDIT", transactionClient)
  }

  /**
   * Debit balance for product charges (App Hosting, WhatsApp, VPN, etc.).
   * Idempotent — returns alreadyProcessed=true if the same idempotencyKey exists.
   */
  async debitBalance(
    input: BalanceMutationInput
  ): Promise<BalanceMutationResult> {
    return this.mutateBalance(input, "DEBIT")
  }

  /**
   * Debit balance for an upfront subscription order and create an instant PAID invoice.
   * Stamped with exact coverage dates and paymentMethod = "BALANCE".
   */
  async debitUpfrontSubscription(
    input: ServiceBalanceInput,
    transactionClient: PrismaClient | TxClient = this.prisma
  ): Promise<BalanceMutationResult> {
    const run = async (tx: PrismaClient | TxClient) => {
      const account = await tx.billingAccount.findUnique({
        where: { organizationId: input.organizationId },
      })
      if (!account) throw new Error("BILLING_ACCOUNT_NOT_FOUND")
      if (account.currency !== input.currency)
        throw new Error("CURRENCY_MISMATCH")

      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM "BillingAccount" WHERE id = ${account.id} FOR UPDATE`
      )
      const lockedAccount = await tx.billingAccount.findUnique({
        where: { id: account.id },
      })
      if (!lockedAccount) throw new Error("BILLING_ACCOUNT_NOT_FOUND")
      if (lockedAccount.currency !== input.currency)
        throw new Error("CURRENCY_MISMATCH")

      const existing = await tx.billingAdjustment.findFirst({
        where: {
          billingAccountId: lockedAccount.id,
          metadataJson: {
            path: ["_internal", "idempotencyKey"],
            equals: input.idempotencyKey,
          },
        },
      })
      if (existing) {
        const metadata = (existing.metadataJson ?? {}) as {
          invoiceLineId?: unknown
        }
        return {
          billingAccountId: lockedAccount.id,
          adjustmentId: existing.id,
          balanceBefore: lockedAccount.balance,
          balanceAfter: lockedAccount.balance,
          amount: input.amount,
          currency: lockedAccount.currency,
          alreadyProcessed: true,
          invoiceId: existing.invoiceId ?? null,
          invoiceLineId:
            typeof metadata.invoiceLineId === "string"
              ? metadata.invoiceLineId
              : null,
        }
      }

      const now = new Date()
      const periodStart = input.line.periodStart ?? now
      const periodEnd = input.line.periodEnd ?? now
      const dateStr = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}`
      const randomSuffix = Math.random().toString(36).slice(2, 6).toUpperCase()
      const invoiceNumber = `INV-${dateStr}-${randomSuffix}`

      const invoice = await tx.billingInvoice.create({
        data: {
          billingAccountId: lockedAccount.id,
          invoiceNumber,
          type: "SERVICE",
          status: "PAID",
          paymentMethod: "BALANCE",
          currency: lockedAccount.currency,
          periodStart,
          periodEnd,
          issuedAt: now,
          paidAt: now,
          subtotalAmount: input.amount,
          taxAmount: new Prisma.Decimal(0),
          discountAmount: new Prisma.Decimal(0),
          totalAmount: input.amount,
          metadataJson: {
            isUpfront: true,
            orderId:
              typeof (input.metadata as Record<string, unknown> | undefined)
                ?.orderId === "string"
                ? ((input.metadata as Record<string, unknown>)
                    .orderId as string)
                : undefined,
          },
        },
      })

      const line = await tx.billingInvoiceLine.create({
        data: {
          invoiceId: invoice.id,
          lineType: "SUBSCRIPTION",
          description: input.line.description,
          quantity: input.line.quantity,
          unitPrice: input.line.unitPrice,
          amount: input.amount,
          currency: lockedAccount.currency,
          periodStart,
          periodEnd,
          metadataJson: {
            source: input.source,
            category:
              input.line.category ?? inferCategory(input.line.description),
            _internal: { idempotencyKey: input.idempotencyKey },
          },
        },
      })

      return this.executeMutation(
        tx,
        lockedAccount,
        input,
        "DEBIT",
        invoice.id,
        line.id
      )
    }

    if (transactionClient === this.prisma) {
      return this.prisma.$transaction(run)
    }
    return run(transactionClient)
  }

  /**
   * Debit balance AND attach a line to the current month's service invoice.
   * Creates a DRAFT service invoice if none exists for the current month.
   *
   * Accepts an optional transaction client to join an outer transaction.
   * When omitted, runs its own $transaction (same behavior as before).
   */
  async debitServiceBalance(
    input: ServiceBalanceInput,
    transactionClient: PrismaClient | TxClient = this.prisma
  ): Promise<BalanceMutationResult> {
    const run = async (tx: PrismaClient | TxClient) => {
      const account = await tx.billingAccount.findUnique({
        where: { organizationId: input.organizationId },
      })
      if (!account) throw new Error("BILLING_ACCOUNT_NOT_FOUND")
      if (account.currency !== input.currency)
        throw new Error("CURRENCY_MISMATCH")

      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM "BillingAccount" WHERE id = ${account.id} FOR UPDATE`
      )
      const lockedAccount = await tx.billingAccount.findUnique({
        where: { id: account.id },
      })
      if (!lockedAccount) throw new Error("BILLING_ACCOUNT_NOT_FOUND")
      if (lockedAccount.currency !== input.currency)
        throw new Error("CURRENCY_MISMATCH")

      const existing = await tx.billingAdjustment.findFirst({
        where: {
          billingAccountId: lockedAccount.id,
          metadataJson: {
            path: ["_internal", "idempotencyKey"],
            equals: input.idempotencyKey,
          },
        },
      })
      if (existing) {
        const metadata = (existing.metadataJson ?? {}) as {
          invoiceLineId?: unknown
        }
        return {
          billingAccountId: lockedAccount.id,
          adjustmentId: existing.id,
          balanceBefore: lockedAccount.balance,
          balanceAfter: lockedAccount.balance,
          amount: input.amount,
          currency: lockedAccount.currency,
          alreadyProcessed: true,
          invoiceId: existing.invoiceId ?? null,
          invoiceLineId:
            typeof metadata.invoiceLineId === "string"
              ? metadata.invoiceLineId
              : null,
        }
      }

      const invoice = await this.ensureMonthlyServiceInvoice(
        tx,
        lockedAccount.id,
        lockedAccount.currency
      )
      if (invoice.status !== "DRAFT") {
        throw new Error("INVOICE_ALREADY_FINALIZED")
      }

      const line = await tx.billingInvoiceLine.create({
        data: {
          invoiceId: invoice.id,
          lineType:
            input.line.lineType === "SUBSCRIPTION" ? "SUBSCRIPTION" : "METERED",
          description: input.line.description,
          quantity: input.line.quantity,
          unitPrice: input.line.unitPrice,
          amount: input.amount,
          currency: lockedAccount.currency,
          periodStart: input.line.periodStart ?? invoice.periodStart,
          periodEnd: input.line.periodEnd ?? invoice.periodEnd,
          metadataJson: {
            source: input.source,
            category:
              input.line.category ?? inferCategory(input.line.description),
            _internal: { idempotencyKey: input.idempotencyKey },
          },
        },
      })

      await tx.billingInvoice.update({
        where: { id: invoice.id },
        data: {
          subtotalAmount: { increment: input.amount },
          totalAmount: { increment: input.amount },
        },
      })

      return this.executeMutation(
        tx,
        lockedAccount,
        input,
        "DEBIT",
        invoice.id,
        line.id
      )
    }

    if (transactionClient === this.prisma) {
      return this.prisma.$transaction(run)
    }
    return run(transactionClient)
  }

  // ─── Private ────────────────────────────────────────────────────────────

  private async mutateBalance(
    input: BalanceMutationInput,
    direction: "CREDIT" | "DEBIT",
    transactionClient: PrismaClient | TxClient = this.prisma
  ): Promise<BalanceMutationResult> {
    const run = async (tx: PrismaClient | TxClient) => {
      const account = await tx.billingAccount.findUnique({
        where: { organizationId: input.organizationId },
      })
      if (!account) throw new Error("BILLING_ACCOUNT_NOT_FOUND")
      if (account.currency !== input.currency)
        throw new Error("CURRENCY_MISMATCH")

      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM "BillingAccount" WHERE id = ${account.id} FOR UPDATE`
      )
      const lockedAccount = await tx.billingAccount.findUnique({
        where: { id: account.id },
      })
      if (!lockedAccount) throw new Error("BILLING_ACCOUNT_NOT_FOUND")
      if (lockedAccount.currency !== input.currency)
        throw new Error("CURRENCY_MISMATCH")

      const existing = await tx.billingAdjustment.findFirst({
        where: {
          billingAccountId: lockedAccount.id,
          metadataJson: {
            path: ["_internal", "idempotencyKey"],
            equals: input.idempotencyKey,
          },
        },
      })
      if (existing) {
        return {
          billingAccountId: lockedAccount.id,
          adjustmentId: existing.id,
          balanceBefore: lockedAccount.balance,
          balanceAfter: lockedAccount.balance,
          amount: input.amount,
          currency: lockedAccount.currency,
          alreadyProcessed: true,
          invoiceId: existing.invoiceId ?? null,
          invoiceLineId: null,
        }
      }

      return this.executeMutation(
        tx,
        lockedAccount,
        input,
        direction,
        input.invoiceId,
        input.invoiceLineId
      )
    }

    if (transactionClient === this.prisma) {
      return this.prisma.$transaction(run)
    }
    return run(transactionClient)
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
    invoiceLineId?: string
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
      invoiceId: invoiceId ?? null,
      invoiceLineId: invoiceLineId ?? null,
    }
  }

  private async ensureMonthlyServiceInvoice(
    tx: TxClient,
    billingAccountId: string,
    currency: string
  ) {
    const now = new Date()
    const periodStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
    )
    const periodEnd = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999)
    )

    // Look for existing DRAFT service invoice for this period
    const existing = await tx.billingInvoice.findFirst({
      where: {
        billingAccountId,
        type: "SERVICE",
        status: "DRAFT",
        periodStart: { gte: periodStart },
        periodEnd: { lte: periodEnd },
      },
    })
    if (existing) return existing

    // Generate invoice number: SVC-YYYYMM
    // One service invoice per month per org, so no sequential counter needed.
    const periodStr = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}`
    const invoiceNumber = `SVC-${periodStr}`

    return tx.billingInvoice.create({
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
