import { describe, expect, it, mock } from "bun:test"
import { Prisma } from "@prisma/client"

const mockAuditLog = mock().mockResolvedValue(undefined)
mock.module("@/lib/audit.service", () => ({ logAuditEvent: mockAuditLog }))
mock.module("@/lib/prisma", () => ({ prisma: {} }))
const mockEmailService = {
  sendSubscriptionCreated: mock().mockResolvedValue(undefined),
  sendSubscriptionCancelled: mock().mockResolvedValue(undefined),
}
mock.module("@/modules/vpn/email.service", () => ({
  vpnEmailService: mockEmailService,
}))

const {
  VpnPackageUnavailableError,
  VpnSubscriptionNotFoundError,
  VpnSubscriptionService,
} = await import("./vpn-subscription.service")

function packageRecord() {
  return {
    id: "package-1",
    name: "VPN Pro",
    isActive: true,
    servicePlanId: "plan-1",
    servicePlan: {
      id: "plan-1",
      isActive: true,
      package: { code: "VPN", isActive: true },
    },
  }
}

function pricingRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "pricing-1",
    planId: "plan-1",
    type: "BUNDLE",
    billingMode: "PACKAGE",
    billingPeriod: "ANNUAL",
    periodPrice: new Prisma.Decimal("100000"),
    currency: "IDR",
    effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
    effectiveTo: null,
    isActive: true,
    servicePlan: {
      id: "plan-1",
      isActive: true,
      package: { code: "VPN", isActive: true },
    },
    ...overrides,
  }
}
function subscriptionRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "subscription-1",
    organizationId: "org-1",
    packageId: "package-1",
    status: "ACTIVE",
    priceLocked: new Prisma.Decimal("100000"),
    currency: "IDR",
    originalPrice: null,
    originalCurrency: null,
    exchangeRate: null,
    currentPeriodStart: new Date("2026-08-01T00:00:00.000Z"),
    currentPeriodEnd: new Date("2026-09-01T00:00:00.000Z"),
    cancelAtPeriodEnd: false,
    renewalFailedAt: null,
    serverAccounts: [],
    _count: { mobileDevices: 0 },
    ...overrides,
  }
}

function subscriptionInclude() {
  return {
    serverAccounts: {
      include: {
        server: {
          select: {
            id: true,
            name: true,
            hostname: true,
            ipAddress: true,
            openVpnPort: true,
            wireGuardPort: true,
            proxyPort: true,
            region: {
              select: { id: true, name: true, slug: true, countryCode: true },
            },
          },
        },
      },
    },
    _count: { select: { mobileDevices: true } },
  }
}

