/**
 * Unit tests for mobile profile routes (mobile-profiles.route.ts).
 * Covers:
 *   GET  /vpn/mobile/profiles          — list profiles
 *   GET  /vpn/mobile/profiles/:profileId/config — download config
 *   POST /vpn/mobile/profiles/:profileId/heartbeat — heartbeat
 */

import { describe, expect, it, mock, beforeEach } from "bun:test"
import { Elysia } from "elysia"

// ── Mocks ───────────────────────────────────────────────────────────────
// Must be before any imports from the route modules.

const mockFindUnique = mock()
const mockFindMany = mock()
const mockFindFirst = mock()
const mockCreate = mock()
const mockUpdate = mock()
const mockUpdateMany = mock()
const mockDeleteMany = mock()
const mockCount = mock()

const mockPrisma = {
  vpnMobileDevice: {
    findUnique: mockFindUnique,
    findMany: mockFindMany,
    findFirst: mockFindFirst,
    create: mockCreate,
    update: mockUpdate,
    updateMany: mockUpdateMany,
    deleteMany: mockDeleteMany,
    count: mockCount,
  },
  vpnPairingToken: {
    findUnique: mockFindUnique,
    findMany: mockFindMany,
    findFirst: mockFindFirst,
    create: mockCreate,
    update: mockUpdate,
    updateMany: mockUpdateMany,
    deleteMany: mockDeleteMany,
    count: mockCount,
  },
  vpnSubscription: {
    findUnique: mockFindUnique,
    findMany: mockFindMany,
    findFirst: mockFindFirst,
    create: mockCreate,
    update: mockUpdate,
    updateMany: mockUpdateMany,
    deleteMany: mockDeleteMany,
    count: mockCount,
  },
  vpnServerAccount: {
    findUnique: mockFindUnique,
    findMany: mockFindMany,
    findFirst: mockFindFirst,
    create: mockCreate,
    update: mockUpdate,
    updateMany: mockUpdateMany,
    deleteMany: mockDeleteMany,
    count: mockCount,
  },
  vpnAuditLog: { create: mock() },
}

mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }))

const mockRequireMobileSession = mock()
mock.module("@/modules/vpn/mobile/api/mobile-auth.middleware", () => ({
  requireMobileSession: mockRequireMobileSession,
}))

const mockLogAuditEvent = mock()
mock.module("@/lib/audit.service", () => ({
  logAuditEvent: mockLogAuditEvent,
}))

const mockCreateRateLimiter = mock()
const mockGetClientIp = mock()
const mockBuildRateLimitResponse = mock()
const mockRateLimitHeaders = mock()
mock.module("@/lib/rate-limit", () => ({
  createRateLimiter: mockCreateRateLimiter,
  getClientIp: mockGetClientIp,
  buildRateLimitResponse: mockBuildRateLimitResponse,
  rateLimitHeaders: mockRateLimitHeaders,
}))

const mockDecryptVpnConfig = mock()
mock.module("@/modules/vpn/vpn-crypto", () => ({
  decryptVpnConfig: mockDecryptVpnConfig,
}))

// ── Imports ──────────────────────────────────────────────────────────────

import { createMobileProfilesRoutes } from "./mobile-profiles.route"

// ── Test Data ────────────────────────────────────────────────────────────

const SUBSCRIPTION_ID = "sub-1"
const DEVICE_ID = "dev-1"
const ACCOUNT_ID = "account-1"
const NOW = new Date("2026-06-16T12:00:00Z")

const activeSubscription = {
  id: SUBSCRIPTION_ID,
  organizationId: "org-1",
  packageId: "pkg-1",
  status: "ACTIVE",
  currentPeriodStart: new Date("2026-06-01T00:00:00Z"),
  currentPeriodEnd: new Date("2026-06-30T23:59:59Z"),
  renewalFailedAt: null,
  cancelAtPeriodEnd: false,
  createdAt: new Date("2026-06-01T00:00:00Z"),
  updatedAt: new Date("2026-06-01T00:00:00Z"),
}

const activeDevice = {
  id: DEVICE_ID,
  organizationId: "org-1",
  fingerprint: "fp-abc123",
  status: "ACTIVE" as const,
  subscriptionId: SUBSCRIPTION_ID,
  lastSeenAt: NOW,
  name: "Test Device",
  createdAt: NOW,
  updatedAt: NOW,
}

