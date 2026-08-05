import { describe, expect, it, mock } from "bun:test"
import { Prisma } from "@prisma/client"
import type { PrismaClient, ServiceType } from "@prisma/client"
import {
  BillingFulfillmentRegistry,
  createBillingFulfillmentRegistry,
  createVpnFulfillmentAdapter,
  createWhatsappFulfillmentAdapter,
  type BillingFulfillmentAdapter,
  type BillingFulfillmentInput,
} from "./fulfillment-adapters"

const adapter = (packageCode: ServiceType): BillingFulfillmentAdapter => ({
  packageCode,
  create: async () => ({ subscriptionId: "sub-1" }),
  renew: async () => {},
})

const decimal = (value: string) => new Prisma.Decimal(value)

const vpnPricing = {
  id: "pricing-1",
  type: "BUNDLE" as const,
  billingMode: "PACKAGE" as const,
  billingPeriod: "MONTHLY" as const,
  periodPrice: decimal("100"),
  currency: "IDR",
  servicePlan: {
    id: "plan-1",
    packageId: "package-vpn",
    package: { id: "package-vpn", code: "VPN" as const },
  },
}

const fulfillmentInput = (
  overrides: Partial<BillingFulfillmentInput> = {}
): BillingFulfillmentInput => ({
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
  ...overrides,
})

const createPrismaMock = () => {
  const prisma = {
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
    whatsappDevice: { findMany: mock(), update: mock() },
  }
  prisma.$transaction.mockImplementation(
    async (fn: (tx: typeof prisma) => unknown) => fn(prisma)
  )
  prisma.servicePricing.findUnique.mockResolvedValue(vpnPricing)
  prisma.serviceSubscription.findUnique.mockResolvedValue(null)
  prisma.serviceSubscription.create.mockResolvedValue({
    id: "service-sub-1",
    organizationId: "org-1",
    packageId: "package-vpn",
    planId: "plan-1",
    metadata: {},
  })
  prisma.serviceSubscription.update.mockResolvedValue({
    id: "service-sub-1",
    organizationId: "org-1",
    packageId: "package-vpn",
    planId: "plan-1",
    metadata: {},
  })
  prisma.vpnPackage.findFirst.mockResolvedValue({
    id: "vpn-package-1",
    servicePlanId: "plan-1",
    isActive: true,
    servers: [
      {
        server: {
          id: "server-1",
          hasOpenVpn: true,
          hasWireGuard: true,
          hasProxy: true,
        },
      },
    ],
  })
  prisma.vpnSubscription.findFirst.mockResolvedValue(null)
  prisma.vpnSubscription.create.mockResolvedValue({ id: "vpn-sub-1" })
  prisma.vpnSubscription.update.mockResolvedValue({ id: "vpn-sub-1" })
  prisma.vpnServerAccount.create
    .mockResolvedValueOnce({ id: "account-openvpn" })
    .mockResolvedValueOnce({ id: "account-wireguard" })
    .mockResolvedValueOnce({ id: "account-proxy" })
  prisma.vpnServerAccount.update.mockResolvedValue({ id: "account-updated" })
  prisma.whatsappDevice.findMany.mockResolvedValue([])
  prisma.whatsappDevice.update.mockResolvedValue({ id: "device-1" })
  return prisma
}

describe("BillingFulfillmentRegistry", () => {
  it("selects by package code without plan-code guessing", () => {
    const registry = new BillingFulfillmentRegistry([
      adapter("VPN"),
      adapter("WHATSAPP"),
    ])

    expect(registry.get("VPN").packageCode).toBe("VPN")
    expect(registry.get("WHATSAPP").packageCode).toBe("WHATSAPP")
  })

  it("registers exactly VPN and WhatsApp by default while leaving App Hosting unconfigured", () => {
    const registry = createBillingFulfillmentRegistry()

    expect(registry.get("VPN").packageCode).toBe("VPN")
    expect(registry.get("WHATSAPP").packageCode).toBe("WHATSAPP")
    expect(() => registry.get("APP_HOSTING")).toThrow(
      "FULFILLMENT_NOT_CONFIGURED"
    )
  })

  it("rejects an unregistered package with FULFILLMENT_NOT_CONFIGURED", () => {
    const registry = new BillingFulfillmentRegistry([])

    expect(() => registry.get("APP_HOSTING")).toThrow(
      "FULFILLMENT_NOT_CONFIGURED"
    )
  })
})

