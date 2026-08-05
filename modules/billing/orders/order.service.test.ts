import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Prisma } from "@prisma/client"
import type { PrismaClient } from "@prisma/client"

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
  whatsappDevice: { count: mock() },
}
const mockResolveRecurringPrice = mock()
const mockDebitServiceBalance = mock()

mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }))
mock.module("../pricing/pricing.service", () => ({
  resolveRecurringPrice: mockResolveRecurringPrice,
}))
mock.module("../billing-transaction.service", () => ({
  BillingTransactionService: class {
    debitServiceBalance = mockDebitServiceBalance
  },
}))

const { BillingOrderService } = await import("./order.service")
const { BillingFulfillmentRegistry } = await import("./fulfillment-adapters")

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
const account = { id: "account-1", currency: "IDR" }

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
  create: mock(async () => ({ subscriptionId: "subscription-1" })),
  renew: mock(async () => {}),
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
        data: expect.objectContaining({ status: "FAILED" }),
      })
    )
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
