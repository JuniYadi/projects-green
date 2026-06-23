/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"

mock.module("@/lib/prisma", () => ({ prisma: {} }))
mock.module("@/lib/audit.service", () => ({
  logAuditEvent: mock().mockResolvedValue(undefined),
}))

const { createAdminVpnSubscriptionsRoutes } = await import(
  "@/modules/vpn/subscriptions/api/vpn-admin-subscriptions.route"
)

const adminGuard = mock().mockResolvedValue({ ok: true, userId: "admin_1" })

describe("Admin VPN Subscriptions Routes — revoke endpoint", () => {
  it("calls revokeAccount when revoking a server account", async () => {
    const revokeAccount = mock().mockResolvedValue(undefined)
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
        service: mockService,
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
    const revokeAccount = mock()
    const mockService = {
      listAll: mock(),
      getById: mock().mockResolvedValue(null),
    }

    const app = new Elysia().use(
      createAdminVpnSubscriptionsRoutes({
        revokeAccount,
        service: mockService,
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
    const revokeAccount = mock()
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
        service: mockService,
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
    const revokeAccount = mock().mockRejectedValue(
      new Error("SSH connection refused")
    )
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
        service: mockService,
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
})
