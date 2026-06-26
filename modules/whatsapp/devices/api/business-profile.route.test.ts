import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"

mock.module("@/lib/prisma", () => ({
  prisma: {
    whatsappDevice: {
      findUnique: mock(async () => null),
      update: mock(async () => null),
    },
  },
}))

mock.module("@/lib/queue/whatsapp-template-sync", () => ({
  enqueueWhatsAppTemplateSync: mock(async () => {}),
}))

mock.module("@workos-inc/authkit-nextjs", () => ({
  withAuth: mock(async () => ({
    user: { id: "user_1", email: "admin@example.com" },
    organizationId: "org_1",
    role: "admin",
    roles: ["admin"],
  })),
}))

mock.module("@/lib/platform-role", () => ({
  getPlatformRoleForUser: mock(async () => "none"),
}))

mock.module("@workos-inc/node", () => ({
  __esModule: true,
  default: {},
  WorkOS: mock(() => ({})),
}))

mock.module("@/lib/auth/resolve-proxy-auth", () => ({
  resolveAuthContext: mock(async () => ({
    type: "workos",
    userId: "user_1",
    email: "admin@example.com",
    organizationId: "org_1",
    orgRole: "admin",
    platformRole: "none",
  })),
}))

// Mock the device client so we don't hit Meta
mock.module("@/lib/whatsapp/meta-cloud/device-client", () => ({
  WhatsAppDeviceClient: class {
    static fromDevice = mock(async () => {
      const mocks = {
        getBusinessProfile: mock(async () => profileMockData),
        updateBusinessProfile: mock(async () => ({ success: true })),
      }
      return mocks
    })
  },
  __esModule: true,
}))

mock.module("@/lib/whatsapp/crypto", () => ({
  decryptWhatsAppToken: mock(async (token: string) => token),
}))

// Must import after mocks
const { devicesRoutes } = await import("@/modules/whatsapp/devices/api/devices.route")
const { businessProfileRoutes } = await import("@/modules/whatsapp/devices/api/business-profile.route")

let profileMockData: Record<string, unknown> | null = {
  about: "We provide DevOps services",
  email: "support@example.com",
  vertical: "PROF_SERVICES",
  websites: ["https://example.com"],
}

function createTestApp() {
  return new Elysia().use(devicesRoutes).use(businessProfileRoutes)
}

function createMockDevice(overrides: Record<string, unknown> = {}) {
  return {
    id: "dev_1",
    organizationId: "org_1",
    phoneNumber: "+62811111111",
    balance: 0,
    quotaBase: 1000,
    quotaBaseIn: 0,
    quotaBaseOut: 0,
    dailyLimitMessage: 500,
    status: "ACTIVE",
    token: null,
    tokenEncrypted: "test-encrypted-token",
    tokenIv: null,
    whatsappBusinessAccountId: "waba-1",
    whatsappPhoneId: "phone-1",
    whatsappApplicationId: null,
    whatsappProfile: null,
    features: null,
    callbackUrl: null,
    expiredAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  }
}

const { prisma } = await import("@/lib/prisma")

describe("business profile routes", () => {
  beforeEach(() => {
    profileMockData = {
      about: "We provide DevOps services",
      email: "support@example.com",
      vertical: "PROF_SERVICES",
      websites: ["https://example.com"],
    }
    // Set up device to exist by default
    ;(prisma.whatsappDevice.findUnique as ReturnType<typeof mock>).mockImplementation(
      async () => createMockDevice()
    )
    ;(prisma.whatsappDevice.update as ReturnType<typeof mock>).mockImplementation(
      async () => createMockDevice({ whatsappProfile: profileMockData })
    )
  })

  afterEach(() => {
    ;(prisma.whatsappDevice.findUnique as ReturnType<typeof mock>).mockClear()
    ;(prisma.whatsappDevice.update as ReturnType<typeof mock>).mockClear()
  })

  it("GET /api/whatsapp/devices/dev_1/profile returns profile", async () => {
    const app = createTestApp()
    const res = await app.handle(
      new Request("http://localhost/api/whatsapp/devices/dev_1/profile")
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.profile).toBeTruthy()
    expect(body.profile!.about).toBe("We provide DevOps services")
  })

  it("GET returns 404 when device not found", async () => {
    ;(prisma.whatsappDevice.findUnique as ReturnType<typeof mock>).mockImplementation(
      async () => null
    )

    const app = createTestApp()
    const res = await app.handle(
      new Request("http://localhost/api/whatsapp/devices/nonexistent/profile")
    )
    expect(res.status).toBe(404)
  })

  it("PATCH /api/whatsapp/devices/dev_1/profile updates profile", async () => {
    const app = createTestApp()
    const res = await app.handle(
      new Request("http://localhost/api/whatsapp/devices/dev_1/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ about: "New about text" }),
      })
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })

  it("PATCH returns 422 for invalid vertical", async () => {
    const app = createTestApp()
    const res = await app.handle(
      new Request("http://localhost/api/whatsapp/devices/dev_1/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vertical: "INVALID" }),
      })
    )
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error).toBe("VALIDATION_ERROR")
  })

  it("PATCH returns 422 for invalid email", async () => {
    const app = createTestApp()
    const res = await app.handle(
      new Request("http://localhost/api/whatsapp/devices/dev_1/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "not-an-email" }),
      })
    )
    expect(res.status).toBe(422)
  })

  it("PATCH returns 404 when device not found", async () => {
    ;(prisma.whatsappDevice.findUnique as ReturnType<typeof mock>).mockImplementation(
      async () => null
    )

    const app = createTestApp()
    const res = await app.handle(
      new Request("http://localhost/api/whatsapp/devices/nonexistent/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ about: "Test" }),
      })
    )
    expect(res.status).toBe(404)
  })
})
