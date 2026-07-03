/**
 * Unit tests for mobile auth routes (mobile-auth.route.ts).
 *
 * Covers the three POST endpoints:
 * - /vpn/mobile/auth/login — subscription-based auth
 * - /vpn/mobile/auth/refresh — deprecated, always 410
 * - /vpn/mobile/auth/exchange — additional edge cases
 *
 * Uses mocked leaf dependencies (@/lib/prisma) and DI for
 * rate-limit bypass (header-based).
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

mock.module("@workos-inc/authkit-nextjs", () => ({
  withAuth: mock(async () => ({
    user: { id: "user-1" },
    organizationId: "org-1",
    role: "owner",
    roles: ["owner"],
  })),
}))

// ── Imports ──────────────────────────────────────────────────────────────

import { createMobileAuthRoutes } from "./mobile-auth.route"
import type { VpnMobileDeviceService } from "../vpn-mobile-device.service"

// ── Test Data ────────────────────────────────────────────────────────────

const SUBSCRIPTION_ID = "sub-1"
const DEVICE_ID = "dev-1"
const FINGERPRINT = "fp-abc123"
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

const inactiveSubscription = {
  ...activeSubscription,
  id: "sub-inactive",
  status: "CANCELLED",
}

const serverProfile = {
  id: "profile-1",
  subscriptionId: SUBSCRIPTION_ID,
  serverId: "srv-1",
  protocol: "WIREGUARD",
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

// ── Helpers ──────────────────────────────────────────────────────────────

const mockSignJwt = mock(() => "mock-session-token")

const fakeDeviceServiceMocks = {
  create: mock(async () => ({ id: DEVICE_ID, status: "ACTIVE" })),
  replace: mock(async () => null),
  revoke: mock(async () => null),
  updateLastSeen: mock(async () => null),
  updateName: mock(async () => null),
  findById: mock(async () => null),
  findBySubscription: mock(async () => []),
}

const fakeDeviceService = fakeDeviceServiceMocks as unknown as VpnMobileDeviceService

const authenticate = mock(async () => ({
  user: { id: "user-1" },
  organizationId: "org-1",
  role: "owner",
  roles: ["owner"],
}))

const exchangeCode = mock(async (code: string) => {
  if (code === "invalid_code" || code === "expired_code") {
    throw Object.assign(new Error("Invalid authorization code"), {
      name: "AuthenticationException",
      statusCode: 401,
    })
  }
  return { user: { id: "user-1" }, organizationId: "org-1" }
})

function createAuthApp(deps: Partial<Parameters<typeof createMobileAuthRoutes>[0]> = {}) {
  return new Elysia().use(
    createMobileAuthRoutes({
      authenticate,
      exchangeCode,
      deviceService: fakeDeviceService,
      now: () => NOW,
      signJwt: mockSignJwt,
      ...deps,
    })
  )
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
  mockCreate.mockImplementation(
    async (args: { data: Record<string, unknown> }) => ({
      id: "new-id",
      ...args.data,
      createdAt: NOW,
      updatedAt: NOW,
    })
  )
  mockCount.mockResolvedValue(0)
}

// ── Tests ───────────────────────────────────────────────────────────────

describe("MobileAuthRoute — /vpn/mobile/auth/login", () => {
  beforeEach(() => {
    setupPrismaDefaults()
    mockSignJwt.mockClear()
    authenticate.mockClear()
    exchangeCode.mockClear()
    fakeDeviceServiceMocks.create.mockClear()
  })

  it("returns 200 with token and profiles on valid subscription", async () => {
    mockFindUnique.mockResolvedValue(activeSubscription)
    mockFindMany.mockResolvedValue([serverProfile])

    const app = createAuthApp()
    const res = await app.handle(
      new Request("http://localhost/vpn/mobile/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscriptionId: SUBSCRIPTION_ID,
          deviceName: "Test iPhone",
          deviceFingerprint: FINGERPRINT,
          platform: "ios",
        }),
      })
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty("token", "mock-session-token")
    expect(body).toHaveProperty("expiresAt")
    expect(body.subscription.id).toBe(SUBSCRIPTION_ID)
    expect(body.profiles).toHaveLength(1)
    expect(body.profiles[0]).toMatchObject({
      id: "profile-1",
      serverName: "Singapore-01",
    })

    expect(fakeDeviceServiceMocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        subscriptionId: SUBSCRIPTION_ID,
        pairedVia: "QR",
      })
    )
  })

  it("returns 404 when subscription not found", async () => {
    mockFindUnique.mockResolvedValue(null)

    const app = createAuthApp()
    const res = await app.handle(
      new Request("http://localhost/vpn/mobile/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscriptionId: "nonexistent",
          deviceName: "Test",
          deviceFingerprint: "fp",
          platform: "android",
        }),
      })
    )

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe("NOT_FOUND")
    expect(fakeDeviceServiceMocks.create).not.toHaveBeenCalled()
  })

  it("returns 400 when subscription is not active", async () => {
    mockFindUnique.mockResolvedValue(inactiveSubscription)

    const app = createAuthApp()
    const res = await app.handle(
      new Request("http://localhost/vpn/mobile/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscriptionId: "sub-inactive",
          deviceName: "Test",
          deviceFingerprint: "fp",
          platform: "android",
        }),
      })
    )

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe("SUBSCRIPTION_NOT_ACTIVE")
    expect(fakeDeviceServiceMocks.create).not.toHaveBeenCalled()
  })

  it("returns 403 when device limit reached", async () => {
    mockFindUnique.mockResolvedValue(activeSubscription)
    fakeDeviceServiceMocks.create.mockRejectedValueOnce(
      Object.assign(new Error("Device limit"), {
        name: "VpnMobileDeviceLimitError",
      })
    )

    const app = createAuthApp()
    const res = await app.handle(
      new Request("http://localhost/vpn/mobile/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscriptionId: SUBSCRIPTION_ID,
          deviceName: "Over Limit",
          deviceFingerprint: "fp-over",
          platform: "android",
        }),
      })
    )

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe("DEVICE_LIMIT_REACHED")
  })

  it("returns 500 when device registration throws unexpected error", async () => {
    mockFindUnique.mockResolvedValue(activeSubscription)
    fakeDeviceServiceMocks.create.mockRejectedValueOnce(new Error("DB timeout"))

    const app = createAuthApp()
    const res = await app.handle(
      new Request("http://localhost/vpn/mobile/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscriptionId: SUBSCRIPTION_ID,
          deviceName: "Failing",
          deviceFingerprint: "fp-fail",
          platform: "ios",
        }),
      })
    )

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe("INTERNAL_ERROR")
  })
})

describe("MobileAuthRoute — /vpn/mobile/auth/refresh (deprecated)", () => {
  beforeEach(() => {
    setupPrismaDefaults()
  })

  it("returns 410 Gone for deprecated refresh endpoint", async () => {
    const app = createAuthApp()
    const res = await app.handle(
      new Request("http://localhost/vpn/mobile/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: "old-token" }),
      })
    )

    expect(res.status).toBe(410)
    const body = await res.json()
    expect(body.error.code).toBe("GONE")
    expect(body.error.message).toContain("deprecated")
  })
})

describe("MobileAuthRoute — /vpn/mobile/auth/exchange edge cases", () => {
  beforeEach(() => {
    setupPrismaDefaults()
    mockSignJwt.mockClear()
    authenticate.mockClear()
    exchangeCode.mockClear()
    fakeDeviceServiceMocks.create.mockClear()
  })

  it("returns 403 when user has no active subscription", async () => {
    mockFindFirst.mockResolvedValue(null)

    const app = createAuthApp()
    const res = await app.handle(
      new Request("http://localhost/vpn/mobile/auth/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceName: "No Sub",
          deviceFingerprint: "fp-nosub",
          platform: "android",
        }),
      })
    )

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe("SUBSCRIPTION_REQUIRED")
    expect(fakeDeviceServiceMocks.create).not.toHaveBeenCalled()
  })

  it("returns 403 when user has no organizationId", async () => {
    const noOrgAuthenticate = mock(async () => ({
      user: { id: "user-1" },
      organizationId: null,
    }))

    const app = createAuthApp({ authenticate: noOrgAuthenticate })
    const res = await app.handle(
      new Request("http://localhost/vpn/mobile/auth/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceName: "No Org",
          deviceFingerprint: "fp-norg",
          platform: "android",
        }),
      })
    )

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe("FORBIDDEN")
    expect(body.error.message).toContain("No active organization")
  })

  it("returns 500 on unexpected WorkOS error during code exchange", async () => {
    const failingExchange = mock(async () => {
      throw new Error("Network timeout")
    })

    mockFindFirst.mockResolvedValue(activeSubscription)
    const app = createAuthApp({ exchangeCode: failingExchange })
    const res = await app.handle(
      new Request("http://localhost/vpn/mobile/auth/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorizationCode: "code_long_enough",
          deviceName: "Fail Device",
          deviceFingerprint: "fp-failcode",
          platform: "android",
        }),
      })
    )

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe("AUTH_PROVIDER_ERROR")
  })
})