describe("VPN fulfillment adapter", () => {
  it("creates all enabled protocol accounts in a transaction and dispatches each", async () => {
    const prisma = createPrismaMock()
    const dispatch = mock(async (_accountId: string) => {})
    const username = mock((organizationId: string) => `${organizationId}-vpn`)
    const vpn = createVpnFulfillmentAdapter(prisma as unknown as PrismaClient, {
      dispatch,
      username,
    })

    await expect(vpn.create(fulfillmentInput())).resolves.toEqual({
      subscriptionId: "service-sub-1",
    })

    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    expect(prisma.vpnSubscription.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          serviceSubscriptionId: "service-sub-1",
          priceLocked: decimal("100"),
        }),
      })
    )
    expect(prisma.vpnServerAccount.create).toHaveBeenCalledTimes(3)
    expect(prisma.vpnServerAccount.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          protocol: "OPENVPN",
          username: "org-1-vpn",
          provisioningStatus: "PENDING",
        }),
      })
    )
    expect(prisma.vpnServerAccount.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({ protocol: "WIREGUARD" }),
      })
    )
    expect(prisma.vpnServerAccount.create).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        data: expect.objectContaining({ protocol: "PROXY" }),
      })
    )
    expect(username).toHaveBeenCalledWith("org-1")
    expect(dispatch).toHaveBeenNthCalledWith(1, "account-openvpn")
    expect(dispatch).toHaveBeenNthCalledWith(2, "account-wireguard")
    expect(dispatch).toHaveBeenNthCalledWith(3, "account-proxy")
  })

  it("updates inactive existing accounts while retaining active accounts", async () => {
    const prisma = createPrismaMock()
    prisma.vpnSubscription.findFirst.mockResolvedValue({
      id: "vpn-sub-existing",
      serverAccounts: [
        {
          id: "active-account",
          serverId: "server-1",
          protocol: "OPENVPN",
          provisioningStatus: "ACTIVE",
        },
        {
          id: "failed-account",
          serverId: "server-1",
          protocol: "WIREGUARD",
          provisioningStatus: "FAILED",
        },
        {
          id: "pending-account",
          serverId: "server-1",
          protocol: "PROXY",
          provisioningStatus: "PENDING",
        },
      ],
    })
    const dispatch = mock(async (_accountId: string) => {})
    const vpn = createVpnFulfillmentAdapter(prisma as unknown as PrismaClient, {
      dispatch,
      username: () => "unused",
    })

    await vpn.renew(fulfillmentInput({ metadata: { renewal: true } }))

    expect(prisma.vpnSubscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "vpn-sub-existing" },
        data: expect.objectContaining({ status: "ACTIVE" }),
      })
    )
    expect(prisma.vpnServerAccount.create).not.toHaveBeenCalled()
    expect(prisma.vpnServerAccount.update).toHaveBeenCalledTimes(2)
    expect(prisma.vpnServerAccount.update).toHaveBeenCalledWith({
      where: { id: "failed-account" },
      data: { provisioningStatus: "PENDING", failureReason: null },
    })
    expect(prisma.vpnServerAccount.update).toHaveBeenCalledWith({
      where: { id: "pending-account" },
      data: { provisioningStatus: "PENDING", failureReason: null },
    })
    expect(dispatch).toHaveBeenCalledTimes(2)
    expect(dispatch).toHaveBeenNthCalledWith(1, "failed-account")
    expect(dispatch).toHaveBeenNthCalledWith(2, "pending-account")
  })

  it("rejects missing, mismatched, and non-recurring pricing before provisioning", async () => {
    const cases = [
      ["missing pricing", null, "PRICING_NOT_FOUND"],
      [
        "plan mismatch",
        {
          ...vpnPricing,
          servicePlan: { ...vpnPricing.servicePlan, id: "other-plan" },
        },
        "PLAN_PRICING_MISMATCH",
      ],
      [
        "package mismatch",
        {
          ...vpnPricing,
          servicePlan: {
            ...vpnPricing.servicePlan,
            package: { id: "package-wa", code: "WHATSAPP" as const },
          },
        },
        "PACKAGE_PRICING_MISMATCH",
      ],
      [
        "null billing period",
        { ...vpnPricing, billingPeriod: null },
        "PRICING_NOT_RECURRING",
      ],
      [
        "custom billing period",
        { ...vpnPricing, billingPeriod: "CUSTOM" as const },
        "PRICING_NOT_RECURRING",
      ],
    ] as const

    for (const [_label, selectedPricing, error] of cases) {
      const prisma = createPrismaMock()
      prisma.servicePricing.findUnique.mockResolvedValue(selectedPricing)
      const vpn = createVpnFulfillmentAdapter(
        prisma as unknown as PrismaClient,
        {
          dispatch: async () => {},
          username: () => "vpn-user",
        }
      )

      await expect(vpn.create(fulfillmentInput())).rejects.toThrow(error)
      expect(prisma.vpnPackage.findFirst).not.toHaveBeenCalled()
      expect(prisma.serviceSubscription.create).not.toHaveBeenCalled()
    }
  })

  it("rejects an inactive or missing VPN package", async () => {
    for (const vpnPackage of [
      null,
      {
        id: "vpn-package-1",
        servicePlanId: "plan-1",
        isActive: false,
        servers: [],
      },
    ]) {
      const prisma = createPrismaMock()
      prisma.vpnPackage.findFirst.mockResolvedValue(vpnPackage)
      const vpn = createVpnFulfillmentAdapter(
        prisma as unknown as PrismaClient,
        {
          dispatch: async () => {},
          username: () => "vpn-user",
        }
      )

      await expect(vpn.create(fulfillmentInput())).rejects.toThrow(
        "VPN_PACKAGE_NOT_FOUND"
      )
      expect(prisma.vpnSubscription.create).not.toHaveBeenCalled()
    }
  })

  it("rejects an explicit subscription belonging to another organization", async () => {
    const prisma = createPrismaMock()
    prisma.serviceSubscription.findUnique.mockResolvedValue({
      id: "foreign-subscription",
      organizationId: "org-2",
      packageId: "package-vpn",
      planId: "plan-1",
      metadata: null,
    })
    const vpn = createVpnFulfillmentAdapter(prisma as unknown as PrismaClient, {
      dispatch: async () => {},
      username: () => "vpn-user",
    })

    await expect(
      vpn.create(
        fulfillmentInput({
          metadata: { subscriptionId: "foreign-subscription" },
        })
      )
    ).rejects.toThrow("SUBSCRIPTION_NOT_FOUND")
    expect(prisma.vpnPackage.findFirst).not.toHaveBeenCalled()
  })
})

