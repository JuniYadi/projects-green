import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"

// ---------------------------------------------------------------------------
// Mocks — must be before mock.module() calls
// ---------------------------------------------------------------------------

const redisStore = new Map<string, string>()

const mockRedisGet = mock(async (key: string): Promise<string | null> => {
  return redisStore.get(key) ?? null
})
const mockRedisSet = mock(
  async (
    key: string,
    _val: string,
    _mode: string,
    _ttl: number,
    _nx?: string
  ): Promise<"OK" | null> => {
    if (_nx === "NX" && redisStore.has(key)) return null
    redisStore.set(key, _val)
    return "OK"
  }
)
const mockRedisDel = mock(async (key: string): Promise<number> => {
  redisStore.delete(key)
  return 1
})

const mockWorkosGetUser = mock(
  async (_userId: string): Promise<Record<string, unknown>> => {
    return {
      id: _userId,
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
    }
  }
)

const mockWorkosGetOrg = mock(
  async (_orgId: string): Promise<Record<string, unknown>> => {
    return {
      id: _orgId,
      name: "Acme Corp",
      slug: "acme-corp",
    }
  }
)

// ---------------------------------------------------------------------------
// Register mocks before any imports
// ---------------------------------------------------------------------------

mock.module("@/lib/redis", () => ({
  redis: {
    get: mockRedisGet,
    set: mockRedisSet,
    del: mockRedisDel,
  },
}))

mock.module("@/lib/prisma", () => ({
  prisma: {
    cacheEntry: {
      findUnique: mock(async () => null),
      upsert: mock(async () => ({})),
      delete: mock(async () => ({})),
    },
  },
}))

mock.module("@workos-inc/authkit-nextjs", () => ({
  getWorkOS: () => ({
    userManagement: {
      getUser: mockWorkosGetUser,
    },
    organizations: {
      getOrganization: mockWorkosGetOrg,
    },
  }),
}))

// ---------------------------------------------------------------------------
// Module under test
// ---------------------------------------------------------------------------

const { workosCacheService } = await import("./workos-cache.service")

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupRedisHit(key: string, value: unknown) {
  redisStore.set(key, JSON.stringify(value))
}

function clearRedis() {
  redisStore.clear()
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  clearRedis()
  mockRedisGet.mockReset()
  mockRedisSet.mockReset()
  mockRedisDel.mockReset()
  mockWorkosGetUser.mockReset()
  mockWorkosGetOrg.mockReset()

  // Default behaviours
  mockRedisGet.mockImplementation(
    async (key: string) => redisStore.get(key) ?? null
  )
  mockRedisSet.mockImplementation(
    async (
      key: string,
      _val: string,
      _mode: string,
      _ttl: number,
      _nx?: string
    ): Promise<"OK" | null> => {
      if (_nx === "NX" && redisStore.has(key)) return null
      redisStore.set(key, _val)
      return "OK"
    }
  )
  mockRedisDel.mockImplementation(async (key: string) => {
    redisStore.delete(key)
    return 1
  })

  mockWorkosGetUser.mockImplementation(
    async (userId: string): Promise<Record<string, unknown>> => ({
      id: userId,
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
    })
  )
  mockWorkosGetOrg.mockImplementation(
    async (orgId: string): Promise<Record<string, unknown>> => ({
      id: orgId,
      name: "Acme Corp",
      slug: "acme-corp",
    })
  )
})

afterEach(() => {
  clearRedis()
})

