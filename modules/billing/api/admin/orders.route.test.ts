import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"
import { Prisma } from "@prisma/client"

import { createAdminOrdersRoutes } from "./orders.route"

const guard = mock(async () => ({
  ok: true as const,
  userId: "admin-1",
  platformRole: "super_admin" as const,
}))
const db = {
  billingOrder: { findMany: mock(), count: mock() },
}

const order = {
  id: "order-1",
  organizationId: "org-1",
  billingAccountId: "account-1",
  serviceSubscriptionId: "sub-1",
  billingInvoiceId: "invoice-1",
  status: "FULFILLED",
  currency: "IDR",
  subtotalAmount: new Prisma.Decimal("300000"),
  totalAmount: new Prisma.Decimal("300000"),
  idempotencyKey: "order-key",
  chargedAt: new Date("2026-01-01"),
  fulfilledAt: new Date("2026-01-01"),
  metadataJson: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  lines: [
    {
      id: "line-1",
      pricingId: "price-1",
      packageCode: "WHATSAPP",
      planCode: "WA_BASIC",
      regionCode: "ID",
      billingPeriod: "MONTHLY",
      chargeUnit: "DEVICE",
      quantity: new Prisma.Decimal("3"),
      unitPrice: new Prisma.Decimal("100000"),
      amount: new Prisma.Decimal("300000"),
      currency: "IDR",
      periodStart: new Date("2026-01-01"),
      periodEnd: new Date("2026-02-01"),
      metadataJson: null,
    },
  ],
  serviceSubscription: {
    id: "sub-1",
    status: "ACTIVE",
    currentPeriodStart: new Date("2026-01-01"),
    currentPeriodEnd: new Date("2026-02-01"),
    package: { code: "WHATSAPP" },
    plan: { code: "WA_BASIC" },
  },
  billingInvoice: {
    id: "invoice-1",
    invoiceNumber: "INV-1",
    status: "PAID",
    paidAt: new Date("2026-01-01"),
  },
}

function app() {
  return new Elysia()
    .use(
      createAdminOrdersRoutes({ requireSuperAdmin: guard, prisma: db as never })
    )
    .compile()
}

describe("admin orders route", () => {
  beforeEach(() => {
    mock.clearAllMocks()
    guard.mockResolvedValue({
      ok: true as const,
      userId: "admin-1",
      platformRole: "super_admin" as const,
    })
  })

  it("returns paginated commercial order state", async () => {
    db.billingOrder.findMany.mockResolvedValueOnce([order])
    db.billingOrder.count.mockResolvedValueOnce(1)
    const response = await app().handle(
      new Request("http://localhost/admin/orders?page=1&limit=20")
    )
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.ok).toBe(true)
    expect(body.orders[0].line.amount).toBe("300000")
    expect(body.orders[0].invoice.status).toBe("PAID")
    expect(body.pagination.total).toBe(1)
  })

  it("filters organization, package, status, period, and date range", async () => {
    db.billingOrder.findMany.mockResolvedValueOnce([])
    db.billingOrder.count.mockResolvedValueOnce(0)
    const response = await app().handle(
      new Request(
        "http://localhost/admin/orders?organizationId=org-2&packageCode=VPN&status=CHARGED&billingPeriod=ANNUAL&from=2026-01-01T00:00:00.000Z&to=2026-02-01T00:00:00.000Z"
      )
    )
    expect(response.status).toBe(200)
    expect(db.billingOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: "org-2",
          status: "CHARGED",
          createdAt: expect.any(Object),
          lines: expect.any(Object),
        }),
      })
    )
  })
})
