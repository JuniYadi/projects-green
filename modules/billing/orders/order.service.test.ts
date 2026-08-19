import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Prisma } from "@prisma/client"
import type { PrismaClient } from "@prisma/client"
import type { BillingFulfillmentInput } from "./fulfillment-adapters"
import { RecurringPriceResolutionError } from "../pricing/pricing.types"

const mockPrisma = {
  $transaction: mock(),
  $executeRaw: mock(),
  billingAccount: { findUnique: mock() },
  billingOrder: {
    findUnique: mock(),
    create: mock(),
    update: mock(),
  },
  billingOrderLine: { create: mock() },
  serviceSubscription: {
    findUnique: mock(),
    update: mock(),
  },
  servicePlan: {
    findFirst: mock<() => Promise<unknown>>(async () => null),
    findUnique: mock<() => Promise<unknown>>(async () => null),
    update: mock(),
  },
  whatsappDevice: { count: mock() },
  billingInvoice: { findUnique: mock() },
  voucher: {
    findUnique: mock<() => Promise<unknown>>(async () => null),
    update: mock(),
    updateMany: mock(),
  },
  voucherClaim: {
    findFirst: mock<() => Promise<unknown>>(async () => null),
    create: mock(),
  },
}
const mockResolveRecurringPrice = mock()
const mockDebitServiceBalance = mock()

const mockResolveInvoiceEmailRecipients = mock(async () => [
  { email: "billing@example.com" },
])

mock.module("../email-recipients", () => ({
  resolveInvoiceEmailRecipients: mockResolveInvoiceEmailRecipients,
}))
mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }))
mock.module("../pricing/pricing.service", () => ({
  resolveRecurringPrice: mockResolveRecurringPrice,
  RecurringPriceResolutionError,
}))
mock.module("../billing-transaction.service", () => ({
  BillingTransactionService: class {
    debitServiceBalance = mockDebitServiceBalance
    debitUpfrontSubscription = mockDebitServiceBalance
  },
}))

const { BillingOrderService } = await import("./order.service")
const { BillingFulfillmentRegistry, createAppHostingFulfillmentAdapter } =
  await import("./fulfillment-adapters")

const decimal = (value: string) => new Prisma.Decimal(value)
const periodStart = new Date("2026-08-01T00:00:00.000Z")
const periodEnd = new Date("2026-09-01T00:00:00.000Z")
const pricing = {
  pricingId: "pricing-1",
  packageCode: "VPN" as const,
  planId: "plan-1",
  planCode: "plan-code",
  regionCode: "ID",
  billingPeriod: "MONTHLY" as const,
  periodMonths: 1 as const,
  chargeUnit: "SUBSCRIPTION" as const,
  periodPrice: decimal("100.00"),
  currency: "IDR",
  effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
  effectiveTo: null,
}
const appHostingPricing = {
  ...pricing,
  packageCode: "APP_HOSTING" as const,
}
const account = { id: "account-1", currency: "IDR" }
const appHostingContext = {
  stackId: "stack-1",
  deploymentId: "deployment-1",
  sourceType: "GITHUB" as const,
  resourcePlanId: "pro" as const,
}

function orderFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "order-1",
    organizationId: "org-1",
    billingAccountId: "account-1",
    serviceSubscriptionId: null,
    billingInvoiceId: null,
    status: "PENDING",
    currency: "IDR",
    subtotalAmount: decimal("100.00"),
    totalAmount: decimal("100.00"),
    idempotencyKey: "order-key-1",
    chargedAt: null,
    fulfilledAt: null,
    metadataJson: {},
    createdAt: periodStart,
    updatedAt: periodStart,
    lines: [
      {
        id: "line-1",
        pricingId: "pricing-1",
        packageCode: "VPN",
        planCode: "plan-code",
        regionCode: "ID",
        billingPeriod: "MONTHLY",
        chargeUnit: "SUBSCRIPTION",
        quantity: decimal("1"),
        unitPrice: decimal("100.00"),
        amount: decimal("100.00"),
        currency: "IDR",
        periodStart,
        periodEnd,
        metadataJson: {},
      },
    ],
    ...overrides,
  }
}

const adapter = {
  packageCode: "VPN" as const,
  create: mock(
    async (
      _input: BillingFulfillmentInput,
      _transactionClient?: Prisma.TransactionClient
    ) => ({ subscriptionId: "subscription-1" })
  ),
  renew: mock(
    async (
      _input: BillingFulfillmentInput,
      _transactionClient?: Prisma.TransactionClient
    ) => {}
  ),
}
const appHostingAdapter = {
  packageCode: "APP_HOSTING" as const,
  create: mock(
    async (
      _input: BillingFulfillmentInput,
      _transactionClient?: Prisma.TransactionClient
    ) => ({ subscriptionId: "app-hosting-subscription-1" })
  ),
  renew: mock(
    async (
      _input: BillingFulfillmentInput,
      _transactionClient?: Prisma.TransactionClient
    ) => {}
  ),
}

