import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test"

// ─── Prisma mocks for resolveApiKey ─────────────────────────────────────────

const mockApiKeyFindFirst = mock(async (): Promise<unknown> => null)
const mockApiKeyUpdate = mock(async (): Promise<unknown> => ({}))

mock.module("@/lib/prisma", () => ({
  prisma: {
    authApiKey: {
      findFirst: mockApiKeyFindFirst,
      update: mockApiKeyUpdate,
    },
    paymentGateway: { findMany: async () => [], findFirst: async () => null },
    paymentBankAccount: { findMany: async () => [] },
    paymentCurrency: {
      findMany: async () => [],
      findUnique: async () => null,
      findFirst: async () => null,
    },
    billingInvoice: {
      findMany: async () => [],
      findFirst: async () => null,
      create: async (data: unknown) => ({ id: "inv-mock", ...(data as Record<string, unknown>) }),
      update: async (data: unknown) => data,
    },
    billingAccount: {
      findUnique: async () => null,
      create: async (data: unknown) => data as Record<string, unknown>,
    },
    billingAdjustment: { create: async () => ({ id: "adj-mock" }) },
  },
}))

// ─── WorkOS mock for getWorkOSSession ────────────────────────────────────────

const mockAuthenticateWithSessionCookie = mock<
  () => Promise<{ authenticated: boolean; user?: Record<string, unknown> }>
>()

mock.module("@workos-inc/node", () => ({
  createWorkOS: () => ({
    userManagement: {
      authenticateWithSessionCookie: mockAuthenticateWithSessionCookie,
    },
  }),
}))

const { resolveApiKey, getWorkOSSession, extractBearerToken } =
  await import("@/lib/auth/session")

// These WorkOS SDK session-cookie cases require real WorkOS credentials in CI.
const itWorkOSSessionWithSdk = process.env.CI ? it.skip : it

// ─── resolveApiKey ───────────────────────────────────────────────────────────

describe("resolveApiKey", () => {
  beforeEach(() => {
    mockApiKeyFindFirst.mockReset()
    mockApiKeyFindFirst.mockImplementation(async () => null)
    mockApiKeyUpdate.mockReset()
    mockApiKeyUpdate.mockImplementation(async () => ({}))
    delete (process.env as Record<string, unknown>).NODE_ENV
  })

  it("returns null when no matching key found", async () => {
    const result = await resolveApiKey("live_testkey")
    expect(result).toBeNull()
  })

  it("returns PlatformScope when valid key found", async () => {
    mockApiKeyFindFirst.mockImplementationOnce(async () => ({
      id: "key_1",
      name: "Test Key",
      environment: "LIVE",
      organizationId: "org_1",
      scopes: ["platform:admin"],
    }))

    const result = await resolveApiKey("live_testkey")
    expect(result).not.toBeNull()
    expect(result!.type).toBe("platform")
    expect(result!.keyId).toBe("key_1")
    expect(result!.keyName).toBe("Test Key")
    expect(result!.environment).toBe("LIVE")
    expect(result!.organizationId).toBe("org_1")
    expect(result!.scopes).toEqual(["platform:admin"])
  })

  it("strips test_ prefix and sets SANDBOX environment", async () => {
    mockApiKeyFindFirst.mockImplementationOnce(async () => ({
      id: "key_2",
      name: "Sandbox Key",
      environment: "SANDBOX",
      organizationId: "org_1",
      scopes: [],
    }))

    const result = await resolveApiKey("test_sandboxkey")
    expect(result).not.toBeNull()
    expect(result!.environment).toBe("SANDBOX")
  })

  it("returns organizationId from the found key", async () => {
    mockApiKeyFindFirst.mockImplementationOnce(async () => ({
      id: "key_3",
      name: "Org Key",
      environment: "LIVE",
      organizationId: "org_2",
      scopes: ["*"],
    }))

    const result = await resolveApiKey("live_orgkey")
    expect(result).not.toBeNull()
    expect(result!.organizationId).toBe("org_2")
  })

  it("returns null in production with default salt", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(process.env as any).NODE_ENV = "production"
    delete process.env.API_KEY_HASH_SALT

    const result = await resolveApiKey("live_testkey")
    expect(result).toBeNull()
  })

  it("allows production with non-default salt", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(process.env as any).NODE_ENV = "production"
    process.env.API_KEY_HASH_SALT = "real-production-salt"

    mockApiKeyFindFirst.mockImplementationOnce(async () => ({
      id: "key_4",
      name: "Prod Key",
      environment: "LIVE",
      organizationId: "org_1",
      scopes: [],
    }))

    const result = await resolveApiKey("live_prodkey")
    expect(result).not.toBeNull()
    expect(result!.keyId).toBe("key_4")

    delete process.env.API_KEY_HASH_SALT
  })

  it("passes clientIp to lastUsedIp update", async () => {
    mockApiKeyFindFirst.mockImplementationOnce(async () => ({
      id: "key_5",
      name: "IP Key",
      environment: "LIVE",
      organizationId: "org_1",
      scopes: [],
    }))

    await resolveApiKey("live_ipkey", "192.168.1.1")

    expect(mockApiKeyUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lastUsedIp: "192.168.1.1",
        }),
      })
    )
  })

  it("handles update failure gracefully (catch)", async () => {
    mockApiKeyFindFirst.mockImplementationOnce(async () => ({
      id: "key_6",
      name: "Fail Key",
      environment: "LIVE",
      organizationId: "org_1",
      scopes: [],
    }))
    mockApiKeyUpdate.mockImplementationOnce(async () => {
      throw new Error("DB error")
    })

    const result = await resolveApiKey("live_failkey")
    expect(result).not.toBeNull()
    expect(result!.keyId).toBe("key_6")
  })
})

