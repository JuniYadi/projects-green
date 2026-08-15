import { describe, expect, it, mock } from "bun:test"
import { Prisma } from "@prisma/client"

import {
  VpnPackageUnavailableError,
  VpnSubscriptionService,
} from "./vpn-subscription.service"

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
