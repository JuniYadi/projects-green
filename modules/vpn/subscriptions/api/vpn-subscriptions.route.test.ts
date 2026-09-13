mock.module("server-only", () => ({}))

import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"
import { Prisma } from "@prisma/client"

import {
  type VpnSubscriptionService,
  VpnBillingAccountNotFoundError,
  VpnDuplicateSubscriptionError,
  VpnInsufficientBalanceError,
  VpnPackageUnavailableError,
  VpnSubscriptionNotFoundError,
} from "../vpn-subscription.service"

const mockPackageFindMany = mock()
const mockBillingAccountFindUnique = mock()
const mockBillingAdjustmentFindMany = mock()
const mockBundleVpnConfigs = mock()
const mockDecryptProxyPassword = mock()
const mockLogAuditEvent = mock()

mock.module("@/lib/prisma", () => ({
  prisma: {
    vpnPackage: {
      findMany: mockPackageFindMany,
    },
    billingAccount: {
      findUnique: mockBillingAccountFindUnique,
    },
    billingAdjustment: {
      findMany: mockBillingAdjustmentFindMany,
    },
  },
}))

mock.module("@/lib/audit.service", () => ({
  logAuditEvent: mockLogAuditEvent,
}))

mock.module("@/modules/vpn/vpn-crypto", () => ({
  decryptVpnConfig: mock(() => "decrypted config"),
  decryptProxyPassword: mockDecryptProxyPassword,
}))

mock.module("../vpn-zip-bundle.service", () => ({
  bundleVpnConfigs: mockBundleVpnConfigs,
}))

mock.module("@/lib/queue/vpn-provisioning", () => ({
  VpnProvisioningJob: {
    dispatch: mock().mockResolvedValue(undefined),
  },
}))
mock.module("@/lib/encryption", () => ({
  encrypt: mock(() => ({ encrypted: "fake", iv: "fake", tag: "fake" })),
  decrypt: mock(() => "test openvpn config"),
  parseEncryptedField: mock((v: string) => JSON.parse(v)),
  serializeEncryptedField: mock((v: unknown) => JSON.stringify(v)),
  getEncryptionKey: mock(() => Buffer.alloc(32)),
  deriveEncryptionKey: mock(() => Buffer.alloc(32)),
}))

const { createVpnSubscriptionRoutes } =
  await import("./vpn-subscriptions.route")

const subscription = {
  id: "sub_1",
  organizationId: "org_1",
  packageId: "pkg_1",
  packageName: "Standard VPN",
  status: "ACTIVE",
  priceLocked: new Prisma.Decimal("3240"),
  currency: "IDR",
  originalPrice: new Prisma.Decimal("0.50"),
  originalCurrency: "USD",
  exchangeRate: new Prisma.Decimal("6480"),
  currentPeriodStart: new Date("2026-06-01T00:00:00Z"),
  currentPeriodEnd: new Date("2026-07-01T00:00:00Z"),
  renewalFailedAt: null,
  cancelAtPeriodEnd: false,
  createdAt: new Date("2026-06-01T00:00:00Z"),
  updatedAt: new Date("2026-06-01T00:00:00Z"),
  _count: { mobileDevices: 0 },
  serverAccounts: [
    {
      id: "sa_1",
      serverId: "srv_1",
      subscriptionId: "sub_1",
      protocol: "OPENVPN",
      username: "org-test",
      provisioningStatus: "ACTIVE",
      failureReason: null,
      configEncrypted: "encrypted",
      password: null,
      createdAt: new Date("2026-06-01T00:00:00Z"),
      updatedAt: new Date("2026-06-01T00:00:00Z"),
      server: {
        id: "srv_1",
        name: "SG01",
        hostname: "sg01.vpn.example.com",
        ipAddress: "203.0.113.10",
        openVpnPort: 1194,
        wireGuardPort: 51820,
        proxyPort: 3128,
        region: {
          id: "reg_1",
          name: "Singapore",
          slug: "singapore",
          countryCode: "sg",
        },
      },
    },
  ],
}