const serverAccount = {
  id: ACCOUNT_ID,
  subscriptionId: SUBSCRIPTION_ID,
  serverId: "srv-1",
  protocol: "WIREGUARD" as const,
  username: "vpn-test-user",
  configEncrypted: "encrypted:base64data",
  password: null,
  provisioningStatus: "ACTIVE",
  failureReason: null,
  createdAt: NOW,
  updatedAt: NOW,
  server: {
    id: "srv-1",
    name: "Singapore-01",
    hostname: "sg-01.example.com",
    ipAddress: "10.0.0.1",
    region: { name: "Singapore" },
  },
}

// ── Helpers ─────────────────────────────────────────────────────────────

const sessionAuth = {
  ok: true as const,
  mobileAuth: { deviceId: DEVICE_ID, userId: "user-1", subscriptionId: SUBSCRIPTION_ID },
}

// session401: throws with status=401 so onError can restore the 401 response.
// Elysia's response validator intercepts the error-body returned alongside status=401
// and converts it to 422 VALIDATION. Throwing bypasses the validator entirely;
// onError catches the error and returns the body with the correct status.
const session401Body = {
  error: { code: "UNAUTHORIZED", message: "Invalid session.", details: {} },
}
const session401 = {
  ok: false as const,
  error: session401Body.error,
}
Object.defineProperty(session401, "status", { value: 401, enumerable: false })
Object.defineProperty(session401, "body", { value: session401Body, enumerable: false })

function createProfilesApp() {
  return new Elysia()
    .onError(({ set, error }) => {
      const e = error as { status?: number; body?: unknown }
      if (e.status && e.body !== undefined) {
        set.status = e.status
        return e.body
      }
    })
    .use(createMobileProfilesRoutes())
}

const setupPrismaDefaults = () => {
  mockFindUnique.mockReset()
  mockFindMany.mockReset()
  mockFindFirst.mockReset()
  mockCreate.mockReset()
  mockUpdate.mockReset()
  mockUpdateMany.mockReset()
  mockDeleteMany.mockReset()
  mockCount.mockReset()

  mockFindUnique.mockResolvedValue(null)
  mockFindMany.mockResolvedValue([])
  mockFindFirst.mockResolvedValue(null)
  mockCount.mockResolvedValue(0)
}

beforeEach(() => {
  setupPrismaDefaults()
  mockRequireMobileSession.mockReset()
  mockDecryptVpnConfig.mockReset()
  mockDecryptVpnConfig.mockReturnValue("decrypted-wireguard-config")
  mockLogAuditEvent.mockReset()
  mockLogAuditEvent.mockResolvedValue(undefined)
  mockCreateRateLimiter.mockReset()
  mockCreateRateLimiter.mockImplementation(
    () => () => ({ allowed: true, remaining: 59, resetAt: Date.now() + 60_000 })
  )
  mockGetClientIp.mockReset()
  mockGetClientIp.mockReturnValue("127.0.0.1")
  mockBuildRateLimitResponse.mockReset()
  mockBuildRateLimitResponse.mockReturnValue({
    error: { code: "RATE_LIMITED", message: "Too many requests.", details: {} },
  })
  mockRateLimitHeaders.mockReset()
  mockRateLimitHeaders.mockReturnValue({ "x-ratelimit-remaining": "0" })
})

// ── Tests ───────────────────────────────────────────────────────────────

