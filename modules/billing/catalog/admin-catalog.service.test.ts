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
  servicePlan: { findUnique: mock(), create: mock(), update: mock() },
  servicePricing: { findUnique: mock(), create: mock(), update: mock() },
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