describe("VPN subscription routes", () => {
  beforeEach(() => {
    mockPackageFindMany.mockClear()
    mockPackageFindMany.mockResolvedValue([{ id: "pkg_1", name: "VPN SG" }])
    mockBillingAccountFindUnique.mockClear()
    mockBillingAccountFindUnique.mockResolvedValue({ id: "ba_1" })
    mockBillingAdjustmentFindMany.mockClear()
    mockBillingAdjustmentFindMany.mockResolvedValue([])
    mockBundleVpnConfigs.mockClear()
    mockBundleVpnConfigs.mockReturnValue(Buffer.from("zip"))
    mockDecryptProxyPassword.mockClear()
    mockDecryptProxyPassword.mockReturnValue("decrypted-password")
    mockLogAuditEvent.mockClear()
    mockLogAuditEvent.mockResolvedValue(undefined)
  })

  it("returns package names for customer subscriptions", async () => {
    const service = {
      listForOrganization: mock().mockResolvedValue([subscription]),
    }

    const app = new Elysia().use(
      createVpnSubscriptionRoutes({
        authenticate: async () => ({
          organizationId: "org_1",
          user: { id: "user_1" },
        }),
        service: service as unknown as VpnSubscriptionService,
      })
    )

    const response = await app.handle(
      new Request("http://localhost/vpn/subscriptions")
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.data[0].packageName).toBe("VPN SG")
    expect(mockPackageFindMany).toHaveBeenCalledWith({
      where: { id: { in: ["pkg_1"] } },
      select: { id: true, name: true },
    })
  })

  it("forwards pricingId to the purchase service", async () => {
    const purchase = mock().mockResolvedValue(subscription)
    const service = {
      purchase,
    }

    const app = new Elysia().use(
      createVpnSubscriptionRoutes({
        authenticate: async () => ({
          organizationId: "org_1",
          user: { id: "user_1" },
        }),
        service: service as unknown as VpnSubscriptionService,
      })
    )

    const response = await app.handle(
      new Request("http://localhost/vpn/packages/pkg_1/purchase", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pricingId: "pricing_1" }),
      })
    )

    expect(response.status).toBe(201)
    expect(purchase).toHaveBeenCalledWith({
      organizationId: "org_1",
      packageId: "pkg_1",
      pricingId: "pricing_1",
    })
  })

  it("rejects a purchase when pricingId is missing", async () => {
    const purchase = mock().mockResolvedValue(subscription)
    const app = new Elysia().use(
      createVpnSubscriptionRoutes({
        authenticate: async () => ({
          organizationId: "org_1",
          user: { id: "user_1" },
        }),
        service: { purchase } as unknown as VpnSubscriptionService,
      })
    )

    const response = await app.handle(
      new Request("http://localhost/vpn/packages/pkg_1/purchase", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      })
    )

    expect(response.status).toBe(422)
    expect(purchase).not.toHaveBeenCalled()
  })

  it("rejects a purchase when pricingId is empty", async () => {
    const purchase = mock().mockResolvedValue(subscription)
    const app = new Elysia().use(
      createVpnSubscriptionRoutes({
        authenticate: async () => ({
          organizationId: "org_1",
          user: { id: "user_1" },
        }),
        service: { purchase } as unknown as VpnSubscriptionService,
      })
    )

    const response = await app.handle(
      new Request("http://localhost/vpn/packages/pkg_1/purchase", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pricingId: "" }),
      })
    )

    expect(response.status).toBe(422)
    expect(purchase).not.toHaveBeenCalled()
  })

  describe("GET /vpn/subscriptions/:id/servers/:saId/config", () => {
    it("returns config for an active subscription with provisioning ACTIVE account", async () => {
      // valid encrypted config: {"encrypted":"c7AZT3KoMnKUcZt2xnGQlqjE8w==","iv":"b3EM9sLsx8hJK2Lpm+lzwg==","tag":"VLfxCavUeBS2LiOcCJOLmw=="}
      const activeSub = {
        ...subscription,
        serverAccounts: subscription.serverAccounts.map((sa) => ({
          ...sa,
          configEncrypted:
            '{"encrypted":"c7AZT3KoMnKUcZt2xnGQlqjE8w==","iv":"b3EM9sLsx8hJK2Lpm+lzwg==","tag":"VLfxCavUeBS2LiOcCJOLmw=="}',
        })),
      }
      const service = {
        getForOrganization: mock().mockResolvedValue(activeSub),
      }
      const app = new Elysia().use(
        createVpnSubscriptionRoutes({
          authenticate: async () => ({
            organizationId: "org_1",
            user: { id: "user_1" },
          }),
          service: service as unknown as VpnSubscriptionService,
        })
      )

      const response = await app.handle(
        new Request(
          "http://localhost/vpn/subscriptions/sub_1/servers/sa_1/config"
        )
      )
      expect(response.status).toBe(200)
      expect(response.headers.get("content-disposition")).toContain(".ovpn")
    })

    it("returns 403 when subscription is not ACTIVE", async () => {
      const nonActiveSub = { ...subscription, status: "SUSPENDED" }
      const service = {
        getForOrganization: mock().mockResolvedValue(nonActiveSub),
      }
      const app = new Elysia().use(
        createVpnSubscriptionRoutes({
          authenticate: async () => ({
            organizationId: "org_1",
            user: { id: "user_1" },
          }),
          service: service as unknown as VpnSubscriptionService,
        })
      )

      const response = await app.handle(
        new Request(
          "http://localhost/vpn/subscriptions/sub_1/servers/sa_1/config"
        )
      )
      expect(response.status).toBe(403)
      const body = await response.json()
      expect(body.error).toBe("SUBSCRIPTION_NOT_ACTIVE")
    })

    it("returns 403 when account is REVOKED", async () => {
      const revokedSub = {
        ...subscription,
        status: "ACTIVE",
        serverAccounts: [
          { ...subscription.serverAccounts[0], provisioningStatus: "REVOKED" },
        ],
      }
      const service = {
        getForOrganization: mock().mockResolvedValue(revokedSub),
      }
      const app = new Elysia().use(
        createVpnSubscriptionRoutes({
          authenticate: async () => ({
            organizationId: "org_1",
            user: { id: "user_1" },
          }),
          service: service as unknown as VpnSubscriptionService,
        })
      )

      const response = await app.handle(
        new Request(
          "http://localhost/vpn/subscriptions/sub_1/servers/sa_1/config"
        )
      )
      expect(response.status).toBe(403)
      const body = await response.json()
      expect(body.error).toBe("ACCOUNT_REVOKED")
    })

    it("returns 404 when subscription not found", async () => {
      const service = {
        getForOrganization: mock().mockResolvedValue(null),
      }
      const app = new Elysia().use(
        createVpnSubscriptionRoutes({
          authenticate: async () => ({
            organizationId: "org_1",
            user: { id: "user_1" },
          }),
          service: service as unknown as VpnSubscriptionService,
        })
      )

      const response = await app.handle(
        new Request(
          "http://localhost/vpn/subscriptions/sub_1/servers/sa_1/config"
        )
      )
      expect(response.status).toBe(404)
    })

    it("returns 404 when server account not found", async () => {
      const service = {
        getForOrganization: mock().mockResolvedValue(subscription),
      }
      const app = new Elysia().use(
        createVpnSubscriptionRoutes({
          authenticate: async () => ({
            organizationId: "org_1",
            user: { id: "user_1" },
          }),
          service: service as unknown as VpnSubscriptionService,
        })
      )

      const response = await app.handle(
        new Request(
          "http://localhost/vpn/subscriptions/sub_1/servers/nonexistent/config"
        )
      )
      expect(response.status).toBe(404)
    })
  })
  it("downloads all active OpenVPN and WireGuard configs as a ZIP", async () => {
    const service = {
      getForOrganization: mock().mockResolvedValue({
        ...subscription,
        serverAccounts: [
          {
            ...subscription.serverAccounts[0],
            configEncrypted:
              '{"encrypted":"c7AZT3KoMnKUcZt2xnGQlqjE8w==","iv":"b3EM9sLsx8hJK2Lpm+lzwg==","tag":"VLfxCavUeBS2LiOcCJOLmw=="}',
          },
          {
            ...subscription.serverAccounts[0],
            id: "sa_2",
            protocol: "WIREGUARD",
            configEncrypted:
              '{"encrypted":"c7AZT3KoMnKUcZt2xnGQlqjE8w==","iv":"b3EM9sLsx8hJK2Lpm+lzwg==","tag":"VLfxCavUeBS2LiOcCJOLmw=="}',
            server: {
              ...subscription.serverAccounts[0].server,
              hostname: "us01.vpn.example.com",
            },
          },
        ],
      }),
    }
    const app = new Elysia().use(
      createVpnSubscriptionRoutes({
        authenticate: async () => ({
          organizationId: "org_1",
          user: { id: "user_1" },
        }),
        service: service as unknown as VpnSubscriptionService,
      })
    )

    const response = await app.handle(
      new Request("http://localhost/vpn/subscriptions/sub_1/download-all")
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("application/zip")
    expect(response.headers.get("content-disposition")).toContain("attachment;")
    expect(response.headers.get("content-disposition")).toContain(".zip")
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(0)
  })

  describe("GET /vpn/subscriptions/:id", () => {
    it("returns single subscription detail", async () => {
      const service = {
        getForOrganization: mock().mockResolvedValue(subscription),
      }

      const app = new Elysia().use(
        createVpnSubscriptionRoutes({
          authenticate: async () => ({
            organizationId: "org_1",
            user: { id: "user_1" },
          }),
          service: service as unknown as VpnSubscriptionService,
        })
      )

      const response = await app.handle(
        new Request("http://localhost/vpn/subscriptions/sub_1")
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(body.data.id).toBe("sub_1")
      expect(body.data.packageName).toBe("VPN SG")
    })

    it("returns 404 when subscription not found", async () => {
      const service = {
        getForOrganization: mock().mockResolvedValue(null),
      }

      const app = new Elysia().use(
        createVpnSubscriptionRoutes({
          authenticate: async () => ({
            organizationId: "org_1",
            user: { id: "user_1" },
          }),
          service: service as unknown as VpnSubscriptionService,
        })
      )

      const response = await app.handle(
        new Request("http://localhost/vpn/subscriptions/sub_missing")
      )

      expect(response.status).toBe(404)
    })
  })

  describe("GET /vpn/subscriptions/:id/servers/:saId/credentials", () => {
    it("returns proxy credentials for a proxy account", async () => {
      const proxySub = {
        ...subscription,
        serverAccounts: [
          {
            ...subscription.serverAccounts[0],
            id: "sa_proxy",
            protocol: "PROXY",
            username: "proxy-user",
            password: "encrypted-proxy-password",
          },
        ],
      }
      const service = {
        getForOrganization: mock().mockResolvedValue(proxySub),
      }

      const app = new Elysia().use(
        createVpnSubscriptionRoutes({
          authenticate: async () => ({
            organizationId: "org_1",
            user: { id: "user_1" },
          }),
          service: service as unknown as VpnSubscriptionService,
        })
      )

      const response = await app.handle(
        new Request(
          "http://localhost/vpn/subscriptions/sub_1/servers/sa_proxy/credentials"
        )
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(body.data.username).toBe("proxy-user")
      expect(body.data.password).toBe("decrypted-password")
    })

    it("returns 404 when subscription not found", async () => {
      const service = {
        getForOrganization: mock().mockResolvedValue(null),
      }

      const app = new Elysia().use(
        createVpnSubscriptionRoutes({
          authenticate: async () => ({
            organizationId: "org_1",
            user: { id: "user_1" },
          }),
          service: service as unknown as VpnSubscriptionService,
        })
      )

      const response = await app.handle(
        new Request(
          "http://localhost/vpn/subscriptions/sub_missing/servers/sa_proxy/credentials"
        )
      )

      expect(response.status).toBe(404)
    })

    it("returns 404 when account protocol is not PROXY", async () => {
      const service = {
        getForOrganization: mock().mockResolvedValue(subscription),
      }

      const app = new Elysia().use(
        createVpnSubscriptionRoutes({
          authenticate: async () => ({
            organizationId: "org_1",
            user: { id: "user_1" },
          }),
          service: service as unknown as VpnSubscriptionService,
        })
      )

      const response = await app.handle(
        new Request(
          "http://localhost/vpn/subscriptions/sub_1/servers/sa_1/credentials"
        )
      )

      expect(response.status).toBe(404)
    })
  })

  describe("additional GET config branches", () => {
    it("returns .conf filename for WireGuard protocol", async () => {
      const wgSub = {
        ...subscription,
        serverAccounts: [
          {
            ...subscription.serverAccounts[0],
            id: "sa_wg",
            protocol: "WIREGUARD",
            configEncrypted: "encrypted",
          },
        ],
      }
      const service = {
        getForOrganization: mock().mockResolvedValue(wgSub),
      }

      const app = new Elysia().use(
        createVpnSubscriptionRoutes({
          authenticate: async () => ({
            organizationId: "org_1",
            user: { id: "user_1" },
          }),
          service: service as unknown as VpnSubscriptionService,
        })
      )

      const response = await app.handle(
        new Request(
          "http://localhost/vpn/subscriptions/sub_1/servers/sa_wg/config"
        )
      )

      expect(response.status).toBe(200)
      expect(response.headers.get("content-disposition")).toContain(".conf")
    })

    it("returns 400 for proxy protocol config download", async () => {
      const proxySub = {
        ...subscription,
        serverAccounts: [
          {
            ...subscription.serverAccounts[0],
            id: "sa_proxy",
            protocol: "PROXY",
            configEncrypted: "encrypted",
          },
        ],
      }
      const service = {
        getForOrganization: mock().mockResolvedValue(proxySub),
      }

      const app = new Elysia().use(
        createVpnSubscriptionRoutes({
          authenticate: async () => ({
            organizationId: "org_1",
            user: { id: "user_1" },
          }),
          service: service as unknown as VpnSubscriptionService,
        })
      )

      const response = await app.handle(
        new Request(
          "http://localhost/vpn/subscriptions/sub_1/servers/sa_proxy/config"
        )
      )

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toBe("NO_CONFIG")
    })

    it("returns 404 when account has no configEncrypted", async () => {
      const noConfigSub = {
        ...subscription,
        serverAccounts: [
          {
            ...subscription.serverAccounts[0],
            id: "sa_no_config",
            configEncrypted: null,
          },
        ],
      }
      const service = {
        getForOrganization: mock().mockResolvedValue(noConfigSub),
      }

      const app = new Elysia().use(
        createVpnSubscriptionRoutes({
          authenticate: async () => ({
            organizationId: "org_1",
            user: { id: "user_1" },
          }),
          service: service as unknown as VpnSubscriptionService,
        })
      )

      const response = await app.handle(
        new Request(
          "http://localhost/vpn/subscriptions/sub_1/servers/sa_no_config/config"
        )
      )

      expect(response.status).toBe(404)
    })
  })

  describe("download-all error branches", () => {
    it("returns 404 when subscription not found", async () => {
      const service = {
        getForOrganization: mock().mockResolvedValue(null),
      }

      const app = new Elysia().use(
        createVpnSubscriptionRoutes({
          authenticate: async () => ({
            organizationId: "org_1",
            user: { id: "user_1" },
          }),
          service: service as unknown as VpnSubscriptionService,
        })
      )

      const response = await app.handle(
        new Request(
          "http://localhost/vpn/subscriptions/sub_missing/download-all"
        )
      )

      expect(response.status).toBe(404)
    })

    it("returns 403 when subscription status is not ACTIVE", async () => {
      const service = {
        getForOrganization: mock().mockResolvedValue({
          ...subscription,
          status: "CANCELED",
        }),
      }

      const app = new Elysia().use(
        createVpnSubscriptionRoutes({
          authenticate: async () => ({
            organizationId: "org_1",
            user: { id: "user_1" },
          }),
          service: service as unknown as VpnSubscriptionService,
        })
      )

      const response = await app.handle(
        new Request("http://localhost/vpn/subscriptions/sub_1/download-all")
      )

      expect(response.status).toBe(403)
      const body = await response.json()
      expect(body.error).toBe("SUBSCRIPTION_NOT_ACTIVE")
    })
  })

  describe("GET /vpn/subscriptions/:id/billing", () => {
    it("returns billing info for subscription", async () => {
      const billingInfo = {
        id: "sub_1",
        status: "ACTIVE",
        priceLocked: new Prisma.Decimal("50000"),
        currency: "IDR",
        originalPrice: new Prisma.Decimal("3.50"),
        originalCurrency: "USD",
        exchangeRate: new Prisma.Decimal("14285"),
        currentPeriodStart: new Date("2026-06-01T00:00:00Z"),
        currentPeriodEnd: new Date("2026-07-01T00:00:00Z"),
        cancelAtPeriodEnd: false,
        renewalFailedAt: null,
      }
      const service = {
        getBillingInfo: mock().mockResolvedValue(billingInfo),
      }

      const app = new Elysia().use(
        createVpnSubscriptionRoutes({
          authenticate: async () => ({
            organizationId: "org_1",
            user: { id: "user_1" },
          }),
          service: service as unknown as VpnSubscriptionService,
        })
      )

      const response = await app.handle(
        new Request("http://localhost/vpn/subscriptions/sub_1/billing")
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(body.data.price).toBe("50000")
      expect(body.data.currency).toBe("IDR")
    })

    it("returns 404 when subscription not found", async () => {
      const service = {
        getBillingInfo: mock().mockRejectedValue(
          new VpnSubscriptionNotFoundError()
        ),
      }

      const app = new Elysia().use(
        createVpnSubscriptionRoutes({
          authenticate: async () => ({
            organizationId: "org_1",
            user: { id: "user_1" },
          }),
          service: service as unknown as VpnSubscriptionService,
        })
      )

      const response = await app.handle(
        new Request("http://localhost/vpn/subscriptions/sub_missing/billing")
      )

      expect(response.status).toBe(404)
    })

    it("returns 500 on unexpected billing info error", async () => {
      const service = {
        getBillingInfo: mock().mockRejectedValue(new Error("DB boom")),
      }

      const app = new Elysia().use(
        createVpnSubscriptionRoutes({
          authenticate: async () => ({
            organizationId: "org_1",
            user: { id: "user_1" },
          }),
          service: service as unknown as VpnSubscriptionService,
        })
      )

      const response = await app.handle(
        new Request("http://localhost/vpn/subscriptions/sub_1/billing")
      )

      expect(response.status).toBe(500)
      const body = await response.json()
      expect(body.error).toBe("INTERNAL_ERROR")
    })
  })

  describe("POST /vpn/subscriptions/:id/cancel", () => {
    it("cancels subscription at period end", async () => {
      const service = {
        cancelAtPeriodEnd: mock().mockResolvedValue({
          ...subscription,
          cancelAtPeriodEnd: true,
        }),
      }

      const app = new Elysia().use(
        createVpnSubscriptionRoutes({
          authenticate: async () => ({
            organizationId: "org_1",
            user: { id: "user_1" },
          }),
          service: service as unknown as VpnSubscriptionService,
        })
      )

      const response = await app.handle(
        new Request("http://localhost/vpn/subscriptions/sub_1/cancel", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ reason: "Too expensive" }),
        })
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(service.cancelAtPeriodEnd).toHaveBeenCalledWith(
        "org_1",
        "sub_1",
        "Too expensive"
      )
    })

    it("returns 404 when subscription to cancel is not found", async () => {
      const service = {
        cancelAtPeriodEnd: mock().mockRejectedValue(
          new VpnSubscriptionNotFoundError()
        ),
      }

      const app = new Elysia().use(
        createVpnSubscriptionRoutes({
          authenticate: async () => ({
            organizationId: "org_1",
            user: { id: "user_1" },
          }),
          service: service as unknown as VpnSubscriptionService,
        })
      )

      const response = await app.handle(
        new Request("http://localhost/vpn/subscriptions/sub_missing/cancel", {
          method: "POST",
        })
      )

      expect(response.status).toBe(404)
    })

    it("returns 500 on unexpected cancel error", async () => {
      const service = {
        cancelAtPeriodEnd: mock().mockRejectedValue(new Error("unexpected")),
      }

      const app = new Elysia().use(
        createVpnSubscriptionRoutes({
          authenticate: async () => ({
            organizationId: "org_1",
            user: { id: "user_1" },
          }),
          service: service as unknown as VpnSubscriptionService,
        })
      )

      const response = await app.handle(
        new Request("http://localhost/vpn/subscriptions/sub_1/cancel", {
          method: "POST",
        })
      )

      expect(response.status).toBe(500)
      const body = await response.json()
      expect(body.error).toBe("INTERNAL_ERROR")
    })
  })

  describe("POST /vpn/subscriptions/:id/reinstate", () => {
    it("reinstates canceled subscription", async () => {
      const service = {
        reinstate: mock().mockResolvedValue({
          ...subscription,
          cancelAtPeriodEnd: false,
        }),
      }

      const app = new Elysia().use(
        createVpnSubscriptionRoutes({
          authenticate: async () => ({
            organizationId: "org_1",
            user: { id: "user_1" },
          }),
          service: service as unknown as VpnSubscriptionService,
        })
      )

      const response = await app.handle(
        new Request("http://localhost/vpn/subscriptions/sub_1/reinstate", {
          method: "POST",
        })
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(service.reinstate).toHaveBeenCalledWith(
        "org_1",
        "sub_1",
        undefined
      )
    })

    it("returns 404 when subscription to reinstate is not found", async () => {
      const service = {
        reinstate: mock().mockRejectedValue(new VpnSubscriptionNotFoundError()),
      }

      const app = new Elysia().use(
        createVpnSubscriptionRoutes({
          authenticate: async () => ({
            organizationId: "org_1",
            user: { id: "user_1" },
          }),
          service: service as unknown as VpnSubscriptionService,
        })
      )

      const response = await app.handle(
        new Request(
          "http://localhost/vpn/subscriptions/sub_missing/reinstate",
          {
            method: "POST",
          }
        )
      )

      expect(response.status).toBe(404)
    })

    it("returns 500 on unexpected reinstate error", async () => {
      const service = {
        reinstate: mock().mockRejectedValue(new Error("unexpected")),
      }

      const app = new Elysia().use(
        createVpnSubscriptionRoutes({
          authenticate: async () => ({
            organizationId: "org_1",
            user: { id: "user_1" },
          }),
          service: service as unknown as VpnSubscriptionService,
        })
      )

      const response = await app.handle(
        new Request("http://localhost/vpn/subscriptions/sub_1/reinstate", {
          method: "POST",
        })
      )

      expect(response.status).toBe(500)
      const body = await response.json()
      expect(body.error).toBe("INTERNAL_ERROR")
    })
  })

  describe("purchase error handling", () => {
    it("returns 404 on VpnPackageUnavailableError", async () => {
      const service = {
        purchase: mock().mockRejectedValue(new VpnPackageUnavailableError()),
      }

      const app = new Elysia().use(
        createVpnSubscriptionRoutes({
          authenticate: async () => ({
            organizationId: "org_1",
            user: { id: "user_1" },
          }),
          service: service as unknown as VpnSubscriptionService,
        })
      )

      const response = await app.handle(
        new Request("http://localhost/vpn/packages/pkg_1/purchase", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ pricingId: "p_1" }),
        })
      )

      expect(response.status).toBe(404)
      const body = await response.json()
      expect(body.error).toBe("PACKAGE_UNAVAILABLE")
    })

    it("returns 409 on VpnDuplicateSubscriptionError", async () => {
      const service = {
        purchase: mock().mockRejectedValue(new VpnDuplicateSubscriptionError()),
      }

      const app = new Elysia().use(
        createVpnSubscriptionRoutes({
          authenticate: async () => ({
            organizationId: "org_1",
            user: { id: "user_1" },
          }),
          service: service as unknown as VpnSubscriptionService,
        })
      )

      const response = await app.handle(
        new Request("http://localhost/vpn/packages/pkg_1/purchase", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ pricingId: "p_1" }),
        })
      )

      expect(response.status).toBe(409)
      const body = await response.json()
      expect(body.error).toBe("DUPLICATE_SUBSCRIPTION")
    })

    it("returns 402 on VpnInsufficientBalanceError", async () => {
      const service = {
        purchase: mock().mockRejectedValue(new VpnInsufficientBalanceError()),
      }

      const app = new Elysia().use(
        createVpnSubscriptionRoutes({
          authenticate: async () => ({
            organizationId: "org_1",
            user: { id: "user_1" },
          }),
          service: service as unknown as VpnSubscriptionService,
        })
      )

      const response = await app.handle(
        new Request("http://localhost/vpn/packages/pkg_1/purchase", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ pricingId: "p_1" }),
        })
      )

      expect(response.status).toBe(402)
      const body = await response.json()
      expect(body.error).toBe("INSUFFICIENT_BALANCE")
    })

    it("returns 404 on VpnBillingAccountNotFoundError", async () => {
      const service = {
        purchase: mock().mockRejectedValue(
          new VpnBillingAccountNotFoundError()
        ),
      }

      const app = new Elysia().use(
        createVpnSubscriptionRoutes({
          authenticate: async () => ({
            organizationId: "org_1",
            user: { id: "user_1" },
          }),
          service: service as unknown as VpnSubscriptionService,
        })
      )

      const response = await app.handle(
        new Request("http://localhost/vpn/packages/pkg_1/purchase", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ pricingId: "p_1" }),
        })
      )

      expect(response.status).toBe(404)
      const body = await response.json()
      expect(body.error).toBe("BILLING_ACCOUNT_REQUIRED")
    })

    it("returns 422 on PRICE_NOT_FOUND error", async () => {
      const service = {
        purchase: mock().mockRejectedValue(new Error("PRICE_NOT_FOUND")),
      }

      const app = new Elysia().use(
        createVpnSubscriptionRoutes({
          authenticate: async () => ({
            organizationId: "org_1",
            user: { id: "user_1" },
          }),
          service: service as unknown as VpnSubscriptionService,
        })
      )

      const response = await app.handle(
        new Request("http://localhost/vpn/packages/pkg_1/purchase", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ pricingId: "p_1" }),
        })
      )

      expect(response.status).toBe(422)
      const body = await response.json()
      expect(body.error).toBe("PRICING_UNAVAILABLE")
    })

    it("returns 500 on unexpected purchase error", async () => {
      const service = {
        purchase: mock().mockRejectedValue(new Error("unexpected error")),
      }

      const app = new Elysia().use(
        createVpnSubscriptionRoutes({
          authenticate: async () => ({
            organizationId: "org_1",
            user: { id: "user_1" },
          }),
          service: service as unknown as VpnSubscriptionService,
        })
      )

      const response = await app.handle(
        new Request("http://localhost/vpn/packages/pkg_1/purchase", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ pricingId: "p_1" }),
        })
      )

      expect(response.status).toBe(500)
      const body = await response.json()
      expect(body.error).toBe("INTERNAL_ERROR")
    })
  })

  describe("auth resolution", () => {
    it("returns 401 when user is not present", async () => {
      const app = new Elysia().use(
        createVpnSubscriptionRoutes({
          authenticate: async () => ({
            organizationId: "org_1",
            user: null,
          }),
          service: {} as unknown as VpnSubscriptionService,
        })
      )

      const response = await app.handle(
        new Request("http://localhost/vpn/subscriptions")
      )

      expect(response.status).toBe(401)
    })

    it("returns 403 when organizationId is missing", async () => {
      const app = new Elysia().use(
        createVpnSubscriptionRoutes({
          authenticate: async () => ({
            organizationId: null,
            user: { id: "user_1" },
          }),
          service: {} as unknown as VpnSubscriptionService,
        })
      )

      const response = await app.handle(
        new Request("http://localhost/vpn/subscriptions")
      )

      expect(response.status).toBe(403)
    })
  })
})
