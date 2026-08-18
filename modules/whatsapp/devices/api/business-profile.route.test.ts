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
  createWorkOS: mock(() => ({})),
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

const mockFromDevice = mock(async () => ({
  getBusinessProfile: mock(async () => profileMockData),
  updateBusinessProfile: mock(async () => ({ success: true })),
  uploadProfilePicture: mock(async () => ({ handle: "profile-handle-1" })),
}))

// Mock the device client so we don't hit Meta
mock.module("@/lib/whatsapp/meta-cloud/device-client", () => ({
  WhatsAppDeviceClient: class {
    static fromDevice = mockFromDevice
  },
  __esModule: true,
}))

mock.module("@/lib/whatsapp/crypto", () => ({
  decryptWhatsAppToken: mock(async (token: string) => token),
  encryptWhatsAppToken: mock(async (token: string) => token),
}))

// Must import after mocks
const { devicesRoutes } =
  await import("@/modules/whatsapp/devices/api/devices.route")
const { businessProfileRoutes } =
  await import("@/modules/whatsapp/devices/api/business-profile.route")

let profileMockData: Record<string, unknown> | null = {
  about: "We provide DevOps services",
  email: "support@example.com",
  vertical: "PROF_SERVICES",
  websites: ["https://example.com"],
}

function createTestApp() {
  return new Elysia().group("/api/whatsapp", (app) => {
    return app.use(devicesRoutes).use(businessProfileRoutes)
  })
}

