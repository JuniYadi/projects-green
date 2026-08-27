import { describe, expect, it, mock } from "bun:test"
import { Prisma } from "@prisma/client"
import type { PrismaClient, ServiceType } from "@prisma/client"
import {
  BillingFulfillmentRegistry,
  createAppHostingFulfillmentAdapter,
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
    serviceProvisionAccount: { create: mock(), update: mock() },
    appManagedStock: { findFirst: mock(), update: mock() },
    whatsappDevice: { findMany: mock(), update: mock(), upsert: mock() },
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

  it("registers App Hosting, VPN, and WhatsApp by default", () => {
    const registry = createBillingFulfillmentRegistry()

    expect(registry.get("APP_HOSTING").packageCode).toBe("APP_HOSTING")
    expect(registry.get("VPN").packageCode).toBe("VPN")
    expect(registry.get("WHATSAPP").packageCode).toBe("WHATSAPP")
  })

  it("rejects an unregistered package with FULFILLMENT_NOT_CONFIGURED", () => {
    const registry = new BillingFulfillmentRegistry([])

    expect(() => registry.get("APP_HOSTING")).toThrow(
      "FULFILLMENT_NOT_CONFIGURED"
    )
  })
})

describe("App Hosting fulfillment adapter", () => {
  it("claims required dependencies and records their Vault-backed accounts", async () => {
    const prisma = createPrismaMock()
    prisma.servicePricing.findUnique.mockResolvedValue({
      ...vpnPricing,
      servicePlan: {
        ...vpnPricing.servicePlan,
        resources: {
          compute: { cpu: 2, memory: 4096 },
          networking: { egress: true },
          requiredDependencies: ["POSTGRESQL", "REDIS"],
        },
        package: { id: "package-app-hosting", code: "APP_HOSTING" as const },
      },
    })
    prisma.serviceProvisionAccount.create.mockResolvedValue({ id: "dep-1" })
    const claims = mock(async ({ serviceType }: { serviceType: string }) => ({
      id: `${serviceType.toLowerCase()}-stock`,
      serviceType,
      vaultPath: `stocks/${serviceType.toLowerCase()}`,
    }))
    const writeKV = mock(async () => ({ version: 3 }))
    const appHosting = createAppHostingFulfillmentAdapter(
      prisma as unknown as PrismaClient,
      {
        claimStock: claims,
        vault: { readKV: async () => ({ PASSWORD: "secret" }), writeKV },
      }
    )

    await expect(
      appHosting.create(
        fulfillmentInput({
          packageCode: "APP_HOSTING",
          metadata: {
            appHostingFulfillment: {
              stackId: "stack-1",
              deploymentId: "deployment-1",
              sourceType: "TEMPLATE",
              resourcePlanId: "starter",
            },
          },
        })
      )
    ).resolves.toEqual({ subscriptionId: "service-sub-1" })

    expect(claims).toHaveBeenNthCalledWith(1, {
      orgId: "org-1",
      stackId: "stack-1",
      serviceType: "POSTGRESQL",
      environment: "production",
    })
    expect(claims).toHaveBeenNthCalledWith(2, {
      orgId: "org-1",
      stackId: "stack-1",
      serviceType: "REDIS",
      environment: "production",
    })
    expect(writeKV).toHaveBeenCalledTimes(2)
    expect(prisma.serviceProvisionAccount.create).toHaveBeenCalledTimes(2)
    expect(prisma.serviceProvisionAccount.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          serviceType: "APP_HOSTING",
          targetId: "postgresql-stock",
          identifier: "POSTGRESQL",
          status: "PENDING",
          vaultPath: "tenants/org-1/stacks/stack-1/POSTGRESQL",
        }),
      })
    )
  })
  it("creates a subscription from safe deployment context without persisting secrets", async () => {
    const prisma = createPrismaMock()
    prisma.servicePricing.findUnique.mockResolvedValue({
      ...vpnPricing,
      servicePlan: {
        ...vpnPricing.servicePlan,
        package: { id: "package-app-hosting", code: "APP_HOSTING" as const },
      },
    })
    const appHosting = createAppHostingFulfillmentAdapter(
      prisma as unknown as PrismaClient
    )
    const context = {
      stackId: "stack-1",
      deploymentId: "deployment-1",
      sourceType: "TEMPLATE" as const,
      resourcePlanId: "starter" as const,
    }

    await expect(
      appHosting.create(
        fulfillmentInput({
          packageCode: "APP_HOSTING",
          metadata: {
            appHostingFulfillment: context,
            envVars: [{ key: "DATABASE_PASSWORD", value: "secret" }],
          },
        })
      )
    ).resolves.toEqual({ subscriptionId: "service-sub-1" })

    expect(prisma.serviceSubscription.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: { appHostingFulfillment: context },
        }),
      })
    )
  })

  it("returns an actionable failure for missing deployment context", async () => {
    const appHosting = createAppHostingFulfillmentAdapter(
      createPrismaMock() as unknown as PrismaClient
    )

    await expect(
      appHosting.create(
        fulfillmentInput({
          packageCode: "APP_HOSTING",
          metadata: { credentials: { token: "secret" } },
        })
      )
    ).rejects.toMatchObject({
      name: "AppHostingFulfillmentError",
      failure: {
        code: "APP_HOSTING_FULFILLMENT_CONTEXT_REQUIRED",
        retryable: false,
      },
    })
  })
})

