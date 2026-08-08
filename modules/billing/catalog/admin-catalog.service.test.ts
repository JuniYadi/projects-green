import { Prisma } from "@prisma/client"
import { beforeEach, describe, expect, it, mock } from "bun:test"

const defaultPrisma = { servicePackage: {} }
mock.module("@/lib/prisma", () => ({ prisma: defaultPrisma }))

import {
  AdminCatalogService,
  ProductPublishValidationError,
} from "./admin-catalog.service"

const db = {
  servicePackage: {
    findMany: mock(),
    findUnique: mock(),
    create: mock(),
    update: mock(),
  },
  servicePlan: {
    findUnique: mock(),
    findMany: mock(),
    create: mock(),
    update: mock(),
  },
  servicePricing: {
    findUnique: mock(),
    findMany: mock(),
    create: mock(),
    update: mock(),
  },
  serviceRegion: { findUnique: mock() },
  $transaction: mock(async (fn: (tx: typeof db) => unknown) => fn(db)),
}
const price = (period: string, currency: string, amount = "100") => ({
  id: `${currency}-${period}`,
  billingPeriod: period,
  currency,
  amount,
  periodPrice: new Prisma.Decimal(amount),
  effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
  effectiveTo: null,
  isActive: true,
})

const completePrices = () => [
  ...["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL"].flatMap((period) => [
    price(period, "IDR"),
    price(period, "USD"),
  ]),
]

const product = (state = "DRAFT") => ({
  id: "pkg-1",
  code: "VPN",
  name: "VPN",
  description: null,
  state,
  isActive: true,
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
  plans: [
    {
      id: "plan-1",
      code: "STANDARD",
      name: "Standard",
      resources: {},
      isActive: true,
      pricings: completePrices(),
    },
  ],
})

const input = {
  code: "VPN" as const,
  name: "VPN",
  description: null,
  plans: [
    {
      code: "STANDARD",
      name: "Standard",
      resources: {},
      prices: completePrices(),
    },
  ],
}

