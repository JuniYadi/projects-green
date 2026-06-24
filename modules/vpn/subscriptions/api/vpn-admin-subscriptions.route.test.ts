import { describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"
import type {
  RouteSet,
  AdminActorContext,
  AdminApiError,
} from "@/modules/admin/api/admin.guards"
import type { VpnSubscriptionService } from "@/modules/vpn/subscriptions/vpn-subscription.service"

const mockPrisma = {
  vpnServerAccount: {
    findUnique: mock(),
  },
}

mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }))
mock.module("@/lib/audit.service", () => ({
  logAuditEvent: mock().mockResolvedValue(undefined),
}))
mock.module("@/modules/vpn/vpn-crypto", () => ({
  encryptVpnConfig: mock((value: string) => value),
  decryptVpnConfig: mock((value: string) => value),
  encryptProxyPassword: mock((value: string) => value),
  decryptProxyPassword: mock((value: string) => value),
  resetVpnCrypto: mock(),
}))

const { createAdminVpnSubscriptionsRoutes } =
  await import("@/modules/vpn/subscriptions/api/vpn-admin-subscriptions.route")

const adminGuard = mock<
  (set: RouteSet) => Promise<AdminActorContext | AdminApiError>
>().mockResolvedValue({
  ok: true as const,
  userId: "admin_1",
  platformRole: "super_admin" as const,
})

describe("Admin VPN Subscriptions Routes — revoke endpoint", () => {
  it("calls revokeAccount when revoking a server account", async () => {
    const revokeAccount =
      mock<(saId: string) => Promise<void>>().mockResolvedValue(undefined)
    const mockService = {
      listAll: mock(),
      getById: mock().mockResolvedValue({
        id: "sub_1",
        serverAccounts: [{ id: "sa_1" }],
      }),
    }

    const app = new Elysia().use(
      createAdminVpnSubscriptionsRoutes({
        revokeAccount,
        service: mockService as unknown as VpnSubscriptionService,
        requireSuperAdmin: adminGuard,
      })
    )

    const response = await app.handle(
      new Request(
        "http://localhost/admin/vpn/subscriptions/sub_1/servers/sa_1/revoke",
        { method: "POST" }
      )
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.ok).toBe(true)
    expect(revokeAccount).toHaveBeenCalledWith("sa_1")
  })

  it("returns 404 when subscription not found", async () => {
    const revokeAccount = mock<(saId: string) => Promise<void>>()
    const mockService = {
      listAll: mock(),
      getById: mock().mockResolvedValue(null),
    }

    const app = new Elysia().use(
      createAdminVpnSubscriptionsRoutes({
        revokeAccount,
        service: mockService as unknown as VpnSubscriptionService,
        requireSuperAdmin: adminGuard,
      })
    )

    const response = await app.handle(
      new Request(
        "http://localhost/admin/vpn/subscriptions/sub_1/servers/sa_1/revoke",
        { method: "POST" }
      )
    )

    expect(response.status).toBe(404)
    expect(revokeAccount).not.toHaveBeenCalled()
  })

  it("returns 404 when server account not found in subscription", async () => {
    const revokeAccount = mock<(saId: string) => Promise<void>>()
    const mockService = {
      listAll: mock(),
      getById: mock().mockResolvedValue({
        id: "sub_1",
        serverAccounts: [],
      }),
    }

    const app = new Elysia().use(
      createAdminVpnSubscriptionsRoutes({
        revokeAccount,
        service: mockService as unknown as VpnSubscriptionService,
        requireSuperAdmin: adminGuard,
      })
    )

    const response = await app.handle(
      new Request(
        "http://localhost/admin/vpn/subscriptions/sub_1/servers/sa_1/revoke",
        { method: "POST" }
      )
    )

    expect(response.status).toBe(404)
    expect(revokeAccount).not.toHaveBeenCalled()
  })

  it("errors propagate from revokeAccount to the caller", async () => {
    const revokeAccount = mock<
      (saId: string) => Promise<void>
    >().mockRejectedValue(new Error("SSH connection refused"))
    const mockService = {
      listAll: mock(),
      getById: mock().mockResolvedValue({
        id: "sub_1",
        serverAccounts: [{ id: "sa_1" }],
      }),
    }

    const app = new Elysia().use(
      createAdminVpnSubscriptionsRoutes({
        revokeAccount,
        service: mockService as unknown as VpnSubscriptionService,
        requireSuperAdmin: adminGuard,
      })
    )

    const response = await app.handle(
      new Request(
        "http://localhost/admin/vpn/subscriptions/sub_1/servers/sa_1/revoke",
        { method: "POST" }
      )
    )

    expect(response.status).toBe(500)
  })

  it("returns 401 when admin guard denies access", async () => {
    const failingGuard = mock(
      async (set: RouteSet): Promise<AdminActorContext | AdminApiError> => {
        set.status = 401
        return {
          ok: false as const,
          error: "UNAUTHORIZED",
          message: "Unauthorized",
        }
      }
    )
    const revokeAccount = mock<(saId: string) => Promise<void>>()
    const mockService = {
      listAll: mock(),
      getById: mock().mockResolvedValue({
        id: "sub_1",
        serverAccounts: [{ id: "sa_1" }],
      }),
    }

    const app = new Elysia().use(
      createAdminVpnSubscriptionsRoutes({
        revokeAccount,
        service: mockService as unknown as VpnSubscriptionService,
        requireSuperAdmin: failingGuard,
      })
    )

    const response = await app.handle(
      new Request(
        "http://localhost/admin/vpn/subscriptions/sub_1/servers/sa_1/revoke",
        { method: "POST" }
      )
    )

    expect(response.status).toBe(401)
    expect(revokeAccount).not.toHaveBeenCalled()
  })
})

describe("Admin VPN Subscriptions Routes — config download", () => {
  it("downloads WireGuard config as a .conf file", async () => {
    mockPrisma.vpnServerAccount.findUnique.mockResolvedValueOnce({
      id: "sa_wg",
      subscriptionId: "sub_1",
      protocol: "WIREGUARD",
      username: "org_demo_wg",
      configEncrypted: "[Interface]\nPrivateKey = test",
    })

    const app = new Elysia().use(
      createAdminVpnSubscriptionsRoutes({
        service: {} as VpnSubscriptionService,
        requireSuperAdmin: adminGuard,
      })
    )

    const response = await app.handle(
      new Request(
        "http://localhost/admin/vpn/subscriptions/sub_1/servers/sa_wg/config"
      )
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe(
      "text/plain; charset=utf-8"
    )
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="org_demo_wg.conf"'
    )
    expect(await response.text()).toBe("[Interface]\nPrivateKey = test")
  })
})
