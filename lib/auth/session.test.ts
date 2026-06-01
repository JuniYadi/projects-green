import { beforeEach, describe, expect, it, mock } from "bun:test"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockApiKeyFindFirst = mock(async (): Promise<any> => null)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockApiKeyUpdate = mock(async (): Promise<any> => ({}))

mock.module("@/lib/prisma", () => ({
  prisma: {
    apiKey: {
      findFirst: mockApiKeyFindFirst,
      update: mockApiKeyUpdate,
    },
  },
}))

const { resolveApiKey } = await import("@/lib/auth/session")

describe("resolveApiKey", () => {
  beforeEach(() => {
    mockApiKeyFindFirst.mockReset()
    mockApiKeyFindFirst.mockImplementation(async () => null)
    mockApiKeyUpdate.mockReset()
    mockApiKeyUpdate.mockImplementation(async () => ({}))
    delete (process.env as Record<string, unknown>).NODE_ENV
  })

  it("returns null when no matching key found", async () => {
    mockApiKeyFindFirst.mockImplementationOnce(async () => null)
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
})