describe("MobileProfilesRoute — GET /vpn/mobile/profiles", () => {
  it("returns 401 when no session", async () => {
    mockRequireMobileSession.mockImplementation(async () => {
      throw session401
    })

    const app = createProfilesApp()
    const res = await app.handle(new Request("http://localhost/vpn/mobile/profiles"))

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe("UNAUTHORIZED")
  })

  it("returns 403 DEVICE_REVOKED when device status is REVOKED", async () => {
    mockRequireMobileSession.mockImplementation(async () => sessionAuth)
    // checkDeviceAccess: device lookup (REVOKED) → returns null, sets 403
    mockFindUnique.mockResolvedValueOnce({
      id: DEVICE_ID,
      status: "REVOKED",
      subscriptionId: SUBSCRIPTION_ID,
    })
    // Handler re-fetches device to check status (lines 91-94)
    mockFindUnique.mockResolvedValueOnce({
      id: DEVICE_ID,
      status: "REVOKED",
      subscriptionId: SUBSCRIPTION_ID,
    })

    const app = createProfilesApp()
    const res = await app.handle(new Request("http://localhost/vpn/mobile/profiles"))

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe("DEVICE_REVOKED")
  })

  it("returns 403 SUBSCRIPTION_EXPIRED when subscription is CANCELLED", async () => {
    mockRequireMobileSession.mockImplementation(async () => sessionAuth)
    mockFindUnique.mockResolvedValueOnce({
      id: DEVICE_ID,
      status: "ACTIVE",
      subscriptionId: SUBSCRIPTION_ID,
    })
    mockFindUnique.mockResolvedValueOnce({
      id: SUBSCRIPTION_ID,
      status: "CANCELLED",
    })

    const app = createProfilesApp()
    const res = await app.handle(new Request("http://localhost/vpn/mobile/profiles"))

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe("SUBSCRIPTION_EXPIRED")
  })

  it("returns empty profiles when no accounts exist", async () => {
    mockRequireMobileSession.mockImplementation(async () => sessionAuth)
    mockFindUnique.mockResolvedValueOnce({
      id: DEVICE_ID,
      status: "ACTIVE",
      subscriptionId: SUBSCRIPTION_ID,
    })
    mockFindUnique.mockResolvedValueOnce({ id: SUBSCRIPTION_ID, status: "ACTIVE" })
    mockFindMany.mockResolvedValueOnce([])

    const app = createProfilesApp()
    const res = await app.handle(new Request("http://localhost/vpn/mobile/profiles"))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.profiles).toEqual([])
  })

  it("returns profiles with server details", async () => {
    mockRequireMobileSession.mockImplementation(async () => sessionAuth)
    mockFindUnique.mockResolvedValueOnce({
      id: DEVICE_ID,
      status: "ACTIVE",
      subscriptionId: SUBSCRIPTION_ID,
    })
    mockFindUnique.mockResolvedValueOnce({ id: SUBSCRIPTION_ID, status: "ACTIVE" })
    mockFindMany.mockResolvedValueOnce([serverAccount])

    const app = createProfilesApp()
    const res = await app.handle(new Request("http://localhost/vpn/mobile/profiles"))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.profiles).toHaveLength(1)
    expect(body.profiles[0]).toMatchObject({
      id: ACCOUNT_ID,
      serverId: "srv-1",
      serverName: "Singapore-01",
      hostname: "sg-01.example.com",
      serverIp: "10.0.0.1",
      protocol: "WIREGUARD",
      region: "Singapore",
      provisioningStatus: "ACTIVE",
    })
  })

  it("returns profiles for SUSPENDED subscription", async () => {
    mockRequireMobileSession.mockImplementation(async () => sessionAuth)
    mockFindUnique.mockResolvedValueOnce({
      id: DEVICE_ID,
      status: "ACTIVE",
      subscriptionId: SUBSCRIPTION_ID,
    })
    mockFindUnique.mockResolvedValueOnce({
      id: SUBSCRIPTION_ID,
      status: "SUSPENDED",
    })
    mockFindMany.mockResolvedValueOnce([serverAccount])

    const app = createProfilesApp()
    const res = await app.handle(new Request("http://localhost/vpn/mobile/profiles"))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.profiles).toHaveLength(1)
  })
})