describe("VpnSubscriptionService.purchase", () => {
  it("requires a linked pricing offer and fulfills through the order spine", async () => {
    const vpnSubscriptionFindFirst = mock()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "vpn-subscription-1",
        organizationId: "org-1",
        packageId: "package-1",
        status: "ACTIVE",
        serverAccounts: [],
      })
    const orders = {
      createOrder: mock().mockResolvedValue({ orderId: "order-1" }),
      chargeOrder: mock().mockResolvedValue({ orderId: "order-1" }),
      fulfillOrder: mock().mockResolvedValue({ orderId: "order-1" }),
    }
    const prisma = {
      vpnPackage: {
        findUnique: mock().mockResolvedValue(packageRecord()),
      },
      servicePricing: {
        findUnique: mock().mockResolvedValue(pricingRecord()),
      },
      vpnSubscription: { findFirst: vpnSubscriptionFindFirst },
    }
    const service = new VpnSubscriptionService(prisma as never, {
      orders: orders as never,
      emailService: {
        sendSubscriptionCreated: mock().mockResolvedValue(undefined),
      } as never,
    })

    await service.purchase({
      organizationId: "org-1",
      packageId: "package-1",
      pricingId: "pricing-1",
      now: new Date("2026-08-01T00:00:00.000Z"),
    })

    expect(orders.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        pricingId: "pricing-1",
        prorateMonthly: false,
        idempotencyKey: "vpn-package:org-1:package-1:pricing-1:2026-08",
      })
    )
    expect(orders.chargeOrder).toHaveBeenCalledWith("order-1")
    expect(orders.fulfillOrder).toHaveBeenCalledWith(
      "order-1",
      expect.objectContaining({ packageId: "package-1" })
    )
  })

  it("enables monthly proration for a mid-month purchase", async () => {
    const orders = {
      createOrder: mock().mockResolvedValue({ orderId: "order-monthly" }),
      chargeOrder: mock().mockResolvedValue({ orderId: "order-monthly" }),
      fulfillOrder: mock().mockResolvedValue({ orderId: "order-monthly" }),
    }
    const prisma = {
      vpnPackage: {
        findUnique: mock().mockResolvedValue(packageRecord()),
      },
      servicePricing: {
        findUnique: mock().mockResolvedValue(
          pricingRecord({ id: "pricing-monthly", billingPeriod: "MONTHLY" })
        ),
      },
      vpnSubscription: {
        findFirst: mock().mockResolvedValueOnce(null).mockResolvedValueOnce({
          id: "vpn-subscription-monthly",
          organizationId: "org-1",
          packageId: "package-1",
          status: "ACTIVE",
          serverAccounts: [],
        }),
      },
    }
    const service = new VpnSubscriptionService(prisma as never, {
      orders: orders as never,
      emailService: {
        sendSubscriptionCreated: mock().mockResolvedValue(undefined),
      } as never,
    })

    await service.purchase({
      organizationId: "org-1",
      packageId: "package-1",
      pricingId: "pricing-monthly",
      now: new Date("2026-08-15T00:00:00.000Z"),
    })

    expect(orders.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        pricingId: "pricing-monthly",
        prorateMonthly: true,
        now: new Date("2026-08-15T00:00:00.000Z"),
      })
    )
  })

  it("rejects a missing pricing offer before checking for duplicates", async () => {
    const pricingFindUnique = mock().mockResolvedValue(null)
    const duplicateLookup = mock()
    const orders = { createOrder: mock() }
    const prisma = {
      vpnPackage: {
        findUnique: mock().mockResolvedValue(packageRecord()),
      },
      servicePricing: { findUnique: pricingFindUnique },
      vpnSubscription: { findFirst: duplicateLookup },
    }
    const service = new VpnSubscriptionService(prisma as never, {
      orders: orders as never,
      emailService: {} as never,
    })

    await expect(
      service.purchase({
        organizationId: "org-1",
        packageId: "package-1",
        pricingId: "missing-pricing",
      })
    ).rejects.toBeInstanceOf(VpnPackageUnavailableError)
    expect(duplicateLookup).not.toHaveBeenCalled()
    expect(orders.createOrder).not.toHaveBeenCalled()
  })

  it("rejects an active duplicate subscription before creating an order", async () => {
    const orders = { createOrder: mock() }
    const prisma = {
      vpnPackage: {
        findUnique: mock().mockResolvedValue(packageRecord()),
      },
      servicePricing: {
        findUnique: mock().mockResolvedValue(pricingRecord()),
      },
      vpnSubscription: {
        findFirst: mock().mockResolvedValue({ id: "existing-subscription" }),
      },
    }
    const service = new VpnSubscriptionService(prisma as never, {
      orders: orders as never,
      emailService: {} as never,
    })

    await expect(
      service.purchase({
        organizationId: "org-1",
        packageId: "package-1",
        pricingId: "pricing-1",
      })
    ).rejects.toThrow("active subscription")
    expect(orders.createOrder).not.toHaveBeenCalled()
  })

  it("maps billing failures from the order spine", async () => {
    const orders = {
      createOrder: mock().mockResolvedValue({ orderId: "order-1" }),
      chargeOrder: mock().mockRejectedValue(new Error("INSUFFICIENT_BALANCE")),
      fulfillOrder: mock(),
    }
    const prisma = {
      vpnPackage: {
        findUnique: mock().mockResolvedValue(packageRecord()),
      },
      servicePricing: {
        findUnique: mock().mockResolvedValue(pricingRecord()),
      },
      vpnSubscription: { findFirst: mock().mockResolvedValue(null) },
    }
    const service = new VpnSubscriptionService(prisma as never, {
      orders: orders as never,
      emailService: {} as never,
    })

    await expect(
      service.purchase({
        organizationId: "org-1",
        packageId: "package-1",
        pricingId: "pricing-1",
      })
    ).rejects.toThrow("Insufficient balance")
    expect(orders.fulfillOrder).not.toHaveBeenCalled()
  })

  it("rejects a successful order when fulfillment cannot find the subscription", async () => {
    const orders = {
      createOrder: mock().mockResolvedValue({ orderId: "order-1" }),
      chargeOrder: mock().mockResolvedValue({ orderId: "order-1" }),
      fulfillOrder: mock().mockResolvedValue({ orderId: "order-1" }),
    }
    const prisma = {
      vpnPackage: {
        findUnique: mock().mockResolvedValue(packageRecord()),
      },
      servicePricing: {
        findUnique: mock().mockResolvedValue(pricingRecord()),
      },
      vpnSubscription: { findFirst: mock().mockResolvedValue(null) },
    }
    const service = new VpnSubscriptionService(prisma as never, {
      orders: orders as never,
      emailService: {} as never,
    })

    await expect(
      service.purchase({
        organizationId: "org-1",
        packageId: "package-1",
        pricingId: "pricing-1",
      })
    ).rejects.toThrow("Subscription not found")
  })

  it("rejects an unavailable package before looking up pricing", async () => {
    const pricingFindUnique = mock()
    const orders = { createOrder: mock() }
    const prisma = {
      vpnPackage: { findUnique: mock().mockResolvedValue(null) },
      servicePricing: { findUnique: pricingFindUnique },
      vpnSubscription: { findFirst: mock() },
    }
    const service = new VpnSubscriptionService(prisma as never, {
      orders: orders as never,
      emailService: {} as never,
    })

    await expect(
      service.purchase({
        organizationId: "org-1",
        packageId: "package-1",
        pricingId: "pricing-1",
      })
    ).rejects.toBeInstanceOf(VpnPackageUnavailableError)
    expect(pricingFindUnique).not.toHaveBeenCalled()
    expect(orders.createOrder).not.toHaveBeenCalled()
  })

  it("rejects pricing from an unrelated service plan", async () => {
    const orders = { createOrder: mock() }
    const prisma = {
      vpnPackage: {
        findUnique: mock().mockResolvedValue(packageRecord()),
      },
      servicePricing: {
        findUnique: mock().mockResolvedValue(
          pricingRecord({ planId: "other-plan" })
        ),
      },
      vpnSubscription: { findFirst: mock() },
    }
    const service = new VpnSubscriptionService(prisma as never, {
      orders: orders as never,
      emailService: {} as never,
    })
    await expect(
      service.purchase({
        organizationId: "org-1",
        packageId: "package-1",
        pricingId: "pricing-1",
      })
    ).rejects.toBeInstanceOf(VpnPackageUnavailableError)
    expect(orders.createOrder).not.toHaveBeenCalled()
  })
})