describe("workosCacheService.getUser", () => {
  it("returns null for null/undefined input", async () => {
    expect(await workosCacheService.getUser(null)).toBeNull()
    expect(await workosCacheService.getUser(undefined)).toBeNull()
    expect(mockWorkosGetUser).not.toHaveBeenCalled()
  })

  it("fetches from WorkOS on cache miss and caches result", async () => {
    const result = await workosCacheService.getUser("user_abc")

    expect(result).not.toBeNull()
    expect(result!.id).toBe("user_abc")
    expect(result!.name).toBe("John Doe")
    expect(result!.email).toBe("john@example.com")
    expect(mockWorkosGetUser).toHaveBeenCalledTimes(1)

    // Should be cached in Redis (key prefix: workos:user:user_abc)
    const cached = redisStore.get("workos:user:user_abc")
    expect(cached).not.toBeUndefined()
    expect(JSON.parse(cached!)).toEqual({
      id: "user_abc",
      name: "John Doe",
      email: "john@example.com",
    })
  })

  it("returns cached data on second call without calling WorkOS again", async () => {
    // First call — fetch and cache
    await workosCacheService.getUser("user_abc")
    expect(mockWorkosGetUser).toHaveBeenCalledTimes(1)

    // Second call — should read from cache
    const result = await workosCacheService.getUser("user_abc")
    expect(result).not.toBeNull()
    expect(result!.name).toBe("John Doe")
    expect(mockWorkosGetUser).toHaveBeenCalledTimes(1) // not called again
  })

  it("fallback gracefully when WorkOS API fails", async () => {
    mockWorkosGetUser.mockRejectedValue(new Error("WorkOS is down"))

    const result = await workosCacheService.getUser("user_abc")
    // Should return null instead of crashing
    expect(result).toBeNull()
  })

  it("handles user with no name gracefully", async () => {
    mockWorkosGetUser.mockResolvedValue({
      id: "user_no_name",
      firstName: null,
      lastName: null,
      email: null,
    })

    const result = await workosCacheService.getUser("user_no_name")
    expect(result).not.toBeNull()
    expect(result!.name).toBe("Unknown User")
    expect(result!.email).toBe("")
  })

  it("uses email local part as fallback name", async () => {
    mockWorkosGetUser.mockResolvedValue({
      id: "user_email_only",
      firstName: null,
      lastName: null,
      email: "alice@example.com",
    })

    const result = await workosCacheService.getUser("user_email_only")
    expect(result!.name).toBe("alice")
  })
})

describe("workosCacheService.getOrg", () => {
  it("returns null for null/undefined input", async () => {
    expect(await workosCacheService.getOrg(null)).toBeNull()
    expect(await workosCacheService.getOrg(undefined)).toBeNull()
    expect(mockWorkosGetOrg).not.toHaveBeenCalled()
  })

  it("fetches from WorkOS on cache miss and caches result", async () => {
    const result = await workosCacheService.getOrg("org_xyz")

    expect(result).not.toBeNull()
    expect(result!.id).toBe("org_xyz")
    expect(result!.name).toBe("Acme Corp")
    expect(result!.slug).toBe("acme-corp")
    expect(mockWorkosGetOrg).toHaveBeenCalledTimes(1)

    // Should be cached in Redis
    const cached = redisStore.get("workos:org:org_xyz")
    expect(cached).not.toBeUndefined()
    expect(JSON.parse(cached!)).toEqual({
      id: "org_xyz",
      name: "Acme Corp",
      slug: "acme-corp",
    })
  })

  it("returns cached data on second call without calling WorkOS again", async () => {
    await workosCacheService.getOrg("org_xyz")
    expect(mockWorkosGetOrg).toHaveBeenCalledTimes(1)

    const result = await workosCacheService.getOrg("org_xyz")
    expect(result!.name).toBe("Acme Corp")
    expect(mockWorkosGetOrg).toHaveBeenCalledTimes(1)
  })

  it("fallback gracefully when WorkOS API fails", async () => {
    mockWorkosGetOrg.mockRejectedValue(new Error("WorkOS is down"))

    const result = await workosCacheService.getOrg("org_xyz")
    expect(result).toBeNull()
  })
})

describe("workosCacheService.invalidateUser", () => {
  it("removes cached user from Redis", async () => {
    // Prime the cache
    await workosCacheService.getUser("user_abc")
    expect(redisStore.has("workos:user:user_abc")).toBe(true)

    await workosCacheService.invalidateUser("user_abc")
    expect(redisStore.has("workos:user:user_abc")).toBe(false)
  })
})

describe("workosCacheService.invalidateOrg", () => {
  it("removes cached org from Redis", async () => {
    await workosCacheService.getOrg("org_xyz")
    expect(redisStore.has("workos:org:org_xyz")).toBe(true)

    await workosCacheService.invalidateOrg("org_xyz")
    expect(redisStore.has("workos:org:org_xyz")).toBe(false)
  })
})