describe("AdminCatalogService", () => {
  beforeEach(() => {
    mock.restore()
    for (const model of [
      db.servicePackage,
      db.servicePlan,
      db.servicePricing,
      db.serviceRegion,
    ]) {
      for (const fn of Object.values(model)) fn.mockReset()
    }
    db.servicePlan.findMany.mockResolvedValue([])
    db.servicePricing.findMany.mockResolvedValue([])
    db.$transaction.mockImplementation(async (fn: (tx: typeof db) => unknown) =>
      fn(db)
    )
    db.serviceRegion.findUnique.mockResolvedValue({
      id: "global-region",
      code: "GLOBAL",
    })
  })

  it("lists and reloads drafts through explicit DTOs", async () => {
    db.servicePackage.findMany.mockResolvedValue([product()])
    db.servicePackage.findUnique.mockResolvedValue(product())

    const service = new AdminCatalogService(db as never)
    const list = await service.listProducts()
    const detail = await service.getProduct("VPN")

    expect(list[0]).toMatchObject({
      code: "VPN",
      state: "DRAFT",
      plans: [{ prices: expect.any(Array) }],
    })
    expect(detail).toMatchObject({ code: "VPN", updatedAt: expect.any(String) })
  })

  it("writes a draft in one transaction and resolves GLOBAL explicitly", async () => {
    db.servicePackage.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(product())
    db.servicePackage.create.mockResolvedValue(product())
    db.servicePlan.create.mockResolvedValue(product().plans[0])
    db.servicePricing.create.mockResolvedValue(product().plans[0].pricings[0])

    await new AdminCatalogService(db as never).saveDraft(input)

    expect(db.$transaction).toHaveBeenCalledTimes(1)
    expect(db.serviceRegion.findUnique).toHaveBeenCalledWith({
      where: { code: "GLOBAL" },
    })
    expect(db.servicePricing.create).toHaveBeenCalled()
    expect(
      db.servicePricing.create.mock.calls[0]?.[0].data.periodPrice.toString()
    ).toBe("100")
  })

  it("rejects every incomplete enabled currency/term cell", async () => {
    db.servicePackage.findUnique.mockResolvedValue(product())
    const service = new AdminCatalogService(db as never)

    for (const bad of ["0", "-1"]) {
      const incomplete = product()
      incomplete.plans[0].pricings = completePrices().map((row) =>
        row.currency === "USD" && row.billingPeriod === "ANNUAL"
          ? { ...row, periodPrice: bad }
          : row
      )
      db.servicePackage.findUnique.mockResolvedValueOnce(incomplete)
      await expect(service.publish("VPN")).rejects.toBeInstanceOf(
        ProductPublishValidationError
      )
    }

    const missing = product()
    missing.plans[0].pricings = completePrices().filter(
      (row) => row.currency !== "IDR" || row.billingPeriod !== "MONTHLY"
    )
    db.servicePackage.findUnique.mockResolvedValueOnce(missing)
    await expect(service.publish("VPN")).rejects.toBeInstanceOf(
      ProductPublishValidationError
    )
  })

  it("deactivates omitted plans and prices when saving a draft", async () => {
    const existingPrice = {
      id: "price-old",
      planId: "plan-old",
      isActive: true,
    }
    const existingPlan = {
      id: "plan-old",
      code: "OLD",
      packageId: "pkg-1",
      pricings: [existingPrice],
    }
    db.servicePackage.findUnique
      .mockResolvedValueOnce(product())
      .mockResolvedValueOnce(product())
    db.servicePlan.findMany.mockResolvedValue([
      product().plans[0],
      existingPlan,
    ])
    db.servicePricing.findMany.mockResolvedValue([existingPrice])
    db.servicePlan.findUnique.mockResolvedValue(null)
    db.servicePlan.create.mockResolvedValue(product().plans[0])
    db.servicePackage.update.mockResolvedValue(product())

    await new AdminCatalogService(db as never).saveDraft({
      ...input,
      plans: [],
    })

    expect(db.servicePlan.update).toHaveBeenCalledWith({
      where: { id: "plan-1" },
      data: { isActive: false },
    })
    expect(db.servicePricing.update).toHaveBeenCalledWith({
      where: { id: "price-old" },
      data: { isActive: false },
    })
  })

  it("rejects rewriting an existing effective price row", async () => {
    db.servicePackage.findUnique.mockResolvedValueOnce(null)
    db.servicePackage.create.mockResolvedValue(product())
    db.servicePlan.create.mockResolvedValue(product().plans[0])
    db.servicePricing.findUnique.mockResolvedValue({ id: "historical-price" })

    await expect(
      new AdminCatalogService(db as never).saveDraft(input)
    ).rejects.toThrow("effective price row")
    expect(db.servicePricing.update).not.toHaveBeenCalled()
  })
  it("rejects deactivating a pricing row referenced by billing history", async () => {
    const referencedPrice = {
      id: "price-ref",
      planId: "plan-old",
      isActive: true,
      subscriptions: [{ id: "subscription-1" }],
      orderLines: [],
    }
    db.servicePackage.findUnique.mockResolvedValueOnce(product())
    db.servicePlan.findMany.mockResolvedValue([
      {
        id: "plan-old",
        code: "OLD",
        packageId: "pkg-1",
        pricings: [referencedPrice],
      },
    ])
    db.servicePackage.update.mockResolvedValue(product())

    await expect(
      new AdminCatalogService(db as never).saveDraft({ ...input, plans: [] })
    ).rejects.toThrow("referenced by a subscription or order")
    expect(db.servicePricing.update).not.toHaveBeenCalled()
  })

  it("requires a new effective date for an existing active price cell", async () => {
    db.servicePackage.findUnique.mockResolvedValueOnce(product())
    db.servicePackage.update.mockResolvedValue(product())
    db.servicePlan.findMany.mockResolvedValue([product().plans[0]])
    db.servicePlan.findUnique.mockResolvedValue(product().plans[0])
    db.servicePlan.update.mockResolvedValue(product().plans[0])

    await expect(
      new AdminCatalogService(db as never).saveDraft({
        ...input,
        plans: [
          {
            ...input.plans[0],
            prices: [{ ...input.plans[0].prices[0], effectiveFrom: undefined }],
          },
        ],
      })
    ).rejects.toThrow("provide a new effectiveFrom")
    expect(db.servicePricing.create).not.toHaveBeenCalled()
  })

  it("publishes a complete draft", async () => {
    db.servicePackage.findUnique.mockResolvedValue(product())
    db.servicePackage.update.mockResolvedValue(product("PUBLISHED"))

    const result = await new AdminCatalogService(db as never).publish("VPN")

    expect(db.servicePackage.update).toHaveBeenCalledWith({
      where: { code: "VPN" },
      data: { state: "PUBLISHED", isActive: true },
      include: expect.anything(),
    })
    expect(result.state).toBe("PUBLISHED")
  })
})