describe("VpnSubscriptionService lookups", () => {
  it("lists an organization with accounts and newest-first ordering", async () => {
    const findMany = mock().mockResolvedValue([])
    const service = new VpnSubscriptionService({
      vpnSubscription: { findMany },
    } as never)

    await service.listForOrganization("org-1")

    expect(findMany).toHaveBeenCalledWith({
      where: { organizationId: "org-1" },
      include: subscriptionInclude(),
      orderBy: { createdAt: "desc" },
    })
  })

  it("gets an organization subscription by scoped id", async () => {
    const findFirst = mock().mockResolvedValue(null)
    const service = new VpnSubscriptionService({
      vpnSubscription: { findFirst },
    } as never)

    await service.getForOrganization("org-1", "subscription-1")

    expect(findFirst).toHaveBeenCalledWith({
      where: { id: "subscription-1", organizationId: "org-1" },
      include: subscriptionInclude(),
    })
  })

  it("gets a subscription by id", async () => {
    const findUnique = mock().mockResolvedValue(null)
    const service = new VpnSubscriptionService({
      vpnSubscription: { findUnique },
    } as never)

    await service.getById("subscription-1")

    expect(findUnique).toHaveBeenCalledWith({
      where: { id: "subscription-1" },
      include: subscriptionInclude(),
    })
  })
})

describe("VpnSubscriptionService.listAll", () => {
  function makeService() {
    const findMany = mock().mockResolvedValue([subscriptionRecord()])
    const count = mock().mockResolvedValue(1)
    const service = new VpnSubscriptionService({
      vpnSubscription: { findMany, count },
    } as never)
    return { service, findMany, count }
  }

  it("uses defaults and returns data with total", async () => {
    const { service, findMany, count } = makeService()

    await expect(service.listAll()).resolves.toEqual({
      data: [subscriptionRecord()],
      total: 1,
    })
    expect(findMany).toHaveBeenCalledWith({
      where: {},
      include: subscriptionInclude(),
      orderBy: { createdAt: "desc" },
      skip: 0,
      take: 20,
    })
    expect(count).toHaveBeenCalledWith({ where: {} })
  })

  it("applies organization, package, status, and pagination filters", async () => {
    const { service, findMany, count } = makeService()

    await service.listAll({
      orgId: "org-2",
      packageId: "package-2",
      status: "SUSPENDED",
      page: 3,
      limit: 5,
    })

    const expectedWhere = {
      organizationId: "org-2",
      packageId: "package-2",
      status: "SUSPENDED",
    }
    expect(findMany).toHaveBeenCalledWith({
      where: expectedWhere,
      include: subscriptionInclude(),
      orderBy: { createdAt: "desc" },
      skip: 10,
      take: 5,
    })
    expect(count).toHaveBeenCalledWith({ where: expectedWhere })
  })

  it("applies period range and id or organization search filters", async () => {
    const { service, findMany } = makeService()

    await service.listAll({
      periodStartFrom: "2026-01-01",
      periodStartTo: "2026-02-01",
      q: "needle",
    })

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          currentPeriodStart: {
            gte: new Date("2026-01-01"),
            lte: new Date("2026-02-01"),
          },
          OR: [
            { id: { contains: "needle" } },
            { organizationId: { contains: "needle" } },
          ],
        },
      })
    )
  })
})

