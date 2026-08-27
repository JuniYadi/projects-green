import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Prisma } from "@prisma/client"
import type { PrismaClient } from "@prisma/client"

const dispatch = mock(async (_id: string) => {})
const mockPrisma = {
  $transaction: mock(),
  servicePricing: { findUnique: mock() },
  serviceSubscription: {
    findUnique: mock(),
    create: mock(),
    update: mock(),
  },
  vpnPackage: { findFirst: mock() },
  vpnSubscription: {
    findFirst: mock(),
    create: mock(),
    update: mock(),
  },
  vpnServerAccount: { create: mock(), update: mock() },
  serviceProvisionAccount: { create: mock(), update: mock() },
  whatsappDevice: { findMany: mock(), update: mock() },
}

mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }))
mock.module("@/lib/queue/vpn-provisioning", () => ({
  VpnProvisioningJob: { dispatch },
}))

const { createVpnFulfillmentAdapter, createWhatsappFulfillmentAdapter } =
  await import("./fulfillment-adapters")

const decimal = (value: string) => new Prisma.Decimal(value)
const pricing = {
  id: "pricing-1",
  type: "BUNDLE" as const,
  billingMode: "PACKAGE" as const,
  billingPeriod: "MONTHLY" as const,
  periodPrice: decimal("100"),
  currency: "IDR",
  servicePlan: {
    id: "plan-1",
    code: "vpn-plan",
    packageId: "package-1",
    package: { id: "package-1", code: "VPN" as const },
  },
}

beforeEach(() => {
  for (const model of Object.values(mockPrisma)) {
    if (typeof model === "function") model.mockReset()
    else if (model && typeof model === "object") {
      for (const fn of Object.values(model)) fn.mockReset()
    }
  }
  dispatch.mockReset()
  mockPrisma.$transaction.mockImplementation(
    async (fn: (tx: unknown) => unknown) => fn(mockPrisma)
  )
  mockPrisma.servicePricing.findUnique.mockResolvedValue(pricing)
  mockPrisma.serviceSubscription.findUnique.mockResolvedValue(null)
  mockPrisma.serviceSubscription.create.mockResolvedValue({
    id: "service-sub-1",
  })
  mockPrisma.serviceSubscription.update.mockResolvedValue({
    id: "service-sub-1",
  })
  mockPrisma.vpnPackage.findFirst.mockResolvedValue({
    id: "vpn-package-1",
    servicePlanId: "plan-1",
    isActive: true,
    servers: [
      {
        server: {
          id: "server-1",
          hasOpenVpn: true,
          hasWireGuard: true,
          hasProxy: false,
        },
      },
    ],
  })
  mockPrisma.vpnSubscription.findFirst.mockResolvedValue(null)
  mockPrisma.vpnSubscription.create.mockResolvedValue({ id: "vpn-sub-1" })
  mockPrisma.vpnSubscription.update.mockResolvedValue({ id: "vpn-sub-1" })
  mockPrisma.vpnServerAccount.create
    .mockResolvedValueOnce({ id: "account-openvpn" })
    .mockResolvedValueOnce({ id: "account-wireguard" })
  mockPrisma.serviceProvisionAccount.create
    .mockResolvedValueOnce({ id: "provision-openvpn" })
    .mockResolvedValueOnce({ id: "provision-wireguard" })
  mockPrisma.vpnServerAccount.update.mockResolvedValue({
    id: "account-updated",
  })
})

