import { beforeEach, describe, expect, it, mock } from "bun:test"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockResolveAuthContext = mock(async (): Promise<any> => null)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockResolveProxyAuth = mock(async (): Promise<any> => ({ ok: false }))

mock.module("@/lib/auth/resolve-proxy-auth", () => ({
  resolveAuthContext: mockResolveAuthContext,
  resolveProxyAuth: mockResolveProxyAuth,
}))

const { authWhoamiRoute } = await import(
  "@/modules/auth/api/auth-whoami.route"
)

function createTestApp() {
  return authWhoamiRoute
}

describe("auth-whoami route", () => {
  beforeEach(() => {
    mockResolveAuthContext.mockReset()
    mockResolveAuthContext.mockImplementation(async () => null)
    mockResolveProxyAuth.mockReset()
    mockResolveProxyAuth.mockImplementation(async () => ({ ok: false }))
  })

  it("returns 200 + ok:false when no auth", async () => {
    const app = createTestApp()
    const res = await app.handle(
      new Request("http://localhost/auth/whoami")
    )
    expect(res.status).toBe(200)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = (await res.json()) as Record<string, any>
    expect(body.ok).toBe(false)
    expect(body.auth).toBeNull()
  })

  it("returns 401 when strict=1 and no auth", async () => {
    const app = createTestApp()
    const res = await app.handle(
      new Request("http://localhost/auth/whoami?strict=1")
    )
    expect(res.status).toBe(401)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = (await res.json()) as Record<string, any>
    expect(body.ok).toBe(false)
    expect(body.error).toBe("UNAUTHORIZED")
  })

  it("returns 200 + ok:true for WorkOS scope with source:proxy_header", async () => {
    mockResolveAuthContext.mockImplementationOnce(async () => ({
      type: "workos",
      userId: "user_1",
      email: "test@example.com",
      organizationId: "org_1",
      orgRole: "admin",
      platformRole: "none",
      source: "proxy_header",
    }))

    const app = createTestApp()
    const res = await app.handle(
      new Request("http://localhost/auth/whoami")
    )
    expect(res.status).toBe(200)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = (await res.json()) as Record<string, any>
    expect(body.ok).toBe(true)
    expect(body.auth.type).toBe("workos")
    expect(body.auth.source).toBe("proxy_header")
    expect(body.auth.userId).toBe("user_1")
  })

  it("returns 200 + ok:true for platform scope with source:api_key", async () => {
    mockResolveAuthContext.mockImplementationOnce(async () => ({
      type: "platform",
      keyId: "key_1",
      keyName: "Test Key",
      organizationId: "org_1",
      environment: "SANDBOX",
      scopes: ["platform:admin"],
      source: "api_key",
    }))

    const app = createTestApp()
    const res = await app.handle(
      new Request("http://localhost/auth/whoami")
    )
    expect(res.status).toBe(200)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = (await res.json()) as Record<string, any>
    expect(body.ok).toBe(true)
    expect(body.auth.type).toBe("platform")
    expect(body.auth.source).toBe("api_key")
    expect(body.auth.keyId).toBe("key_1")
  })

  it("returns 401 + ok:false for strict=1 with no auth", async () => {
    mockResolveAuthContext.mockImplementationOnce(async () => null)

    const app = createTestApp()
    const res = await app.handle(
      new Request("http://localhost/auth/whoami?strict=1")
    )
    expect(res.status).toBe(401)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = (await res.json()) as Record<string, any>
    expect(body.ok).toBe(false)
    expect(body.error).toBe("UNAUTHORIZED")
  })
})
