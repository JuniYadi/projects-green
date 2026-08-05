import { describe, expect, it, mock } from "bun:test"

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
    servicePlan: { id: "plan-1" },
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
        findUnique: mock().mockResolvedValue({
          id: "pricing-1",
          planId: "plan-1",
          billingPeriod: "ANNUAL",
        }),
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
      expect.objectContaining({ pricingId: "pricing-1" })
    )
    expect(orders.chargeOrder).toHaveBeenCalledWith("order-1")
    expect(orders.fulfillOrder).toHaveBeenCalledWith(
      "order-1",
      expect.objectContaining({ packageId: "package-1" })
    )
  })

  it("rejects pricing from an unrelated service plan", async () => {
    const orders = { createOrder: mock() }
    const prisma = {
      vpnPackage: {
        findUnique: mock().mockResolvedValue(packageRecord()),
      },
      servicePricing: {
        findUnique: mock().mockResolvedValue({
          id: "pricing-1",
          planId: "other-plan",
        }),
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
