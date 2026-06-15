import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"

// ---------------------------------------------------------------------------
// Mocks — must be declared before mock.module() calls
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
    // If NX mode and key exists, simulate lock failure
    if (_nx === "NX" && redisStore.has(key)) return null
    redisStore.set(key, _val)
    return "OK"
  }
)
const mockRedisDel = mock(async (key: string): Promise<number> => {
  redisStore.delete(key)
  return 1
})

const mockPrismaFindUnique = mock(
  async (_args: unknown): Promise<Record<string, unknown> | null> => {
    return null
  }
)
const mockPrismaUpsert = mock(
  async (_args: unknown): Promise<Record<string, unknown>> => {
    return {}
  }
)
const mockPrismaDelete = mock(
  async (_args: unknown): Promise<Record<string, unknown>> => {
    return {}
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
      findUnique: mockPrismaFindUnique,
      upsert: mockPrismaUpsert,
      delete: mockPrismaDelete,
    },
  },
}))

// ---------------------------------------------------------------------------
// Module under test
// ---------------------------------------------------------------------------

const { getOrFetch, del } = await import("@/lib/cache/index")

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const dbStore = new Map<
  string,
  { value: string; expiresAt: Date | null }
>()

function dbEntry(
  key: string,
  value: unknown,
  expiresAt: Date | null
): Record<string, unknown> {
  return { id: "db_id", key, value: JSON.stringify(value), expiresAt }
}

function setupDbHit(key: string, value: unknown, ttlSeconds = 3600) {
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000)
  dbStore.set(key, { value: JSON.stringify(value), expiresAt })
  mockPrismaFindUnique.mockResolvedValueOnce(dbEntry(key, value, expiresAt))
}

function setupDbExpired(key: string, value: unknown) {
  const expiresAt = new Date(Date.now() - 1000)
  dbStore.set(key, { value: JSON.stringify(value), expiresAt })
  mockPrismaFindUnique.mockResolvedValueOnce(dbEntry(key, value, expiresAt))
}

function defaultRedisGet(key: string): Promise<string | null> {
  return Promise.resolve(redisStore.get(key) ?? null)
}

function defaultRedisSet(
  key: string,
  val: string,
  _mode: string,
  _ttl: number,
  _nx?: string
): Promise<"OK" | null> {
  if (_nx === "NX" && redisStore.has(key)) return Promise.resolve(null)
  redisStore.set(key, val)
  return Promise.resolve("OK")
}

function defaultRedisDel(key: string): Promise<number> {
  redisStore.delete(key)
  return Promise.resolve(1)
}

function defaultPrismaFindUnique(
  args: unknown
): Promise<Record<string, unknown> | null> {
  const aw = args as { where: { key: string } }
  const lookupKey = aw?.where?.key
  if (!lookupKey) return Promise.resolve(null)
  const entry = dbStore.get(lookupKey)
  if (!entry) return Promise.resolve(null)
  return Promise.resolve(dbEntry(lookupKey, entry.value, entry.expiresAt))
}

function defaultPrismaUpsert(
  args: unknown
): Promise<Record<string, unknown>> {
  const create = (args as Record<string, unknown>).create as Record<
    string,
    unknown
  >
  dbStore.set(create.key as string, {
    value: create.value as string,
    expiresAt: create.expiresAt as Date,
  })
  return Promise.resolve({})
}

function defaultPrismaDelete(args: unknown): Promise<Record<string, unknown>> {
  const lookupKey = (args as { where: { key: string } }).where?.key
  if (lookupKey) dbStore.delete(lookupKey)
  return Promise.resolve({})
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  redisStore.clear()
  dbStore.clear()

  mockRedisGet.mockReset()
  mockRedisSet.mockReset()
  mockRedisDel.mockReset()

  mockPrismaFindUnique.mockReset()
  mockPrismaUpsert.mockReset()
  mockPrismaDelete.mockReset()

  // Set up default behaviors
  mockRedisGet.mockImplementation(defaultRedisGet)
  mockRedisSet.mockImplementation(defaultRedisSet)
  mockRedisDel.mockImplementation(defaultRedisDel)
  mockPrismaFindUnique.mockImplementation(defaultPrismaFindUnique)
  mockPrismaUpsert.mockImplementation(defaultPrismaUpsert)
  mockPrismaDelete.mockImplementation(defaultPrismaDelete)
})