describe("minimum commitment stamping", () => {
  const appHostingContext = {
    stackId: "stack-1",
    deploymentId: "deployment-1",
    sourceType: "TEMPLATE" as const,
    resourcePlanId: "starter" as const,
  }

  const appHostingInput = () =>
    fulfillmentInput({
      packageCode: "APP_HOSTING",
      metadata: { appHostingFulfillment: appHostingContext },
    })

  const pricing = (minimumCommitmentCycles: number | null) => ({
    ...vpnPricing,
    minimumCommitmentCycles,
    servicePlan: {
      ...vpnPricing.servicePlan,
      package: { id: "package-app-hosting", code: "APP_HOSTING" as const },
    },
  })

  it("stamps commitmentEndsAt on first create from pricing cycles", async () => {
    const prisma = createPrismaMock()
    prisma.servicePricing.findUnique.mockResolvedValue(pricing(3))
    prisma.serviceSubscription.findUnique.mockResolvedValue(null)

    const appHosting = createAppHostingFulfillmentAdapter(
      prisma as unknown as PrismaClient
    )
    await appHosting.create(appHostingInput())

    const createArg = prisma.serviceSubscription.create.mock.calls[0][0]
    expect(createArg.data.commitmentEndsAt).toEqual(
      new Date("2026-11-01T00:00:00.000Z")
    )
  })

  it("leaves commitmentEndsAt null when the offer has no commitment", async () => {
    const prisma = createPrismaMock()
    prisma.servicePricing.findUnique.mockResolvedValue(pricing(null))
    prisma.serviceSubscription.findUnique.mockResolvedValue(null)

    const appHosting = createAppHostingFulfillmentAdapter(
      prisma as unknown as PrismaClient
    )
    await appHosting.create(appHostingInput())

    const createArg = prisma.serviceSubscription.create.mock.calls[0][0]
    expect(createArg.data.commitmentEndsAt).toBeNull()
  })

  it("does not move commitmentEndsAt on renewal of an existing subscription", async () => {
    const prisma = createPrismaMock()
    prisma.servicePricing.findUnique.mockResolvedValue(pricing(3))
    prisma.serviceSubscription.findUnique.mockResolvedValue({
      id: "service-sub-1",
      organizationId: "org-1",
      packageId: "package-app-hosting",
      planId: "plan-1",
      metadata: null,
    })

    const appHosting = createAppHostingFulfillmentAdapter(
      prisma as unknown as PrismaClient
    )
    await appHosting.renew(appHostingInput())

    const updateArg = prisma.serviceSubscription.update.mock.calls[0][0]
    expect(updateArg.data.commitmentEndsAt).toBeUndefined()
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
  it("uses VPN server and protocol resources and provisioning username", async () => {
    const prisma = createPrismaMock()
    prisma.servicePricing.findUnique.mockResolvedValue({
      ...vpnPricing,
      servicePlan: {
        ...vpnPricing.servicePlan,
        resources: {
          serverIds: ["server-1"],
          allowedProtocols: ["WIREGUARD"],
        },
      },
    })
    const dispatch = mock(async (_accountId: string) => {})
    const vpn = createVpnFulfillmentAdapter(prisma as unknown as PrismaClient, {
      dispatch,
      username: () => "fallback-user",
    })

    await vpn.create(
      fulfillmentInput({
        metadata: { provisioningAnswers: { username: "chosen-user" } },
      })
    )

    expect(prisma.vpnServerAccount.create).toHaveBeenCalledTimes(1)
    expect(prisma.vpnServerAccount.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          serverId: "server-1",
          protocol: "WIREGUARD",
          username: "chosen-user",
        }),
      })
    )
    expect(prisma.serviceProvisionAccount.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          serviceType: "VPN",
          targetId: "server-1",
          identifier: "chosen-user",
          status: "PENDING",
        }),
      })
    )
    expect(dispatch).toHaveBeenCalledWith("account-openvpn")
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

  it("creates pending WhatsApp device and subscription when new device metadata is provided", async () => {
    const prisma = createPrismaMock()
    prisma.servicePricing.findUnique.mockResolvedValue(whatsappPricing)
    prisma.whatsappDevice.upsert.mockResolvedValue({
      id: "device-new-1",
      phoneNumber: "+6281234567890",
      status: "NON_ACTIVE",
      quotaBase: decimal("1000"),
    })
    prisma.serviceSubscription.create.mockResolvedValue({
      id: "service-sub-new",
      organizationId: "org-1",
      packageId: "package-whatsapp",
      planId: "plan-1",
    })
    const whatsapp = createWhatsappFulfillmentAdapter(
      prisma as unknown as PrismaClient
    )
    const metadata = {
      device: {
        phoneNumber: "+6281234567890",
        displayName: "My Business",
        profilePictureUrl: "https://example.com/avatar.png",
      },
    }

    const result = await whatsapp.create(whatsappInput(metadata))
    expect(result).toEqual({ subscriptionId: "service-sub-new" })
    expect(prisma.whatsappDevice.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { phoneNumber: "+6281234567890" },
        create: expect.objectContaining({
          organizationId: "org-1",
          phoneNumber: "+6281234567890",
          status: "NON_ACTIVE",
        }),
      })
    )
  })

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