describe("MobileProfilesRoute — GET /vpn/mobile/profiles/:profileId/config", () => {
  it("returns 401 when no session", async () => {
    mockRequireMobileSession.mockImplementation(async () => {
      throw session401
    })

    const app = createProfilesApp()
    const res = await app.handle(
      new Request(`http://localhost/vpn/mobile/profiles/${ACCOUNT_ID}/config`)
    )

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe("UNAUTHORIZED")
  })

  it("returns 403 DEVICE_REVOKED when device is REVOKED", async () => {
    mockRequireMobileSession.mockImplementation(async () => sessionAuth)
    mockFindUnique.mockResolvedValueOnce({
      id: DEVICE_ID,
      status: "REVOKED",
      subscriptionId: SUBSCRIPTION_ID,
    })
    mockFindUnique.mockResolvedValueOnce(null) // subscription lookup

    const app = createProfilesApp()
    const res = await app.handle(
      new Request(`http://localhost/vpn/mobile/profiles/${ACCOUNT_ID}/config`)
    )

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe("DEVICE_REVOKED")
  })

  it("returns 404 when profile not found", async () => {
    mockRequireMobileSession.mockImplementation(async () => sessionAuth)
    mockFindUnique.mockResolvedValueOnce({
      id: DEVICE_ID,
      status: "ACTIVE",
      subscriptionId: SUBSCRIPTION_ID,
    })
    mockFindUnique.mockResolvedValueOnce({ id: SUBSCRIPTION_ID, status: "ACTIVE" })
    mockFindUnique.mockResolvedValueOnce(null) // account not found

    const app = createProfilesApp()
    const res = await app.handle(
      new Request(`http://localhost/vpn/mobile/profiles/${ACCOUNT_ID}/config`)
    )

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe("NOT_FOUND")
  })

  it("returns 404 when profile belongs to different subscription", async () => {
    mockRequireMobileSession.mockImplementation(async () => sessionAuth)
    mockFindUnique.mockResolvedValueOnce({
      id: DEVICE_ID,
      status: "ACTIVE",
      subscriptionId: SUBSCRIPTION_ID,
    })
    mockFindUnique.mockResolvedValueOnce({ id: SUBSCRIPTION_ID, status: "ACTIVE" })
    mockFindUnique.mockResolvedValueOnce({
      id: ACCOUNT_ID,
      subscriptionId: "other-sub",
      configEncrypted: "data",
      protocol: "WIREGUARD",
    })

    const app = createProfilesApp()
    const res = await app.handle(
      new Request(`http://localhost/vpn/mobile/profiles/${ACCOUNT_ID}/config`)
    )

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe("NOT_FOUND")
  })

  it("returns 500 when configEncrypted is null", async () => {
    mockRequireMobileSession.mockImplementation(async () => sessionAuth)
    mockFindUnique.mockResolvedValueOnce({
      id: DEVICE_ID,
      status: "ACTIVE",
      subscriptionId: SUBSCRIPTION_ID,
    })
    mockFindUnique.mockResolvedValueOnce({ id: SUBSCRIPTION_ID, status: "ACTIVE" })
    mockFindUnique.mockResolvedValueOnce({
      id: ACCOUNT_ID,
      subscriptionId: SUBSCRIPTION_ID,
      configEncrypted: null,
      protocol: "WIREGUARD",
    })

    const app = createProfilesApp()
    const res = await app.handle(
      new Request(`http://localhost/vpn/mobile/profiles/${ACCOUNT_ID}/config`)
    )

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe("CONFIG_DECRYPT_FAILED")
  })

  it("returns 500 when decrypt throws", async () => {
    mockRequireMobileSession.mockImplementation(async () => sessionAuth)
    mockFindUnique.mockResolvedValueOnce({
      id: DEVICE_ID,
      status: "ACTIVE",
      subscriptionId: SUBSCRIPTION_ID,
    })
    mockFindUnique.mockResolvedValueOnce({ id: SUBSCRIPTION_ID, status: "ACTIVE" })
    mockFindUnique.mockResolvedValueOnce({
      id: ACCOUNT_ID,
      subscriptionId: SUBSCRIPTION_ID,
      configEncrypted: "encrypted:data",
      protocol: "WIREGUARD",
    })
    mockDecryptVpnConfig.mockImplementation(() => {
      throw new Error("bad key")
    })

    const app = createProfilesApp()
    const res = await app.handle(
      new Request(`http://localhost/vpn/mobile/profiles/${ACCOUNT_ID}/config`)
    )

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe("CONFIG_DECRYPT_FAILED")
  })

  it("returns config with wireguard format", async () => {
    mockRequireMobileSession.mockImplementation(async () => sessionAuth)
    mockFindUnique.mockResolvedValueOnce({
      id: DEVICE_ID,
      status: "ACTIVE",
      subscriptionId: SUBSCRIPTION_ID,
    })
    mockFindUnique.mockResolvedValueOnce({ id: SUBSCRIPTION_ID, status: "ACTIVE" })
    mockFindUnique.mockResolvedValueOnce({
      id: ACCOUNT_ID,
      subscriptionId: SUBSCRIPTION_ID,
      configEncrypted: "encrypted:data",
      protocol: "WIREGUARD",
    })
    mockDecryptVpnConfig.mockReturnValue("decrypted-wireguard-config")

    const app = createProfilesApp()
    const res = await app.handle(
      new Request(`http://localhost/vpn/mobile/profiles/${ACCOUNT_ID}/config`)
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.config).toBe("decrypted-wireguard-config")
    expect(body.format).toBe("wireguard")
    expect(body.profileId).toBe(ACCOUNT_ID)
  })

  it("returns config with openvpn format", async () => {
    mockRequireMobileSession.mockImplementation(async () => sessionAuth)
    mockFindUnique.mockResolvedValueOnce({
      id: DEVICE_ID,
      status: "ACTIVE",
      subscriptionId: SUBSCRIPTION_ID,
    })
    mockFindUnique.mockResolvedValueOnce({ id: SUBSCRIPTION_ID, status: "ACTIVE" })
    mockFindUnique.mockResolvedValueOnce({
      id: ACCOUNT_ID,
      subscriptionId: SUBSCRIPTION_ID,
      configEncrypted: "encrypted:data",
      protocol: "OPENVPN",
    })
    mockDecryptVpnConfig.mockReturnValue("decrypted-openvpn-config")

    const app = createProfilesApp()
    const res = await app.handle(
      new Request(`http://localhost/vpn/mobile/profiles/${ACCOUNT_ID}/config`)
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.format).toBe("openvpn")
  })

  it("returns config with proxy format for unknown protocol", async () => {
    mockRequireMobileSession.mockImplementation(async () => sessionAuth)
    mockFindUnique.mockResolvedValueOnce({
      id: DEVICE_ID,
      status: "ACTIVE",
      subscriptionId: SUBSCRIPTION_ID,
    })
    mockFindUnique.mockResolvedValueOnce({ id: SUBSCRIPTION_ID, status: "ACTIVE" })
    mockFindUnique.mockResolvedValueOnce({
      id: ACCOUNT_ID,
      subscriptionId: SUBSCRIPTION_ID,
      configEncrypted: "encrypted:data",
      protocol: "SSH",
    })
    mockDecryptVpnConfig.mockReturnValue("decrypted-proxy-config")

    const app = createProfilesApp()
    const res = await app.handle(
      new Request(`http://localhost/vpn/mobile/profiles/${ACCOUNT_ID}/config`)
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.format).toBe("proxy")
  })

  it("logs audit event on successful config download", async () => {
    mockRequireMobileSession.mockImplementation(async () => sessionAuth)
    mockFindUnique.mockResolvedValueOnce({
      id: DEVICE_ID,
      status: "ACTIVE",
      subscriptionId: SUBSCRIPTION_ID,
    })
    mockFindUnique.mockResolvedValueOnce({ id: SUBSCRIPTION_ID, status: "ACTIVE" })
    mockFindUnique.mockResolvedValueOnce({
      id: ACCOUNT_ID,
      subscriptionId: SUBSCRIPTION_ID,
      configEncrypted: "encrypted:data",
      protocol: "WIREGUARD",
    })
    mockDecryptVpnConfig.mockReturnValue("decrypted-config")
    mockLogAuditEvent.mockResolvedValue(undefined)

    const app = createProfilesApp()
    await app.handle(
      new Request(`http://localhost/vpn/mobile/profiles/${ACCOUNT_ID}/config`)
    )

    expect(mockLogAuditEvent).toHaveBeenCalled()
    const auditCall = mockLogAuditEvent.mock.calls[0][0]
    expect(auditCall.action).toBe("CONFIG_DOWNLOADED")
    expect(auditCall.status).toBe("OK")
    expect(auditCall.deviceId).toBe(DEVICE_ID)
    expect(auditCall.serverAccountId).toBe(ACCOUNT_ID)
  })
})