describe("concrete billing fulfillment adapters", () => {
  it("bridges VPN service plan to package, snapshots price, creates accounts, and dispatches provisioning", async () => {
    mockPrisma.servicePricing.findUnique.mockResolvedValue({
      ...pricing,
      periodPrice: decimal("200"),
      currency: "USD",
    })
    const adapter = createVpnFulfillmentAdapter(
      mockPrisma as unknown as PrismaClient,
      { username: () => "vpn-user", dispatch }
    )

    const result = await adapter.create({
      orderId: "order-1",
      organizationId: "org-1",
      pricingId: "pricing-1",
      packageCode: "VPN",
      planId: "plan-1",
      quantity: decimal("1"),
      unitPrice: decimal("100"),
      currency: "IDR",
      periodStart: new Date("2026-08-01T00:00:00Z"),
      periodEnd: new Date("2026-09-01T00:00:00Z"),
      metadata: {},
    })

    expect(result).toEqual({ subscriptionId: "service-sub-1" })
    expect(mockPrisma.vpnPackage.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { servicePlanId: "plan-1" } })
    )
    expect(mockPrisma.vpnSubscription.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          packageId: "vpn-package-1",
          serviceSubscriptionId: "service-sub-1",
          priceLocked: decimal("100"),
          currency: "IDR",
        }),
      })
    )
    expect(mockPrisma.vpnServerAccount.create).toHaveBeenCalledTimes(2)
    expect(mockPrisma.serviceProvisionAccount.create).toHaveBeenCalledTimes(2)
    expect(mockPrisma.serviceProvisionAccount.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          serviceType: "VPN",
          status: "PENDING",
          targetId: "server-1",
        }),
      })
    )
    expect(dispatch).toHaveBeenCalledTimes(2)
  })
  it("reads VPN configuration from the provisioning resource partition", async () => {
    mockPrisma.servicePricing.findUnique.mockResolvedValue({
      ...pricing,
      servicePlan: {
        ...pricing.servicePlan,
        resources: {
          features: { label: "Commercial plan" },
          provisioning: { allowedProtocols: ["OPENVPN"] },
        },
      },
    })
    const adapter = createVpnFulfillmentAdapter(
      mockPrisma as unknown as PrismaClient,
      { username: () => "vpn-user", dispatch }
    )

    await adapter.create({
      orderId: "order-partitioned",
      organizationId: "org-1",
      pricingId: "pricing-1",
      packageCode: "VPN",
      planId: "plan-1",
      quantity: decimal("1"),
      unitPrice: decimal("100"),
      currency: "IDR",
      periodStart: new Date("2026-08-01T00:00:00Z"),
      periodEnd: new Date("2026-09-01T00:00:00Z"),
      metadata: {},
    })

    expect(mockPrisma.vpnServerAccount.create).toHaveBeenCalledTimes(1)
    expect(mockPrisma.vpnServerAccount.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ protocol: "OPENVPN" }),
      })
    )
  })
  it("rejects a subscription id owned by another organization", async () => {
    mockPrisma.serviceSubscription.findUnique.mockResolvedValue({
      id: "foreign-subscription",
      organizationId: "org-2",
      packageId: "package-1",
      planId: "plan-1",
      metadata: null,
    })
    const adapter = createVpnFulfillmentAdapter(
      mockPrisma as unknown as PrismaClient,
      { username: () => "vpn-user", dispatch }
    )

    await expect(
      adapter.create({
        orderId: "order-foreign",
        organizationId: "org-1",
        pricingId: "pricing-1",
        packageCode: "VPN",
        planId: "plan-1",
        quantity: decimal("1"),
        unitPrice: decimal("100"),
        currency: "IDR",
        periodStart: new Date("2026-08-01T00:00:00Z"),
        periodEnd: new Date("2026-09-01T00:00:00Z"),
        metadata: { subscriptionId: "foreign-subscription" },
      })
    ).rejects.toThrow("SUBSCRIPTION_NOT_FOUND")
    expect(mockPrisma.serviceSubscription.create).not.toHaveBeenCalled()
  })

  it("retries provisioning for existing inactive VPN accounts", async () => {
    mockPrisma.vpnSubscription.findFirst.mockResolvedValue({
      id: "vpn-sub-1",
      serverAccounts: [
        {
          id: "account-openvpn",
          serverId: "server-1",
          protocol: "OPENVPN",
          provisioningStatus: "PENDING",
        },
        {
          id: "account-wireguard",
          serverId: "server-1",
          protocol: "WIREGUARD",
          provisioningStatus: "FAILED",
        },
      ],
    })
    const adapter = createVpnFulfillmentAdapter(
      mockPrisma as unknown as PrismaClient,
      { username: () => "vpn-user", dispatch }
    )

    await adapter.create({
      orderId: "order-retry",
      organizationId: "org-1",
      pricingId: "pricing-1",
      packageCode: "VPN",
      planId: "plan-1",
      quantity: decimal("1"),
      unitPrice: decimal("100"),
      currency: "IDR",
      periodStart: new Date("2026-08-01T00:00:00Z"),
      periodEnd: new Date("2026-09-01T00:00:00Z"),
      metadata: {},
    })

    expect(mockPrisma.vpnServerAccount.create).not.toHaveBeenCalled()
    expect(mockPrisma.vpnServerAccount.update).toHaveBeenCalledTimes(2)
    expect(dispatch).toHaveBeenNthCalledWith(1, "account-openvpn")
    expect(dispatch).toHaveBeenNthCalledWith(2, "account-wireguard")
  })

  it("creates WhatsApp subscription and resets explicit active device allowances", async () => {
    mockPrisma.servicePricing.findUnique.mockResolvedValue({
      ...pricing,
      servicePlan: {
        ...pricing.servicePlan,
        package: { id: "package-2", code: "WHATSAPP" as const },
      },
    })
    mockPrisma.whatsappDevice.findMany.mockResolvedValue([
      { id: "device-1" },
      { id: "device-2" },
    ])
    const adapter = createWhatsappFulfillmentAdapter(
      mockPrisma as unknown as PrismaClient
    )

    const result = await adapter.create({
      orderId: "order-2",
      organizationId: "org-1",
      pricingId: "pricing-1",
      packageCode: "WHATSAPP",
      planId: "plan-1",
      quantity: decimal("2"),
      unitPrice: decimal("100"),
      currency: "IDR",
      periodStart: new Date("2026-08-01T00:00:00Z"),
      periodEnd: new Date("2026-09-01T00:00:00Z"),
      metadata: {
        deviceIds: ["device-1", "device-2"],
        allowanceByDevice: { "device-1": 1000, "device-2": 2000 },
      },
    })

    expect(result).toEqual({ subscriptionId: "service-sub-1" })
    expect(mockPrisma.whatsappDevice.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { id: "device-1" },
        data: { quotaBaseOut: decimal("1000"), quotaBase: decimal("1000") },
      })
    )
    expect(mockPrisma.whatsappDevice.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: "device-2" },
        data: { quotaBaseOut: decimal("2000"), quotaBase: decimal("2000") },
      })
    )
  })
  it("renews VPN fulfillment from the locked subscription snapshot", async () => {
    mockPrisma.serviceSubscription.findUnique.mockResolvedValue({
      id: "service-sub-existing",
      organizationId: "org-1",
      packageId: "package-1",
      planId: "plan-1",
      pricingId: "pricing-1",
      metadata: { renewal: true },
      priceLocked: decimal("900"),
      currency: "IDR",
      billingPeriod: "ANNUAL",
    })
    const adapter = createVpnFulfillmentAdapter(
      mockPrisma as unknown as PrismaClient,
      { username: () => "vpn-user", dispatch }
    )

    await adapter.renew({
      orderId: "renewal-order",
      organizationId: "org-1",
      pricingId: "pricing-1",
      packageCode: "VPN",
      planId: "plan-1",
      quantity: decimal("1"),
      unitPrice: decimal("900"),
      currency: "IDR",
      periodStart: new Date("2026-08-01T00:00:00Z"),
      periodEnd: new Date("2027-08-01T00:00:00Z"),
      metadata: { renewal: true, subscriptionId: "service-sub-existing" },
    })

    expect(mockPrisma.serviceSubscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ priceLocked: decimal("900") }),
      })
    )
    expect(mockPrisma.vpnSubscription.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ priceLocked: decimal("900") }),
      })
    )
  })
})