describe("VpnSubscriptionService billing and lifecycle", () => {
  it("returns billing info and scopes lookup to organization", async () => {
    const sub = subscriptionRecord()
    const findFirst = mock().mockResolvedValue(sub)
    const service = new VpnSubscriptionService({
      vpnSubscription: { findFirst },
    } as never)

    await expect(
      service.getBillingInfo("org-1", "subscription-1")
    ).resolves.toBe(sub)
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: "subscription-1", organizationId: "org-1" },
      select: {
        id: true,
        status: true,
        priceLocked: true,
        currency: true,
        originalPrice: true,
        originalCurrency: true,
        exchangeRate: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
        cancelAtPeriodEnd: true,
        renewalFailedAt: true,
      },
    })
  })

  it("throws when billing info is missing", async () => {
    const service = new VpnSubscriptionService({
      vpnSubscription: { findFirst: mock().mockResolvedValue(null) },
    } as never)
    await expect(
      service.getBillingInfo("org-1", "missing")
    ).rejects.toBeInstanceOf(VpnSubscriptionNotFoundError)
  })

  it("cancels at period end, audits, emails, and returns updated subscription", async () => {
    mockAuditLog.mockClear()
    mockEmailService.sendSubscriptionCancelled.mockClear()
    const existing = subscriptionRecord({
      currentPeriodEnd: new Date("2026-09-15T00:00:00.000Z"),
    })
    const updated = subscriptionRecord({ cancelAtPeriodEnd: true })
    const findFirst = mock().mockResolvedValue(existing)
    const update = mock().mockResolvedValue(updated)
    const service = new VpnSubscriptionService({
      vpnSubscription: { findFirst, update },
    } as never)

    await expect(
      service.cancelAtPeriodEnd("org-1", "subscription-1", "Too expensive")
    ).resolves.toBe(updated)
    expect(update).toHaveBeenCalledWith({
      where: { id: "subscription-1" },
      data: { cancelAtPeriodEnd: true },
      include: subscriptionInclude(),
    })
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "SUBSCRIPTION_CANCELLED",
        details: {
          currentPeriodEnd: "2026-09-15T00:00:00.000Z",
          reason: "Too expensive",
        },
      })
    )
    expect(mockEmailService.sendSubscriptionCancelled).toHaveBeenCalledWith(
      "org-1",
      undefined,
      "2026-09-15T00:00:00.000Z"
    )
  })

  it("throws when cancellation target is missing", async () => {
    const service = new VpnSubscriptionService({
      vpnSubscription: { findFirst: mock().mockResolvedValue(null) },
    } as never)
    await expect(
      service.cancelAtPeriodEnd("org-1", "missing")
    ).rejects.toBeInstanceOf(VpnSubscriptionNotFoundError)
  })

  it("rejects reinstatement unless cancellation is pending", async () => {
    const findFirst = mock().mockResolvedValue(
      subscriptionRecord({ cancelAtPeriodEnd: false })
    )
    const update = mock()
    const service = new VpnSubscriptionService({
      vpnSubscription: { findFirst, update },
    } as never)
    await expect(service.reinstate("org-1", "subscription-1")).rejects.toThrow(
      "not pending cancellation"
    )
    expect(update).not.toHaveBeenCalled()
  })

  it("throws when reinstatement target is missing", async () => {
    const service = new VpnSubscriptionService({
      vpnSubscription: { findFirst: mock().mockResolvedValue(null) },
    } as never)
    await expect(service.reinstate("org-1", "missing")).rejects.toBeInstanceOf(
      VpnSubscriptionNotFoundError
    )
  })

  it("reinstates pending cancellation and returns updated subscription", async () => {
    const existing = subscriptionRecord({ cancelAtPeriodEnd: true })
    const updated = subscriptionRecord({ cancelAtPeriodEnd: false })
    const findFirst = mock().mockResolvedValue(existing)
    const update = mock().mockResolvedValue(updated)
    const service = new VpnSubscriptionService({
      vpnSubscription: { findFirst, update },
    } as never)

    await expect(
      service.reinstate("org-1", "subscription-1", "Changed my mind")
    ).resolves.toBe(updated)
    expect(update).toHaveBeenCalledWith({
      where: { id: "subscription-1" },
      data: { cancelAtPeriodEnd: false },
      include: subscriptionInclude(),
    })
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "SUBSCRIPTION_REINSTATED",
        details: { reason: "Changed my mind" },
      })
    )
  })
})
