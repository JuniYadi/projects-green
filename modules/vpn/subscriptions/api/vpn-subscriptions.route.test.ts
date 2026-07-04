import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"
import { Prisma } from "@prisma/client"

import type { VpnSubscriptionService } from "../vpn-subscription.service"

const mockPackageFindMany = mock()
const mockBillingAccountFindUnique = mock()
const mockBillingAdjustmentFindMany = mock()

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
  logAuditEvent: mock().mockResolvedValue(undefined),
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
}))

const { createVpnSubscriptionRoutes } = await import(
  "./vpn-subscriptions.route"
)

const subscription = {
  id: "sub_1",
  organizationId: "org_1",
  packageId: "pkg_1",
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
        new Request("http://localhost/vpn/subscriptions/sub_1/servers/sa_1/config")
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
        new Request("http://localhost/vpn/subscriptions/sub_1/servers/sa_1/config")
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
        new Request("http://localhost/vpn/subscriptions/sub_1/servers/sa_1/config")
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
        new Request("http://localhost/vpn/subscriptions/sub_1/servers/sa_1/config")
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
        new Request("http://localhost/vpn/subscriptions/sub_1/servers/nonexistent/config")
      )
      expect(response.status).toBe(404)
    })
  })
})