afterEach(() => {
  redisStore.clear()
  dbStore.clear()
})

describe("getOrFetch", () => {
  it("populates Redis and DB on first call (cache miss)", async () => {
    const fetchFn = mock(async () => ({ data: "fresh" }))

    const result = await getOrFetch("test-key", fetchFn, 60)

    expect(result).toEqual({ data: "fresh" })
    expect(fetchFn).toHaveBeenCalledTimes(1)
    // Lock acquired then released
    expect(redisStore.has("cache:gate:test-key")).toBe(false)
    expect(redisStore.has("test-key")).toBe(true)
    expect(JSON.parse(redisStore.get("test-key")!)).toEqual({ data: "fresh" })
    // DB upsert called
    expect(mockPrismaUpsert).toHaveBeenCalled()
    expect(dbStore.has("test-key")).toBe(true)
  })

  it("returns cached from Redis on second call (fetch not called)", async () => {
    const fetchFn = mock(async () => ({ data: "fresh" }))

    // First call — populate cache
    await getOrFetch("test-key", fetchFn, 60)
    expect(fetchFn).toHaveBeenCalledTimes(1)

    // Second call — Redis hit
    const result = await getOrFetch("test-key", fetchFn, 60)
    expect(result).toEqual({ data: "fresh" })
    expect(fetchFn).toHaveBeenCalledTimes(1) // not called again
  })

  it("falls back to DB when Redis is unavailable", async () => {
    mockRedisGet.mockRejectedValue(new Error("Redis unreachable"))
    mockRedisSet.mockRejectedValue(new Error("Redis unreachable"))

    setupDbHit("fallback-key", { data: "from-db" })

    const fetchFn = mock(async () => ({ data: "fresh" }))

    const result = await getOrFetch("fallback-key", fetchFn, 60)

    expect(result).toEqual({ data: "from-db" })
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it("gate lock prevents concurrent fetch calls (serve stale from DB)", async () => {
    // Redis returns null (cache miss)
    mockRedisGet.mockResolvedValue(null)
    // Lock not acquired — simulate existing lock key
    mockRedisSet.mockImplementation(
      async (
        key: string,
        _val: string,
        _mode: string,
        _ttl: number,
        _nx?: string
      ): Promise<"OK" | null> => {
        if (_nx === "NX") return null // lock denied
        redisStore.set(key, _val)
        return "OK"
      }
    )

    setupDbHit("concurrent-key", { data: "stale" })

    const fetchFn = mock(async () => ({ data: "fresh" }))

    const result = await getOrFetch("concurrent-key", fetchFn, 60)

    // Should return stale DB value without calling fetch
    expect(result).toEqual({ data: "stale" })
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it("del removes from both stores", async () => {
    const fetchFn = mock(async () => ({ data: "cached" }))
    await getOrFetch("delete-me", fetchFn, 60)

    expect(redisStore.has("delete-me")).toBe(true)
    expect(dbStore.has("delete-me")).toBe(true)

    await del("delete-me")

    expect(redisStore.has("delete-me")).toBe(false)
    expect(dbStore.has("delete-me")).toBe(false)
  })

  it("TTL expiration triggers fetch again", async () => {
    const fetchFn = mock(async () => ({ data: "first" }))

    // First call with 1 second TTL
    await getOrFetch("ttl-key", fetchFn, 1)
    expect(fetchFn).toHaveBeenCalledTimes(1)

    // Reset Redis — simulate expiry
    redisStore.delete("ttl-key")
    mockRedisGet.mockImplementation(defaultRedisGet)

    // DB has expired entry
    setupDbExpired("ttl-key", { data: "first" })

    const fetchFn2 = mock(async () => ({ data: "second" }))
    const result = await getOrFetch("ttl-key", fetchFn2, 60)

    expect(result).toEqual({ data: "second" })
    expect(fetchFn2).toHaveBeenCalledTimes(1)
  })

  it("Redis failures are non-fatal — falls through to origin fetch", async () => {
    mockRedisGet.mockRejectedValue(new Error("Redis down"))
    mockRedisSet.mockRejectedValue(new Error("Redis down"))

    // DB has nothing
    mockPrismaFindUnique.mockResolvedValue(null)

    const fetchFn = mock(async () => ({ data: "origin-value" }))

    const result = await getOrFetch("redis-down", fetchFn, 60)

    expect(result).toEqual({ data: "origin-value" })
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })
})
