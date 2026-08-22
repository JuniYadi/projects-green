import { describe, expect, it, mock } from "bun:test"
import { Prisma } from "@prisma/client"

import { toVpnPublicPackageDTO } from "./vpn-package-public.dto"
import { VpnSubscriptionService } from "./vpn-subscription.service"
import { VpnRenewalService } from "../billing/vpn-renewal.service"
const decimal = (value: string) => new Prisma.Decimal(value)

function packageWithPricing() {
  return {
    id: "pkg-vpn",
    isActive: true,
    name: "VPN Pro",
    description: null,
    servers: [
      {
        server: {
          id: "server-1",
          name: "Jakarta",
          hasOpenVpn: true,
          hasWireGuard: false,
          hasProxy: false,
          region: { name: "Indonesia", slug: "indonesia", countryCode: "ID" },
        },
      },
    ],
    servicePlan: {
      id: "plan-vpn",
      isActive: true,
      package: { code: "VPN", isActive: true },
      pricings: [
        {
          id: "price-monthly",
          type: "BUNDLE",
          billingMode: "PACKAGE",
          billingPeriod: "MONTHLY",
          periodPrice: decimal("100000"),
          currency: "IDR",
          effectiveFrom: new Date("2026-01-01T00:00:00Z"),
          effectiveTo: null,
          isActive: true,
        },
        {
          id: "price-annual",
          type: "BUNDLE",
          billingMode: "PACKAGE",
          billingPeriod: "ANNUAL",
          periodPrice: decimal("1000000"),
          currency: "IDR",
          effectiveFrom: new Date("2026-01-01T00:00:00Z"),
          effectiveTo: null,
          isActive: true,
        },
      ],
    },
  }
}

describe("VPN unified catalog", () => {
  it("exposes complete period offers and pricing IDs", () => {
    const result = toVpnPublicPackageDTO(
      packageWithPricing() as never,
      new Map(),
      new Date("2026-06-01T00:00:00Z")
    )

    expect(
      result.offers.map((offer) => [offer.pricingId, offer.periodMonths])
    ).toEqual([
      ["price-monthly", 1],
      ["price-annual", 12],
    ])
    expect(result.offers[1]?.periodPrice).toBe("1000000")
  })
})

describe("VPN purchase order handoff", () => {
  it("creates, charges, and fulfills the selected pricing offer", async () => {
    const findFirst = mock().mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: "vpn-sub-1",
      organizationId: "org-1",
      packageId: "pkg-vpn",
      status: "ACTIVE",
      serverAccounts: [],
    })
    const prisma = {
      vpnPackage: {
        findUnique: mock().mockResolvedValue({
          ...packageWithPricing(),
          servicePlanId: "plan-vpn",
          servers: [],
        }),
      },
      servicePricing: {
        findUnique: mock().mockResolvedValue({
          id: "price-annual",
          planId: "plan-vpn",
          type: "BUNDLE",
          billingMode: "PACKAGE",
          billingPeriod: "ANNUAL",
          periodPrice: decimal("1000000"),
          currency: "IDR",
          effectiveFrom: new Date("2026-01-01T00:00:00Z"),
          effectiveTo: null,
          isActive: true,
          servicePlan: {
            id: "plan-vpn",
            isActive: true,
            package: { code: "VPN", isActive: true },
          },
        }),
      },
      vpnSubscription: { findFirst },
    }
    const orders = {
      createOrder: mock().mockResolvedValue({ orderId: "order-1" }),
      chargeOrder: mock().mockResolvedValue({ orderId: "order-1" }),
      fulfillOrder: mock().mockResolvedValue({ orderId: "order-1" }),
    }
    const service = new VpnSubscriptionService(prisma as never, {
      orders: orders as never,
      emailService: {
        sendSubscriptionCreated: mock().mockResolvedValue(undefined),
      } as never,
    })

    await service.purchase({
      organizationId: "org-1",
      packageId: "pkg-vpn",
      pricingId: "price-annual",
      now: new Date("2026-06-01T00:00:00Z"),
    })

    expect(orders.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ pricingId: "price-annual" })
    )
    expect(orders.chargeOrder).toHaveBeenCalledWith("order-1")
    expect(orders.fulfillOrder).toHaveBeenCalledWith(
      "order-1",
      expect.objectContaining({ vpnPackageId: "pkg-vpn" })
    )
  })
})

describe("VPN renewal order handoff", () => {
  it("renews through the linked service subscription snapshot", async () => {
    const vpnSubscription = {
      findMany: mock()
        .mockResolvedValueOnce([
          {
            id: "vpn-sub-1",
            organizationId: "org-1",
            packageId: "pkg-vpn",
            serviceSubscriptionId: "service-sub-1",
            priceLocked: decimal("100000"),
            currency: "IDR",
            renewalFailedAt: null,
            serverAccounts: [],
          },
        ])
        .mockResolvedValueOnce([]),
      update: mock(),
    }
    const prisma = {
      vpnSubscription,
      vpnMobileDevice: {
        updateMany: mock().mockResolvedValue({ count: 0 }),
        deleteMany: mock().mockResolvedValue({ count: 0 }),
      },
      vpnPairingToken: { deleteMany: mock().mockResolvedValue({ count: 0 }) },
    }
    const orders = {
      renewServiceSubscription: mock().mockResolvedValue({
        orderId: "order-renew",
      }),
    }
    const service = new VpnRenewalService(
      prisma as never,
      {} as never,
      undefined,
      orders as never
    )

    const result = await service.renewDueSubscriptions(
      new Date("2026-06-15T00:00:00Z")
    )

    expect(result.renewed).toBe(1)
    expect(orders.renewServiceSubscription).toHaveBeenCalledWith(
      "service-sub-1",
      new Date("2026-06-15T00:00:00Z")
    )
  })
})