function createMockDevice(overrides: Record<string, unknown> = {}) {
  return {
    id: "dev_1",
    organizationId: "org_1",
    phoneNumber: "+62811111111",
    balance: 0,
    quotaBase: 1000,
    quotaBaseOut: 0,
    dailyLimitMessage: 500,
    status: "ACTIVE",
    token: null,
    tokenEncrypted: "test-encrypted-token",
    tokenIv: null,
    whatsappBusinessAccountId: "waba-1",
    whatsappPhoneId: "phone-1",
    whatsappApplicationId: null,
    whatsappMetaApp: null,
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
    mockFromDevice.mockClear()
    mockFromDevice.mockImplementation(async () => ({
      getBusinessProfile: mock(async () => profileMockData),
      updateBusinessProfile: mock(async () => ({ success: true })),
      uploadProfilePicture: mock(async () => ({ handle: "profile-handle-1" })),
    }))
    // Set up device to exist by default
    ;(
      prisma.whatsappDevice.findUnique as ReturnType<typeof mock>
    ).mockImplementation(async () => createMockDevice())
    ;(
      prisma.whatsappDevice.update as ReturnType<typeof mock>
    ).mockImplementation(async () =>
      createMockDevice({ whatsappProfile: profileMockData })
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
    ;(
      prisma.whatsappDevice.findUnique as ReturnType<typeof mock>
    ).mockImplementation(async () => null)

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

  it("uploads a profile picture and applies Meta's returned handle", async () => {
    ;(
      prisma.whatsappDevice.findUnique as ReturnType<typeof mock>
    ).mockImplementation(async () =>
      createMockDevice({ whatsappApplicationId: "meta-app-1" })
    )

    const formData = new FormData()
    formData.append(
      "file",
      new File([new Uint8Array([1, 2, 3])], "profile.png", {
        type: "image/png",
      })
    )

    const app = createTestApp()
    const res = await app.handle(
      new Request(
        "http://localhost/api/whatsapp/devices/dev_1/profile/picture",
        {
          method: "POST",
          body: formData,
        }
      )
    )

    expect(res.status).toBe(200)
    expect((await res.json()).ok).toBe(true)
    expect(mockFromDevice).toHaveBeenCalledWith(
      expect.objectContaining({ metaAppId: "meta-app-1" })
    )

    const client = (await mockFromDevice.mock.results[0]?.value) as {
      uploadProfilePicture: ReturnType<typeof mock>
      updateBusinessProfile: ReturnType<typeof mock>
    }
    expect(client?.uploadProfilePicture).toHaveBeenCalledWith(
      expect.objectContaining({
        fileName: "profile.png",
        mimeType: "image/png",
      })
    )
    expect(client?.updateBusinessProfile).toHaveBeenCalledWith(
      expect.objectContaining({ profile_picture_handle: "profile-handle-1" })
    )
  })

  it("rejects non-image profile picture uploads", async () => {
    const formData = new FormData()
    formData.append(
      "file",
      new File(["not an image"], "profile.txt", { type: "text/plain" })
    )

    const app = createTestApp()
    const res = await app.handle(
      new Request(
        "http://localhost/api/whatsapp/devices/dev_1/profile/picture",
        {
          method: "POST",
          body: formData,
        }
      )
    )

    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe("UNSUPPORTED_MEDIA_TYPE")
  })
  it("returns 403 when user does not own the device on POST /picture", async () => {
    ;(
      prisma.whatsappDevice.findUnique as ReturnType<typeof mock>
    ).mockImplementation(async () =>
      createMockDevice({ organizationId: "other_org" })
    )

    const formData = new FormData()
    formData.append(
      "file",
      new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "profile.png", {
        type: "image/png",
      })
    )

    const app = createTestApp()
    const res = await app.handle(
      new Request(
        "http://localhost/api/whatsapp/devices/dev_1/profile/picture",
        {
          method: "POST",
          body: formData,
        }
      )
    )

    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe("FORBIDDEN")
  })
  it("returns 404 when device not found on POST /picture", async () => {
    ;(
      prisma.whatsappDevice.findUnique as ReturnType<typeof mock>
    ).mockImplementation(async () => null)

    const formData = new FormData()
    formData.append(
      "file",
      new File([new Uint8Array([1, 2, 3])], "profile.png", {
        type: "image/png",
      })
    )

    const app = createTestApp()
    const res = await app.handle(
      new Request(
        "http://localhost/api/whatsapp/devices/nonexistent/profile/picture",
        {
          method: "POST",
          body: formData,
        }
      )
    )
    expect(res.status).toBe(404)
  })

  it("returns 409 when device has no meta app ID on POST /picture", async () => {
    ;(
      prisma.whatsappDevice.findUnique as ReturnType<typeof mock>
    ).mockImplementation(async () =>
      createMockDevice({ whatsappMetaApp: null })
    )

    const formData = new FormData()
    formData.append(
      "file",
      new File([new Uint8Array([1, 2, 3])], "profile.png", {
        type: "image/png",
      })
    )

    const app = createTestApp()
    const res = await app.handle(
      new Request(
        "http://localhost/api/whatsapp/devices/dev_1/profile/picture",
        {
          method: "POST",
          body: formData,
        }
      )
    )
    expect(res.status).toBe(409)
  })

  it("returns 409 when device has no phone ID on POST /picture", async () => {
    ;(
      prisma.whatsappDevice.findUnique as ReturnType<typeof mock>
    ).mockImplementation(async () =>
      createMockDevice({ whatsappPhoneId: null })
    )

    const formData = new FormData()
    formData.append(
      "file",
      new File([new Uint8Array([1, 2, 3])], "profile.png", {
        type: "image/png",
      })
    )

    const app = createTestApp()
    const res = await app.handle(
      new Request(
        "http://localhost/api/whatsapp/devices/dev_1/profile/picture",
        {
          method: "POST",
          body: formData,
        }
      )
    )
    expect(res.status).toBe(409)
  })

  it("rejects non-multipart requests on POST /picture", async () => {
    const app = createTestApp()
    const res = await app.handle(
      new Request(
        "http://localhost/api/whatsapp/devices/dev_1/profile/picture",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }
      )
    )
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe("BAD_REQUEST")
  })

  it("rejects multipart requests with missing file on POST /picture", async () => {
    const formData = new FormData()
    const app = createTestApp()
    const res = await app.handle(
      new Request(
        "http://localhost/api/whatsapp/devices/dev_1/profile/picture",
        {
          method: "POST",
          body: formData,
        }
      )
    )
    expect(res.status).toBe(422)
    expect((await res.json()).error).toBe("VALIDATION_ERROR")
  })

  it("returns 409 when ProfileNotFoundError is thrown on GET /profile", async () => {
    ;(
      prisma.whatsappDevice.findUnique as ReturnType<typeof mock>
    ).mockImplementation(async () =>
      createMockDevice({ whatsappProfile: null })
    )
    mockFromDevice.mockImplementationOnce(async () => ({
      getBusinessProfile: mock(async () => null),
      updateBusinessProfile: mock(async () => ({ success: true })),
      uploadProfilePicture: mock(async () => ({ handle: "h-1" })),
    }))

    const app = createTestApp()
    const res = await app.handle(
      new Request("http://localhost/api/whatsapp/devices/dev_1/profile", {
        method: "GET",
      })
    )
    expect(res.status).toBe(404)
  })

  it("returns 409 when DeviceNoPhoneIdError is thrown on GET /profile", async () => {
    ;(
      prisma.whatsappDevice.findUnique as ReturnType<typeof mock>
    ).mockImplementation(async () =>
      createMockDevice({ whatsappPhoneId: null })
    )

    const app = createTestApp()
    const res = await app.handle(
      new Request("http://localhost/api/whatsapp/devices/dev_1/profile", {
        method: "GET",
      })
    )
    expect(res.status).toBe(409)
  })

  it("returns 409 when DeviceNoPhoneIdError is thrown on PATCH /profile", async () => {
    ;(
      prisma.whatsappDevice.findUnique as ReturnType<typeof mock>
    ).mockImplementation(async () =>
      createMockDevice({ whatsappPhoneId: null })
    )

    const app = createTestApp()
    const res = await app.handle(
      new Request("http://localhost/api/whatsapp/devices/dev_1/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ about: "Test" }),
      })
    )
    expect(res.status).toBe(409)
  })

  it("returns 404 when ProfileNotFoundError is thrown on PATCH /profile", async () => {
    mockFromDevice.mockImplementationOnce(async () => ({
      getBusinessProfile: mock(async () => null),
      updateBusinessProfile: mock(async () => ({ success: true })),
      uploadProfilePicture: mock(async () => ({ handle: "h-1" })),
    }))

    const app = createTestApp()
    const res = await app.handle(
      new Request("http://localhost/api/whatsapp/devices/dev_1/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ about: "Test" }),
      })
    )
    expect(res.status).toBe(404)
  })

  it("returns 404 when ProfileNotFoundError is thrown on POST /picture", async () => {
    ;(
      prisma.whatsappDevice.findUnique as ReturnType<typeof mock>
    ).mockImplementation(async () =>
      createMockDevice({
        whatsappMetaApp: { metaAppId: "app-1" },
      })
    )
    mockFromDevice.mockImplementation(async () => ({
      getBusinessProfile: mock(async () => null),
      updateBusinessProfile: mock(async () => ({ success: true })),
      uploadProfilePicture: mock(async () => ({ handle: "h-1" })),
    }))
    const formData = new FormData()
    formData.append(
      "file",
      new File([new Uint8Array([1, 2, 3])], "profile.png", {
        type: "image/png",
      })
    )

    const app = createTestApp()
    const res = await app.handle(
      new Request(
        "http://localhost/api/whatsapp/devices/dev_1/profile/picture",
        {
          method: "POST",
          body: formData,
        }
      )
    )
    expect(res.status).toBe(404)
  })

  it("rejects files larger than 5MB on POST /picture", async () => {
    const formData = new FormData()
    const largeBuffer = new Uint8Array(6 * 1024 * 1024)
    formData.append(
      "file",
      new File([largeBuffer], "huge.png", { type: "image/png" })
    )

    const app = createTestApp()
    const res = await app.handle(
      new Request(
        "http://localhost/api/whatsapp/devices/dev_1/profile/picture",
        {
          method: "POST",
          body: formData,
        }
      )
    )
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe("FILE_TOO_LARGE")
  })

  it("GET returns 403 when user does not own the device", async () => {
    ;(
      prisma.whatsappDevice.findUnique as ReturnType<typeof mock>
    ).mockImplementation(async () =>
      createMockDevice({ organizationId: "other_org" })
    )

    const app = createTestApp()
    const res = await app.handle(
      new Request("http://localhost/api/whatsapp/devices/dev_1/profile", {
        method: "GET",
      })
    )
    expect(res.status).toBe(403)
  })

  it("PATCH returns 403 when user does not own the device", async () => {
    ;(
      prisma.whatsappDevice.findUnique as ReturnType<typeof mock>
    ).mockImplementation(async () =>
      createMockDevice({ organizationId: "other_org" })
    )

    const app = createTestApp()
    const res = await app.handle(
      new Request("http://localhost/api/whatsapp/devices/dev_1/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ about: "Test" }),
      })
    )
    expect(res.status).toBe(403)
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
    ;(
      prisma.whatsappDevice.findUnique as ReturnType<typeof mock>
    ).mockImplementation(async () => null)

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