// ─── extractBearerToken ─────────────────────────────────────────────────────

describe("extractBearerToken", () => {
  it("returns token from Authorization header", () => {
    const request = new Request("http://localhost", {
      headers: { Authorization: "Bearer mytoken123" },
    })

    const result = extractBearerToken(request)
    expect(result).toBe("mytoken123")
  })

  it("returns null when no Authorization header", () => {
    const request = new Request("http://localhost")

    const result = extractBearerToken(request)
    expect(result).toBeNull()
  })

  it("returns null when Authorization header is not Bearer", () => {
    const request = new Request("http://localhost", {
      headers: { Authorization: "Basic dXNlcjpwYXNz" },
    })

    const result = extractBearerToken(request)
    expect(result).toBeNull()
  })

  it("returns null when Bearer token is empty", () => {
    const request = new Request("http://localhost", {
      headers: { Authorization: "Bearer " },
    })

    const result = extractBearerToken(request)
    expect(result).toBeNull()
  })
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Bun blocks setting Cookie header on Request (forbidden header name),
// so we override headers.get to return the desired cookie string.
function withCookie(cookieStr: string): Request {
  const req = new Request("http://localhost")
  const originalGet = req.headers.get.bind(req.headers)
  req.headers.get = (name: string) => {
    if (name.toLowerCase() === "cookie") return cookieStr
    return originalGet(name)
  }
  return req
}

function withBearer(token: string): Request {
  return new Request("http://localhost", {
    headers: { Authorization: `Bearer ${token}` },
  })
}

function withBearerAndCookie(bearer: string, cookie: string): Request {
  const req = withBearer(bearer)
  const originalGet = req.headers.get.bind(req.headers)
  req.headers.get = (name: string) => {
    if (name.toLowerCase() === "cookie") return cookie
    return originalGet(name)
  }
  return req
}

// ─── getWorkOSSession ────────────────────────────────────────────────────────

describe("getWorkOSSession", () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    delete process.env.WORKOS_COOKIE_PASSWORD
    delete process.env.WORKOS_COOKIE_NAME
    mockAuthenticateWithSessionCookie.mockReset()
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it("returns null when WORKOS_COOKIE_PASSWORD is not set", async () => {
    const request = new Request("http://localhost")
    const result = await getWorkOSSession(request)
    expect(result).toBeNull()
  })

  it("returns null when cookie password is empty string", async () => {
    process.env.WORKOS_COOKIE_PASSWORD = "   "
    const request = new Request("http://localhost")
    const result = await getWorkOSSession(request)
    expect(result).toBeNull()
  })

  itWorkOSSessionWithSdk(
    "extracts session from cookie and returns user when authenticated",
    async () => {
      process.env.WORKOS_COOKIE_PASSWORD = "super-secret-password"

      mockAuthenticateWithSessionCookie.mockResolvedValue({
        authenticated: true,
        user: { id: "user_1", email: "test@example.com" },
      })

      const request = withCookie("wos-session=sealed_session_data_here")

      const result = await getWorkOSSession(request)
      expect(result).not.toBeNull()
      expect(result!.id).toBe("user_1")
      expect(result!.email).toBe("test@example.com")

      expect(mockAuthenticateWithSessionCookie).toHaveBeenCalledWith({
        sessionData: "sealed_session_data_here",
        cookiePassword: "super-secret-password",
      })
    }
  )

  itWorkOSSessionWithSdk(
    "extracts session from custom cookie name",
    async () => {
      process.env.WORKOS_COOKIE_PASSWORD = "super-secret-password"
      process.env.WORKOS_COOKIE_NAME = "my-session"

      mockAuthenticateWithSessionCookie.mockResolvedValue({
        authenticated: true,
        user: { id: "user_2" },
      })

      const request = withCookie("my-session=custom_cookie_data")

      const result = await getWorkOSSession(request)
      expect(result).not.toBeNull()
      expect(result!.id).toBe("user_2")
    }
  )

  itWorkOSSessionWithSdk(
    "uses Bearer token with wos_ prefix when present",
    async () => {
      process.env.WORKOS_COOKIE_PASSWORD = "super-secret-password"

      mockAuthenticateWithSessionCookie.mockResolvedValue({
        authenticated: true,
        user: { id: "user_3" },
      })

      const request = withBearer("wos_sealed_token")

      const result = await getWorkOSSession(request)
      expect(result).not.toBeNull()

      expect(mockAuthenticateWithSessionCookie).toHaveBeenCalledWith({
        sessionData: "wos_sealed_token",
        cookiePassword: "super-secret-password",
      })
    }
  )

  itWorkOSSessionWithSdk(
    "returns null when WorkOS SDK returns not authenticated",
    async () => {
      process.env.WORKOS_COOKIE_PASSWORD = "super-secret-password"

      mockAuthenticateWithSessionCookie.mockResolvedValue({
        authenticated: false,
      })

      const request = withCookie("wos-session=invalid_data")

      const result = await getWorkOSSession(request)
      expect(result).toBeNull()
    }
  )

  itWorkOSSessionWithSdk(
    "returns null when WorkOS SDK throws",
    async () => {
      process.env.WORKOS_COOKIE_PASSWORD = "super-secret-password"

      mockAuthenticateWithSessionCookie.mockRejectedValue(
        new Error("SDK error")
      )

      const request = withCookie("wos-session=bad_data")

      const result = await getWorkOSSession(request)
      expect(result).toBeNull()
    }
  )

  it("returns null when no session data in cookie or bearer", async () => {
    process.env.WORKOS_COOKIE_PASSWORD = "super-secret-password"

    const request = new Request("http://localhost")

    const result = await getWorkOSSession(request)
    expect(result).toBeNull()
  })

  itWorkOSSessionWithSdk(
    "prefers bearer token over cookie when both present",
    async () => {
      process.env.WORKOS_COOKIE_PASSWORD = "super-secret-password"

      mockAuthenticateWithSessionCookie.mockResolvedValue({
        authenticated: true,
        user: { id: "user_bearer" },
      })

      const request = withBearerAndCookie(
        "wos_bearer_token",
        "wos-session=cookie_data"
      )

      const result = await getWorkOSSession(request)
      expect(result).not.toBeNull()

      // Should have used the bearer token, not the cookie
      expect(mockAuthenticateWithSessionCookie).toHaveBeenCalledWith({
        sessionData: "wos_bearer_token",
        cookiePassword: "super-secret-password",
      })
    }
  )
})