beforeEach(() => {
  mockResolveRecurringPrice.mockReset()
  for (const model of Object.values(mockPrisma)) {
    if (typeof model === "function") model.mockReset()
    else if (model && typeof model === "object") {
      for (const fn of Object.values(model)) fn.mockReset()
    }
  }
  adapter.create.mockReset()
  adapter.renew.mockReset()
  appHostingAdapter.create.mockReset()
  appHostingAdapter.renew.mockReset()
  adapter.create.mockResolvedValue({ subscriptionId: "subscription-1" })
  appHostingAdapter.create.mockResolvedValue({
    subscriptionId: "app-hosting-subscription-1",
  })
  mockDebitServiceBalance.mockReset()
  mockPrisma.$executeRaw.mockResolvedValue(0)
  mockResolveRecurringPrice.mockResolvedValue(pricing)
  mockPrisma.$transaction.mockImplementation(
    async (fn: (tx: unknown) => unknown) => fn(mockPrisma)
  )
  mockPrisma.billingAccount.findUnique.mockResolvedValue(account)
  mockPrisma.billingOrder.findUnique.mockResolvedValue(null)
  mockPrisma.billingOrder.create.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => {
      const lines = data.lines as { create: Record<string, unknown> }
      return orderFixture({
        ...data,
        id: "order-1",
        lines: [{ ...orderFixture().lines[0], ...lines.create }],
      })
    }
  )
  mockPrisma.billingOrder.update.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) =>
      orderFixture({ ...data, status: data.status ?? "PENDING" })
  )
  mockDebitServiceBalance.mockResolvedValue({
    billingAccountId: "account-1",
    adjustmentId: "adjustment-1",
    balanceBefore: decimal("500.00"),
    balanceAfter: decimal("400.00"),
    amount: decimal("100.00"),
    currency: "IDR",
    alreadyProcessed: false,
    invoiceId: "invoice-1",
    invoiceLineId: "invoice-line-1",
  })
})