describe("WhatsApp fulfillment adapter", () => {
  const whatsappPricing = {
    ...vpnPricing,
    servicePlan: {
      ...vpnPricing.servicePlan,
      packageId: "package-whatsapp",
      package: { id: "package-whatsapp", code: "WHATSAPP" as const },
    },
  }

  const whatsappInput = (
    metadata: Record<string, unknown>
  ): BillingFulfillmentInput =>
    fulfillmentInput({ packageCode: "WHATSAPP", metadata })

  it("creates and renews allowances for active devices while merging metadata", async () => {
    const prisma = createPrismaMock()
    prisma.servicePricing.findUnique.mockResolvedValue(whatsappPricing)
    prisma.serviceSubscription.findUnique.mockResolvedValue({
      id: "service-sub-existing",
      organizationId: "org-1",
      packageId: "package-whatsapp",
      planId: "plan-1",
      metadata: { prior: true },
    })
    prisma.serviceSubscription.update.mockResolvedValue({
      id: "service-sub-existing",
      organizationId: "org-1",
      packageId: "package-whatsapp",
      planId: "plan-1",
      metadata: { prior: true },
    })
    prisma.whatsappDevice.findMany.mockResolvedValue([
      { id: "device-1" },
      { id: "device-2" },
    ])
    const whatsapp = createWhatsappFulfillmentAdapter(
      prisma as unknown as PrismaClient
    )
    const metadata = {
      subscriptionId: "service-sub-existing",
      deviceIds: ["device-1", "device-2"],
      allowanceByDevice: { "device-1": 1000, "device-2": "2000" },
      current: "renewed",
    }

    await expect(whatsapp.create(whatsappInput(metadata))).resolves.toEqual({
      subscriptionId: "service-sub-existing",
    })
    await expect(
      whatsapp.renew(whatsappInput(metadata))
    ).resolves.toBeUndefined()

    expect(prisma.$transaction).toHaveBeenCalledTimes(2)
    expect(prisma.serviceSubscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "service-sub-existing" },
        data: expect.objectContaining({
          packageId: "package-whatsapp",
          metadata: expect.objectContaining({
            prior: true,
            current: "renewed",
          }),
        }),
      })
    )
    expect(prisma.whatsappDevice.update).toHaveBeenCalledTimes(4)
    expect(prisma.whatsappDevice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "device-1" },
        data: { quotaBaseOut: decimal("1000"), quotaBase: decimal("1000") },
      })
    )
    expect(prisma.whatsappDevice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "device-2" },
        data: { quotaBaseOut: decimal("2000"), quotaBase: decimal("2000") },
      })
    )
  })

  it("rejects malformed allowance metadata and negative allowances", async () => {
    const cases: Array<[string, Record<string, unknown>]> = [
      ["missing devices", {}],
      ["non-string device", { deviceIds: ["device-1", 2] }],
      ["missing allowances", { deviceIds: ["device-1"] }],
      ["array allowances", { deviceIds: ["device-1"], allowanceByDevice: [] }],
      [
        "missing device allowance",
        { deviceIds: ["device-1"], allowanceByDevice: { "device-2": 10 } },
      ],
      [
        "negative allowance",
        { deviceIds: ["device-1"], allowanceByDevice: { "device-1": -1 } },
      ],
    ]
    const expectedErrors = [
      "WHATSAPP_DEVICE_METADATA_REQUIRED",
      "WHATSAPP_DEVICE_METADATA_REQUIRED",
      "WHATSAPP_ALLOWANCE_METADATA_REQUIRED",
      "WHATSAPP_ALLOWANCE_METADATA_REQUIRED",
      "WHATSAPP_ALLOWANCE_METADATA_REQUIRED",
      "WHATSAPP_ALLOWANCE_INVALID",
    ]

    for (let index = 0; index < cases.length; index += 1) {
      const prisma = createPrismaMock()
      prisma.servicePricing.findUnique.mockResolvedValue(whatsappPricing)
      const whatsapp = createWhatsappFulfillmentAdapter(
        prisma as unknown as PrismaClient
      )

      await expect(
        whatsapp.create(whatsappInput(cases[index][1]))
      ).rejects.toThrow(expectedErrors[index])
      expect(prisma.whatsappDevice.findMany).not.toHaveBeenCalled()
      expect(prisma.serviceSubscription.create).not.toHaveBeenCalled()
    }
  })

  it("rejects when any requested device is not active", async () => {
    const prisma = createPrismaMock()
    prisma.servicePricing.findUnique.mockResolvedValue(whatsappPricing)
    prisma.whatsappDevice.findMany.mockResolvedValue([{ id: "device-1" }])
    const whatsapp = createWhatsappFulfillmentAdapter(
      prisma as unknown as PrismaClient
    )

    await expect(
      whatsapp.create(
        whatsappInput({
          deviceIds: ["device-1", "device-2"],
          allowanceByDevice: { "device-1": 10, "device-2": 20 },
        })
      )
    ).rejects.toThrow("WHATSAPP_DEVICE_NOT_ACTIVE")
    expect(prisma.serviceSubscription.create).not.toHaveBeenCalled()
    expect(prisma.whatsappDevice.update).not.toHaveBeenCalled()
  })
})

describe("BillingFulfillmentRegistry validation", () => {
  it("rejects duplicate package adapters", () => {
    expect(
      () => new BillingFulfillmentRegistry([adapter("VPN"), adapter("VPN")])
    ).toThrow("DUPLICATE_FULFILLMENT_ADAPTER:VPN")
  })
})
