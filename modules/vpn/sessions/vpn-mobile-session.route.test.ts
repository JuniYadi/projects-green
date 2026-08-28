import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"

const serverAccountFindUnique = mock()
const deviceFindUnique = mock()
mock.module("@/lib/prisma", () => ({
  prisma: {
    vpnServerAccount: { findUnique: serverAccountFindUnique },
    vpnMobileDevice: { findUnique: deviceFindUnique },
  },
}))
const requireMobileSession = mock()
mock.module("@/modules/vpn/mobile/api/mobile-auth.middleware", () => ({
  requireMobileSession,
}))
const { createMobileSessionRoutes } = await import("./vpn-mobile-session.route")

const auth = {
  ok: true,
  mobileAuth: { deviceId: "dev_1", organizationId: "org_1" },
}
const now = new Date("2026-07-01T00:00:00Z")
const session = {
  id: "s_1",
  deviceId: "dev_1",
  subscriptionId: "sub_1",
  serverAccountId: "sa_1",
  serverId: "srv_1",
  status: "ACTIVE",
  startedAt: now,
  lastPingAt: now,
  endedAt: null,
  txBytes: BigInt(3),
  rxBytes: BigInt(4),
}
const appWith = (service: Record<string, unknown>) =>
  new Elysia().use(createMobileSessionRoutes({ service: service as never }))

describe("mobile session routes", () => {
  beforeEach(() => {
    requireMobileSession.mockReset().mockResolvedValue(auth)
    serverAccountFindUnique
      .mockReset()
      .mockResolvedValue({
        id: "sa_1",
        serverId: "srv_1",
        subscriptionId: "sub_1",
      })
    deviceFindUnique.mockReset().mockResolvedValue({ subscriptionId: "sub_1" })
  })

  it("starts a session after validating account ownership", async () => {
    const create = mock().mockResolvedValue({ ...session, startedAt: now })
    const response = await appWith({ create }).handle(
      new Request("http://localhost/vpn/mobile/sessions", {
        method: "POST",
        body: JSON.stringify({ serverAccountId: "sa_1" }),
        headers: { "content-type": "application/json" },
      })
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      sessionId: "s_1",
      startedAt: now.toISOString(),
    })
    expect(create).toHaveBeenCalledWith({
      deviceId: "dev_1",
      subscriptionId: "sub_1",
      serverAccountId: "sa_1",
      serverId: "srv_1",
    })
  })

  it("rejects missing server account and mismatched subscription", async () => {
    serverAccountFindUnique.mockResolvedValueOnce(null)
    let response = await appWith({}).handle(
      new Request("http://localhost/vpn/mobile/sessions", {
        method: "POST",
        body: JSON.stringify({ serverAccountId: "bad" }),
        headers: { "content-type": "application/json" },
      })
    )
    expect(response.status).toBe(404)
    serverAccountFindUnique.mockResolvedValue({
      id: "sa_1",
      serverId: "srv_1",
      subscriptionId: "other",
    })
    response = await appWith({}).handle(
      new Request("http://localhost/vpn/mobile/sessions", {
        method: "POST",
        body: JSON.stringify({ serverAccountId: "sa_1" }),
        headers: { "content-type": "application/json" },
      })
    )
    expect(response.status).toBe(403)
  })

  it("handles ping ownership and successful heartbeat", async () => {
    const findById = mock().mockResolvedValue(session)
    const ping = mock().mockResolvedValue({
      ...session,
      lastPingAt: new Date("2026-07-01T01:00:00Z"),
    })
    const response = await appWith({ findById, ping }).handle(
      new Request("http://localhost/vpn/mobile/sessions/s_1/ping", {
        method: "POST",
      })
    )
    expect(response.status).toBe(200)
    expect((await response.json()).lastPingAt).toBe("2026-07-01T01:00:00.000Z")
    expect(findById).toHaveBeenCalledWith("s_1", "org_1")
  })

  it("closes a session and forwards traffic", async () => {
    const findById = mock().mockResolvedValue(session)
    const close = mock().mockResolvedValue({
      ...session,
      status: "CLOSED",
      endedAt: now,
      txBytes: BigInt(10),
      rxBytes: BigInt(20),
    })
    const response = await appWith({ findById, close }).handle(
      new Request("http://localhost/vpn/mobile/sessions/s_1", {
        method: "PATCH",
        body: JSON.stringify({ txBytes: 7, rxBytes: 8 }),
        headers: { "content-type": "application/json" },
      })
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      id: "s_1",
      status: "CLOSED",
      txBytes: 10,
      rxBytes: 20,
    })
    expect(close).toHaveBeenCalledWith("s_1", { txBytes: 7, rxBytes: 8 })
  })

  it("lists own device sessions and returns stats only dashboard-wide", async () => {
    const list = mock().mockResolvedValue({
      sessions: [session],
      nextCursor: null,
      total: 1,
    })
    const getStats = mock().mockResolvedValue({
      totalActive: 1,
      byServer: {},
      bySubscription: {},
    })
    const response = await appWith({ list, getStats }).handle(
      new Request("http://localhost/vpn/mobile/sessions?status=ACTIVE&limit=5")
    )
    expect(response.status).toBe(200)
    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "ACTIVE",
        deviceId: "dev_1",
        limit: 5,
        organizationId: "org_1",
      })
    )
    expect(getStats).not.toHaveBeenCalled()
  })

  it("returns unauthorized responses from middleware", async () => {
    requireMobileSession.mockImplementation(
      async (_request: Request, set: { status?: number }) => {
        set.status = 401
        return {
          ok: false,
          error: { code: "UNAUTHORIZED", message: "No token", details: {} },
        }
      }
    )
    const response = await appWith({}).handle(
      new Request("http://localhost/vpn/mobile/sessions/stats")
    )
    expect(response.status).toBe(401)
  })
})