describe("BillingOrderService", () => {
  it("creates one immutable pending order line snapshot", async () => {
    const service = new BillingOrderService(
      mockPrisma as unknown as PrismaClient,
      undefined,
      new BillingFulfillmentRegistry([adapter])
    )

    const result = await service.createOrder({
      organizationId: "org-1",
      pricingId: "pricing-1",
      idempotencyKey: "order-key-1",
      metadata: { source: "test" },
      now: periodStart,
    })

    expect(result.status).toBe("PENDING")
    expect(result.amount).toBe("100")
    expect(mockPrisma.billingOrder.create).toHaveBeenCalledTimes(1)
    expect(mockPrisma.billingOrderLine.create).not.toHaveBeenCalled()
    expect(
      mockPrisma.billingOrder.create.mock.calls[0][0].data.lines.create
    ).toMatchObject({
      pricingId: "pricing-1",
      unitPrice: decimal("100"),
      amount: decimal("100"),
      billingPeriod: "MONTHLY",
    })
  })

  it("sanitizes App Hosting order metadata to the typed deployment context", async () => {
    mockResolveRecurringPrice.mockResolvedValue(appHostingPricing)
    const service = new BillingOrderService(
      mockPrisma as unknown as PrismaClient,
      undefined,
      new BillingFulfillmentRegistry([appHostingAdapter])
    )

    await service.createOrder({
      organizationId: "org-1",
      pricingId: "pricing-1",
      idempotencyKey: "app-hosting-order",
      metadata: {
        appHostingFulfillment: appHostingContext,
        credentials: { token: "secret" },
      },
      now: periodStart,
    })

    const data = mockPrisma.billingOrder.create.mock.calls[0][0].data
    expect(data.metadataJson).toEqual({
      appHostingFulfillment: appHostingContext,
    })
    expect(data.lines.create.metadataJson).toEqual({
      appHostingFulfillment: appHostingContext,
      planId: "plan-1",
    })
  })

  it("persists a discounted first payment without changing the locked price", async () => {
    const service = new BillingOrderService(
      mockPrisma as unknown as PrismaClient,
      undefined,
      new BillingFulfillmentRegistry([adapter])
    )

    await service.createOrder({
      organizationId: "org-1",
      pricingId: "pricing-1",
      discountAmount: decimal("10.00"),
      voucherId: "voucher-1",
      voucherCode: "SAVE10",
      voucherCurrency: "IDR",
      voucherExchangeRate: decimal("1"),
      idempotencyKey: "discounted-order",
      now: periodStart,
    })

    expect(mockPrisma.billingOrder.create.mock.calls[0][0].data).toMatchObject({
      subtotalAmount: decimal("100"),
      discountAmount: decimal("10"),
      totalAmount: decimal("90"),
    })
    expect(mockPrisma.billingOrder.create.mock.calls[0][0].data).toMatchObject({
      voucherId: "voucher-1",
      voucherCode: "SAVE10",
      voucherCurrency: "IDR",
      voucherExchangeRate: decimal("1"),
    })
  })
  it("prorates a monthly first order while locking the full period price", async () => {
    mockResolveRecurringPrice.mockResolvedValue({
      ...pricing,
      periodPrice: decimal("100000"),
    })
    const service = new BillingOrderService(
      mockPrisma as unknown as PrismaClient,
      undefined,
      new BillingFulfillmentRegistry([adapter])
    )
    const start = new Date("2026-06-14T00:00:00.000Z")

    const result = await service.createOrder({
      organizationId: "org-1",
      pricingId: "pricing-1",
      idempotencyKey: "vpn-prorated-order",
      now: start,
      prorateMonthly: true,
    })

    expect(result.amount).toBe("56666.666666666666667")
    expect(
      mockPrisma.billingOrder.create.mock.calls[0][0].data.lines.create
    ).toMatchObject({
      unitPrice: decimal("100000"),
      periodStart: start,
      periodEnd: new Date("2026-06-30T23:59:59.999Z"),
    })
  })
  it("rejects an unregistered product before creating an order", async () => {
    mockResolveRecurringPrice.mockResolvedValue({
      ...pricing,
      packageCode: "APP_HOSTING",
    })
    const service = new BillingOrderService(
      mockPrisma as unknown as PrismaClient,
      undefined,
      new BillingFulfillmentRegistry([adapter])
    )

    await expect(
      service.createOrder({
        organizationId: "org-1",
        pricingId: "hosting-pricing",
        idempotencyKey: "unsupported-product-order",
      })
    ).rejects.toThrow("FULFILLMENT_NOT_CONFIGURED")
    expect(mockPrisma.billingOrder.create).not.toHaveBeenCalled()
  })

  it("returns the original order for a duplicate idempotency key", async () => {
    mockPrisma.billingOrder.findUnique.mockResolvedValue(orderFixture())
    const service = new BillingOrderService(
      mockPrisma as unknown as PrismaClient
    )

    const result = await service.createOrder({
      organizationId: "org-1",
      pricingId: "pricing-1",
      idempotencyKey: "order-key-1",
    })

    expect(result.orderId).toBe("order-1")
    expect(mockPrisma.billingOrder.create).not.toHaveBeenCalled()
    expect(mockResolveRecurringPrice).not.toHaveBeenCalled()
  })
  it("returns the existing order when a concurrent create wins the unique key", async () => {
    const existing = orderFixture()
    const uniqueError = Object.assign(new Error("unique"), {
      code: "P2002",
      meta: { target: ["idempotencyKey"] },
    })
    mockPrisma.billingOrder.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existing)
    mockPrisma.billingOrder.create.mockRejectedValueOnce(uniqueError)
    const service = new BillingOrderService(
      mockPrisma as unknown as PrismaClient
    )

    const result = await service.createOrder({
      organizationId: "org-1",
      pricingId: "pricing-1",
      idempotencyKey: "order-key-1",
    })

    expect(result.orderId).toBe(existing.id)
    expect(mockPrisma.billingOrder.create).toHaveBeenCalledTimes(1)
  })

  it("requires positive subscription quantity and exact active-device quantity", async () => {
    const service = new BillingOrderService(
      mockPrisma as unknown as PrismaClient
    )
    await expect(
      service.createOrder({
        organizationId: "org-1",
        pricingId: "pricing-1",
        quantity: decimal("0"),
        idempotencyKey: "zero",
      })
    ).rejects.toThrow("INVALID_QUANTITY")

    mockResolveRecurringPrice.mockResolvedValue({
      ...pricing,
      chargeUnit: "DEVICE",
    })
    mockPrisma.whatsappDevice.count.mockResolvedValue(2)
    await expect(
      service.createOrder({
        organizationId: "org-1",
        pricingId: "pricing-1",
        quantity: decimal("1"),
        idempotencyKey: "wrong-device-count",
      })
    ).rejects.toThrow("INVALID_QUANTITY")
  })

  it("passes invoice IDs through charge and preserves them in the result", async () => {
    mockPrisma.billingOrder.findUnique.mockResolvedValue(orderFixture())
    mockPrisma.billingOrder.update.mockResolvedValue(
      orderFixture({ status: "CHARGED", billingInvoiceId: "invoice-1" })
    )
    const service = new BillingOrderService(
      mockPrisma as unknown as PrismaClient
    )

    const result = await service.chargeOrder("order-1")

    expect(result.status).toBe("CHARGED")
    expect(result.invoiceId).toBe("invoice-1")
    expect(result.invoiceLineId).toBe("invoice-line-1")
    expect(mockDebitServiceBalance).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "VPN",
        idempotencyKey: "order-key-1",
        amount: decimal("100"),
        line: expect.objectContaining({ lineType: "SUBSCRIPTION" }),
      })
    )
  })

  it("dispatches sendInvoicePaid email receipt when emailService is provided", async () => {
    mockPrisma.billingOrder.findUnique.mockResolvedValue(orderFixture())
    mockPrisma.billingOrder.update.mockResolvedValue(
      orderFixture({ status: "CHARGED", billingInvoiceId: "invoice-1" })
    )
    mockPrisma.billingInvoice = {
      findUnique: mock(async () => ({ invoiceNumber: "INV-20260819-0001" })),
    }
    mockPrisma.billingAccount.findUnique.mockResolvedValue({
      ...account,
      contacts: [{ email: "billing@example.com", name: "Billing Manager" }],
    })

    const { promise, resolve } = Promise.withResolvers<void>()
    const mockSendInvoicePaid = mock(async () => {
      resolve()
    })
    const emailService = {
      sendInvoicePaid: mockSendInvoicePaid,
    }

    const service = new BillingOrderService(
      mockPrisma as unknown as PrismaClient,
      { emailService: emailService as never }
    )

    await service.chargeOrder("order-1")
    await promise

    expect(mockSendInvoicePaid).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "invoice-1",
        invoiceNumber: "INV-20260819-0001",
        status: "paid",
        totalAmount: 100,
        currency: "IDR",
      }),
      "billing@example.com",
      "org-1"
    )
  })

  it("handles and logs email send errors gracefully without failing chargeOrder", async () => {
    mockPrisma.billingOrder.findUnique.mockResolvedValue(orderFixture())
    mockPrisma.billingOrder.update.mockResolvedValue(
      orderFixture({ status: "CHARGED", billingInvoiceId: "invoice-1" })
    )
    mockPrisma.billingInvoice = {
      findUnique: mock(async () => ({ invoiceNumber: "INV-20260819-0001" })),
    }
    mockPrisma.billingAccount.findUnique.mockResolvedValue({
      ...account,
      contacts: [{ email: "billing@example.com", name: "Billing Manager" }],
    })

    const { promise, resolve } = Promise.withResolvers<void>()
    const mockSendInvoicePaid = mock(async () => {
      resolve()
      throw new Error("SMTP service unavailable")
    })
    const emailService = {
      sendInvoicePaid: mockSendInvoicePaid,
    }

    const service = new BillingOrderService(
      mockPrisma as unknown as PrismaClient,
      { emailService: emailService as never }
    )
    const result = await service.chargeOrder("order-1")
    expect(result.status).toBe("CHARGED")

    await promise
    expect(mockSendInvoicePaid).toHaveBeenCalled()
  })

  it("catches and logs errors when resolveInvoiceEmailRecipients rejects", async () => {
    mockPrisma.billingOrder.findUnique.mockResolvedValue(orderFixture())
    mockPrisma.billingOrder.update.mockResolvedValue(
      orderFixture({ status: "CHARGED", billingInvoiceId: "invoice-1" })
    )
    mockResolveInvoiceEmailRecipients.mockRejectedValueOnce(
      new Error("Recipient resolution failed")
    )

    const consoleSpy = mock()
    const originalError = console.error
    console.error = consoleSpy

    const { promise, resolve } = Promise.withResolvers<void>()
    consoleSpy.mockImplementation(() => {
      resolve()
    })

    const service = new BillingOrderService(
      mockPrisma as unknown as PrismaClient,
      { emailService: { sendInvoicePaid: mock() } as never }
    )

    const result = await service.chargeOrder("order-1")
    expect(result.status).toBe("CHARGED")

    await promise
    console.error = originalError
    expect(consoleSpy).toHaveBeenCalled()
  })

  it("marks failed fulfillment without deleting the paid order or invoice", async () => {
    adapter.create.mockRejectedValueOnce(new Error("provisioning failed"))
    mockPrisma.billingOrder.findUnique.mockResolvedValue(
      orderFixture({ status: "CHARGED", billingInvoiceId: "invoice-1" })
    )
    mockPrisma.billingOrder.update.mockResolvedValue(
      orderFixture({ status: "FAILED", billingInvoiceId: "invoice-1" })
    )
    const service = new BillingOrderService(
      mockPrisma as unknown as PrismaClient,
      undefined,
      new BillingFulfillmentRegistry([adapter])
    )

    await expect(service.fulfillOrder("order-1")).rejects.toThrow(
      "provisioning failed"
    )
    expect(mockPrisma.billingOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "order-1" },
        data: expect.objectContaining({
          status: "FAILED",
          metadataJson: {
            fulfillmentFailure: {
              code: "FULFILLMENT_FAILED",
              message: "provisioning failed",
              retryable: true,
            },
          },
        }),
      })
    )
  })
  it("persists a typed App Hosting failure without changing payment metadata", async () => {
    mockPrisma.billingOrder.findUnique.mockResolvedValue(
      orderFixture({
        status: "CHARGED",
        billingInvoiceId: "invoice-1",
        metadataJson: { invoiceLineId: "invoice-line-1" },
        lines: [
          {
            ...orderFixture().lines[0],
            packageCode: "APP_HOSTING",
            metadataJson: {
              appHostingFulfillment: null,
              planId: "plan-1",
            },
          },
        ],
      })
    )
    const service = new BillingOrderService(
      mockPrisma as unknown as PrismaClient,
      undefined,
      new BillingFulfillmentRegistry([
        createAppHostingFulfillmentAdapter(
          mockPrisma as unknown as PrismaClient
        ),
      ])
    )

    await expect(service.fulfillOrder("order-1")).rejects.toMatchObject({
      name: "AppHostingFulfillmentError",
      failure: {
        code: "APP_HOSTING_FULFILLMENT_CONTEXT_INVALID",
        retryable: false,
      },
    })
    expect(mockPrisma.billingOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "FAILED",
          metadataJson: {
            invoiceLineId: "invoice-line-1",
            fulfillmentFailure: {
              code: "APP_HOSTING_FULFILLMENT_CONTEXT_INVALID",
              message: expect.any(String),
              retryable: false,
            },
          },
        }),
      })
    )
  })
  it("keeps the paid order and payment history when checkout fulfillment fails", async () => {
    mockPrisma.billingOrder.findUnique
      .mockResolvedValueOnce(orderFixture())
      .mockResolvedValueOnce(
        orderFixture({ status: "CHARGED", billingInvoiceId: "invoice-1" })
      )
    adapter.create.mockRejectedValueOnce(new Error("provisioning failed"))
    const service = new BillingOrderService(
      mockPrisma as unknown as PrismaClient,
      undefined,
      new BillingFulfillmentRegistry([adapter])
    )

    await expect(service.checkoutOrder("order-1")).rejects.toThrow(
      "provisioning failed"
    )
    expect(mockDebitServiceBalance).toHaveBeenCalledTimes(1)
    expect(mockPrisma.billingOrder.update).toHaveBeenCalledTimes(2)
    expect(mockPrisma.billingOrder.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "FAILED" }),
      })
    )
  })
  it("creates a voucher claim and updates voucher status to DEPLETED when maxClaims reached on fulfillOrder", async () => {
    mockPrisma.billingOrder.findUnique.mockResolvedValue(
      orderFixture({
        status: "CHARGED",
        billingInvoiceId: "invoice-1",
        voucherId: "voucher-1",
        discountAmount: decimal("10.00"),
        voucherCurrency: "IDR",
        voucherExchangeRate: decimal("1.0"),
        metadataJson: {
          workosUserId: "user-1",
        },
      })
    )
    mockPrisma.voucherClaim.findFirst.mockResolvedValue(null)
    mockPrisma.voucherClaim.create.mockResolvedValue({ id: "claim-1" })
    mockPrisma.voucher.updateMany.mockResolvedValue({ count: 1 })
    mockPrisma.voucher.findUnique.mockResolvedValue({
      id: "voucher-1",
      claimedCount: 1,
      maxClaims: 1,
    })
    mockPrisma.voucher.update.mockResolvedValue({
      id: "voucher-1",
      status: "DEPLETED",
    })
    mockPrisma.billingOrder.update.mockResolvedValue(
      orderFixture({
        status: "FULFILLED",
        billingInvoiceId: "invoice-1",
        serviceSubscriptionId: "subscription-1",
      })
    )

    const service = new BillingOrderService(
      mockPrisma as unknown as PrismaClient,
      undefined,
      new BillingFulfillmentRegistry([adapter])
    )

    const result = await service.fulfillOrder("order-1")

    expect(result.status).toBe("FULFILLED")
    expect(mockPrisma.voucherClaim.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          voucherId: "voucher-1",
          workosUserId: "user-1",
          organizationId: "org-1",
          orderId: "order-1",
          discountAmount: decimal("10.00"),
          discountCurrency: "IDR",
        }),
      })
    )
    expect(mockPrisma.voucher.updateMany).toHaveBeenCalledWith({
      where: { id: "voucher-1" },
      data: { claimedCount: { increment: 1 } },
    })
    expect(mockPrisma.voucher.update).toHaveBeenCalledWith({
      where: { id: "voucher-1" },
      data: { status: "DEPLETED" },
    })
  })

  it("passes subtotalAmount and discountAmount to debitUpfrontSubscription in chargeOrder", async () => {
    mockPrisma.billingOrder.findUnique.mockResolvedValue(
      orderFixture({
        subtotalAmount: decimal("100.00"),
        discountAmount: decimal("20.00"),
        totalAmount: decimal("80.00"),
      })
    )
    mockPrisma.billingOrder.update.mockResolvedValue(
      orderFixture({ status: "CHARGED", billingInvoiceId: "invoice-1" })
    )
    const service = new BillingOrderService(
      mockPrisma as unknown as PrismaClient
    )

    const result = await service.chargeOrder("order-1")

    expect(result.status).toBe("CHARGED")
    expect(mockDebitServiceBalance).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: decimal("80.00"),
        subtotalAmount: decimal("100.00"),
        discountAmount: decimal("20.00"),
      })
    )
  })
  it("retries a failed paid checkout without charging the order again", async () => {
    const failed = orderFixture({
      status: "FAILED",
      billingInvoiceId: "invoice-1",
      metadataJson: { invoiceLineId: "invoice-line-1" },
    })
    const fulfilled = orderFixture({
      ...failed,
      status: "FULFILLED",
      serviceSubscriptionId: "subscription-1",
    })
    mockPrisma.billingOrder.findUnique
      .mockResolvedValueOnce(failed)
      .mockResolvedValueOnce(failed)
    mockPrisma.billingOrder.update.mockResolvedValue(fulfilled)
    const service = new BillingOrderService(
      mockPrisma as unknown as PrismaClient,
      undefined,
      new BillingFulfillmentRegistry([adapter])
    )

    const result = await service.checkoutOrder("order-1")

    expect(result.status).toBe("FULFILLED")
    expect(mockDebitServiceBalance).not.toHaveBeenCalled()
    expect(adapter.create).toHaveBeenCalledTimes(1)
  })
  it("rejects an unpaid App Hosting order before invoking its adapter", async () => {
    mockPrisma.billingOrder.findUnique.mockResolvedValue(
      orderFixture({
        lines: [
          {
            ...orderFixture().lines[0],
            packageCode: "APP_HOSTING",
            metadataJson: {
              appHostingFulfillment: appHostingContext,
              planId: "plan-1",
            },
          },
        ],
      })
    )
    const service = new BillingOrderService(
      mockPrisma as unknown as PrismaClient,
      undefined,
      new BillingFulfillmentRegistry([appHostingAdapter])
    )

    await expect(service.fulfillOrder("order-1")).rejects.toThrow(
      "ORDER_NOT_CHARGED"
    )
    expect(appHostingAdapter.create).not.toHaveBeenCalled()
    expect(mockPrisma.billingOrder.update).not.toHaveBeenCalled()
  })
  it("does not invoke the App Hosting adapter twice for a fulfilled order", async () => {
    const charged = orderFixture({
      status: "CHARGED",
      billingInvoiceId: "invoice-1",
      lines: [
        {
          ...orderFixture().lines[0],
          packageCode: "APP_HOSTING",
          metadataJson: {
            appHostingFulfillment: appHostingContext,
            planId: "plan-1",
          },
        },
      ],
    })
    const fulfilled = orderFixture({
      ...charged,
      status: "FULFILLED",
      serviceSubscriptionId: "app-hosting-subscription-1",
    })
    mockPrisma.billingOrder.findUnique
      .mockResolvedValueOnce(charged)
      .mockResolvedValueOnce(fulfilled)
    mockPrisma.billingOrder.update.mockResolvedValue(fulfilled)
    const service = new BillingOrderService(
      mockPrisma as unknown as PrismaClient,
      undefined,
      new BillingFulfillmentRegistry([appHostingAdapter])
    )

    await service.fulfillOrder("order-1")
    await service.fulfillOrder("order-1")

    expect(appHostingAdapter.create).toHaveBeenCalledTimes(1)
    expect(mockPrisma.billingOrder.update).toHaveBeenCalledTimes(1)
  })
  it("fails closed when the transaction cannot acquire the advisory lock", async () => {
    const txWithoutLock = { ...mockPrisma, $executeRaw: undefined }
    mockPrisma.$transaction.mockImplementationOnce(
      async (fn: (tx: unknown) => unknown) => fn(txWithoutLock)
    )
    const service = new BillingOrderService(
      mockPrisma as unknown as PrismaClient,
      undefined,
      new BillingFulfillmentRegistry([adapter])
    )

    await expect(service.fulfillOrder("order-1")).rejects.toThrow(
      "ADVISORY_LOCK_UNAVAILABLE"
    )
    expect(mockPrisma.billingOrder.findUnique).not.toHaveBeenCalled()
    expect(adapter.create).not.toHaveBeenCalled()
  })

  it("renews from the locked subscription price instead of resolving catalog price", async () => {
    mockPrisma.serviceSubscription.findUnique.mockResolvedValue({
      id: "subscription-1",
      organizationId: "org-1",
      packageId: "package-1",
      planId: "plan-1",
      pricingId: "pricing-old",
      billingPeriod: "ANNUAL",
      priceLocked: decimal("900.00"),
      currency: "IDR",
      quantity: decimal("1"),
      currentPeriodStart: new Date("2025-08-01T00:00:00.000Z"),
      currentPeriodEnd: periodStart,
      status: "ACTIVE",
      package: { code: "VPN" },
      plan: { code: "plan-code" },
      pricing: { region: { code: "ID" } },
    })
    mockPrisma.billingOrder.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => {
        const lines = data.lines as { create: Record<string, unknown> }
        return orderFixture({
          ...data,
          id: "renewal-order",
          subtotalAmount: decimal("900"),
          totalAmount: decimal("900"),
          lines: [
            { ...orderFixture().lines[0], ...lines.create, id: "renew-line" },
          ],
        })
      }
    )
    mockPrisma.billingOrder.findUnique.mockImplementation(
      async ({ where }: { where: Record<string, unknown> }) =>
        where.id === "renewal-order"
          ? orderFixture({
              id: "renewal-order",
              status: "CHARGED",
              serviceSubscriptionId: "subscription-1",
              subtotalAmount: decimal("900"),
              totalAmount: decimal("900"),
              lines: [
                {
                  ...orderFixture().lines[0],
                  id: "renew-line",
                  billingPeriod: "ANNUAL",
                  unitPrice: decimal("900"),
                  amount: decimal("900"),
                },
              ],
            })
          : null
    )
    const service = new BillingOrderService(
      mockPrisma as unknown as PrismaClient,
      undefined,
      new BillingFulfillmentRegistry([adapter])
    )

    const result = await service.renewServiceSubscription(
      "subscription-1",
      periodStart
    )

    expect(result.amount).toBe("900")
    expect(mockResolveRecurringPrice).not.toHaveBeenCalled()
    expect(
      mockPrisma.billingOrder.create.mock.calls[0][0].data.lines.create
        .unitPrice
    ).toEqual(decimal("900"))
  })
  it("charges a pending renewal order before advancing and fulfilling", async () => {
    const subscription = {
      id: "subscription-1",
      organizationId: "org-1",
      packageId: "package-1",
      planId: "plan-1",
      pricingId: "pricing-old",
      billingPeriod: "ANNUAL",
      priceLocked: decimal("900.00"),
      currency: "IDR",
      quantity: decimal("1"),
      currentPeriodStart: new Date("2025-08-01T00:00:00.000Z"),
      currentPeriodEnd: periodStart,
      status: "ACTIVE",
      package: { code: "VPN" },
      plan: { code: "plan-code" },
      pricing: { chargeUnit: "SUBSCRIPTION", region: { code: "ID" } },
    }
    const pending = orderFixture({
      status: "PENDING",
      serviceSubscriptionId: "subscription-1",
      subtotalAmount: decimal("900"),
      totalAmount: decimal("900"),
      lines: [
        {
          ...orderFixture().lines[0],
          billingPeriod: "ANNUAL",
          unitPrice: decimal("900"),
          amount: decimal("900"),
        },
      ],
    })
    let orderLoadCount = 0
    mockPrisma.serviceSubscription.findUnique.mockResolvedValue(subscription)
    mockPrisma.billingOrder.findUnique.mockImplementation(
      async ({ where }: { where: Record<string, unknown> }) => {
        if (!("id" in where)) return pending
        orderLoadCount += 1
        return orderLoadCount === 1
          ? pending
          : orderFixture({
              ...pending,
              status: "CHARGED",
              billingInvoiceId: "invoice-1",
            })
      }
    )
    mockPrisma.billingOrder.update.mockResolvedValue(pending)
    const service = new BillingOrderService(
      mockPrisma as unknown as PrismaClient,
      undefined,
      new BillingFulfillmentRegistry([adapter])
    )

    const result = await service.renewServiceSubscription(
      "subscription-1",
      periodStart
    )

    expect(result.status).toBe("FULFILLED")
    expect(mockDebitServiceBalance).toHaveBeenCalledTimes(1)
    expect(mockPrisma.serviceSubscription.update).toHaveBeenCalledTimes(1)
    expect(adapter.renew).toHaveBeenCalledTimes(1)
  })
  it("leaves the period unchanged on fulfillment failure and retries charged without another debit", async () => {
    const subscription = {
      id: "subscription-1",
      organizationId: "org-1",
      packageId: "package-1",
      planId: "plan-1",
      pricingId: "pricing-old",
      billingPeriod: "ANNUAL",
      priceLocked: decimal("900.00"),
      currency: "IDR",
      quantity: decimal("1"),
      currentPeriodStart: new Date("2025-08-01T00:00:00.000Z"),
      currentPeriodEnd: periodStart,
      status: "ACTIVE",
      package: { code: "VPN" },
      plan: { code: "plan-code" },
      pricing: { chargeUnit: "SUBSCRIPTION", region: { code: "ID" } },
    }
    const pending = orderFixture({
      status: "PENDING",
      serviceSubscriptionId: "subscription-1",
      subtotalAmount: decimal("900"),
      totalAmount: decimal("900"),
      lines: [
        {
          ...orderFixture().lines[0],
          billingPeriod: "ANNUAL",
          unitPrice: decimal("900"),
          amount: decimal("900"),
        },
      ],
    })
    const charged = orderFixture({
      ...pending,
      status: "CHARGED",
      billingInvoiceId: "invoice-1",
    })
    let existingStatus: "PENDING" | "CHARGED" = "PENDING"
    let orderLoadCount = 0
    mockPrisma.serviceSubscription.findUnique.mockResolvedValue(subscription)
    mockPrisma.billingOrder.findUnique.mockImplementation(
      async ({ where }: { where: Record<string, unknown> }) => {
        if (!("id" in where))
          return existingStatus === "PENDING" ? pending : charged
        orderLoadCount += 1
        return orderLoadCount === 1 ? pending : charged
      }
    )
    mockPrisma.billingOrder.update.mockResolvedValue(charged)
    adapter.renew.mockRejectedValueOnce(new Error("provisioning failed"))
    const service = new BillingOrderService(
      mockPrisma as unknown as PrismaClient,
      undefined,
      new BillingFulfillmentRegistry([adapter])
    )

    await expect(
      service.renewServiceSubscription("subscription-1", periodStart)
    ).rejects.toThrow("provisioning failed")
    expect(mockPrisma.serviceSubscription.update).not.toHaveBeenCalled()

    existingStatus = "CHARGED"
    orderLoadCount = 1
    await service.renewServiceSubscription("subscription-1", periodStart)

    expect(mockDebitServiceBalance).toHaveBeenCalledTimes(1)
    expect(mockPrisma.serviceSubscription.update).toHaveBeenCalledTimes(1)
  })

  it("advances a charged renewal once before fulfillment", async () => {
    const subscription = {
      id: "subscription-1",
      organizationId: "org-1",
      packageId: "package-1",
      planId: "plan-1",
      pricingId: "pricing-old",
      billingPeriod: "ANNUAL",
      priceLocked: decimal("900.00"),
      currency: "IDR",
      quantity: decimal("1"),
      currentPeriodStart: new Date("2025-08-01T00:00:00.000Z"),
      currentPeriodEnd: periodStart,
      status: "ACTIVE",
      package: { code: "VPN" },
      plan: { code: "plan-code" },
      pricing: { chargeUnit: "SUBSCRIPTION", region: { code: "ID" } },
    }
    const charged = orderFixture({
      status: "CHARGED",
      serviceSubscriptionId: "subscription-1",
      billingInvoiceId: "invoice-1",
      subtotalAmount: decimal("900"),
      totalAmount: decimal("900"),
      lines: [
        {
          ...orderFixture().lines[0],
          billingPeriod: "ANNUAL",
          unitPrice: decimal("900"),
          amount: decimal("900"),
        },
      ],
    })
    mockPrisma.serviceSubscription.findUnique.mockResolvedValue(subscription)
    mockPrisma.billingOrder.findUnique.mockResolvedValue(charged)
    mockPrisma.billingOrder.update.mockResolvedValue(charged)
    const service = new BillingOrderService(
      mockPrisma as unknown as PrismaClient,
      undefined,
      new BillingFulfillmentRegistry([adapter])
    )

    const result = await service.renewServiceSubscription(
      "subscription-1",
      periodStart
    )

    expect(result.status).toBe("FULFILLED")
    expect(mockDebitServiceBalance).not.toHaveBeenCalled()
    expect(mockPrisma.serviceSubscription.update).toHaveBeenCalledTimes(1)
    expect(adapter.renew).toHaveBeenCalledTimes(1)
  })

  it("does not advance a fulfilled renewal on retry", async () => {
    const subscription = {
      id: "subscription-1",
      organizationId: "org-1",
      packageId: "package-1",
      planId: "plan-1",
      pricingId: "pricing-old",
      billingPeriod: "ANNUAL",
      priceLocked: decimal("900.00"),
      currency: "IDR",
      quantity: decimal("1"),
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      status: "ACTIVE",
      package: { code: "VPN" },
      plan: { code: "plan-code" },
      pricing: { chargeUnit: "SUBSCRIPTION", region: { code: "ID" } },
    }
    const fulfilled = orderFixture({
      status: "FULFILLED",
      serviceSubscriptionId: "subscription-1",
      lines: [{ ...orderFixture().lines[0], billingPeriod: "ANNUAL" }],
    })
    mockPrisma.serviceSubscription.findUnique.mockResolvedValue(subscription)
    mockPrisma.billingOrder.findUnique.mockResolvedValue(fulfilled)
    const service = new BillingOrderService(
      mockPrisma as unknown as PrismaClient,
      undefined,
      new BillingFulfillmentRegistry([adapter])
    )

    const result = await service.renewServiceSubscription(
      "subscription-1",
      periodStart
    )

    expect(result.status).toBe("FULFILLED")
    expect(mockPrisma.serviceSubscription.update).not.toHaveBeenCalled()
  })
  it("does not regress a newer period when an older fulfilled renewal retries", async () => {
    const newerPeriodStart = new Date("2027-08-01T00:00:00.000Z")
    const subscription = {
      id: "subscription-1",
      organizationId: "org-1",
      packageId: "package-1",
      planId: "plan-1",
      pricingId: "pricing-old",
      billingPeriod: "ANNUAL",
      priceLocked: decimal("900.00"),
      currency: "IDR",
      quantity: decimal("1"),
      currentPeriodStart: periodEnd,
      currentPeriodEnd: newerPeriodStart,
      status: "ACTIVE",
      package: { code: "VPN" },
      plan: { code: "plan-code" },
      pricing: { chargeUnit: "SUBSCRIPTION", region: { code: "ID" } },
    }
    const fulfilledOlderOrder = orderFixture({
      status: "FULFILLED",
      serviceSubscriptionId: "subscription-1",
      lines: [{ ...orderFixture().lines[0], billingPeriod: "ANNUAL" }],
    })
    mockPrisma.serviceSubscription.findUnique.mockResolvedValue(subscription)
    mockPrisma.billingOrder.findUnique.mockResolvedValue(fulfilledOlderOrder)
    const service = new BillingOrderService(
      mockPrisma as unknown as PrismaClient,
      undefined,
      new BillingFulfillmentRegistry([adapter])
    )

    await service.renewServiceSubscription("subscription-1", newerPeriodStart)

    expect(mockPrisma.serviceSubscription.update).not.toHaveBeenCalled()
  })
})