describe("MobileProfilesRoute — POST /vpn/mobile/profiles/:profileId/heartbeat", () => {
  it("returns 401 when no session", async () => {
    mockRequireMobileSession.mockImplementation(async () => {
      throw session401
    })

    const app = createProfilesApp()
    const res = await app.handle(
      new Request(
        `http://localhost/vpn/mobile/profiles/${ACCOUNT_ID}/heartbeat`,
        { method: "POST" }
      )
    )

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe("UNAUTHORIZED")
  })

  it("returns { ok: true } on success", async () => {
    mockRequireMobileSession.mockImplementation(async () => sessionAuth)
    mockUpdate.mockResolvedValue({ ...activeDevice, lastSeenAt: new Date() })

    const app = createProfilesApp()
    const res = await app.handle(
      new Request(
        `http://localhost/vpn/mobile/profiles/${ACCOUNT_ID}/heartbeat`,
        { method: "POST" }
      )
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ ok: true })
  })

  it("calls prisma update with correct device id and lastSeenAt", async () => {
    mockRequireMobileSession.mockImplementation(async () => sessionAuth)
    mockUpdate.mockResolvedValue({ ...activeDevice, lastSeenAt: new Date() })

    const app = createProfilesApp()
    await app.handle(
      new Request(
        `http://localhost/vpn/mobile/profiles/${ACCOUNT_ID}/heartbeat`,
        { method: "POST" }
      )
    )

    expect(mockUpdate).toHaveBeenCalled()
    const updateCall = mockUpdate.mock.calls[0][0]
    expect(updateCall.where.id).toBe(DEVICE_ID)
    expect(updateCall.data.lastSeenAt).toBeInstanceOf(Date)
  })
})
