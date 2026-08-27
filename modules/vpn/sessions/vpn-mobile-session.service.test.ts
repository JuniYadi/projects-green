import { beforeEach, describe, expect, it, mock } from "bun:test"
import { VpnMobileSessionService } from "./vpn-mobile-session.service"

describe("VpnMobileSessionService", () => {
  const fixedNow = new Date("2026-08-28T12:00:00.000Z")
  const mockCreate = mock(() => Promise.resolve({}))
  const mockFindFirst = mock(() => Promise.resolve(null))
  const mockFindUnique = mock(() => Promise.resolve(null))
  const mockFindMany = mock(() => Promise.resolve([]))
  const mockUpdate = mock(() => Promise.resolve({}))
  const mockUpdateMany = mock(() => Promise.resolve({ count: 0 }))
  const mockCount = mock(() => Promise.resolve(0))
  const mockGroupBy = mock(() => Promise.resolve([]))
  const mockPrisma = {
    vpnMobileSession: {
      create: mockCreate,
      findFirst: mockFindFirst,
      findUnique: mockFindUnique,
      findMany: mockFindMany,
      update: mockUpdate,
      updateMany: mockUpdateMany,
      count: mockCount,
      groupBy: mockGroupBy,
    },
  } as unknown as never

  let service: VpnMobileSessionService

  beforeEach(() => {
    mockCreate.mockClear()
    mockFindFirst.mockClear()
    mockFindUnique.mockClear()
    mockFindMany.mockClear()
    mockUpdate.mockClear()
    mockUpdateMany.mockClear()
    mockCount.mockClear()
    mockGroupBy.mockClear()

    service = new VpnMobileSessionService(mockPrisma, {
      now: () => fixedNow,
    })
  })

  describe("create", () => {
    it("creates a new session with startedAt and lastPingAt", async () => {
      mockCreate.mockResolvedValueOnce({
        id: "sess-1",
        deviceId: "dev-1",
        subscriptionId: "sub-1",
        serverAccountId: "acc-1",
        serverId: "srv-1",
        startedAt: fixedNow,
        lastPingAt: fixedNow,
      })

      const session = await service.create({
        deviceId: "dev-1",
        subscriptionId: "sub-1",
        serverAccountId: "acc-1",
        serverId: "srv-1",
      })

      expect(session).toEqual(
        expect.objectContaining({
          id: "sess-1",
          deviceId: "dev-1",
        })
      )
      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          deviceId: "dev-1",
          subscriptionId: "sub-1",
          serverAccountId: "acc-1",
          serverId: "srv-1",
          startedAt: fixedNow,
          lastPingAt: fixedNow,
        },
      })
    })
  })

  describe("findById", () => {
    it("finds session by id", async () => {
      mockFindFirst.mockResolvedValueOnce({ id: "sess-1" } as unknown as never)

      const res = await service.findById("sess-1")

      expect(res).toEqual({ id: "sess-1" } as unknown as never)
      expect(mockFindFirst).toHaveBeenCalledWith({
        where: { id: "sess-1" },
      })
    })

    it("scopes by organizationId when provided", async () => {
      mockFindFirst.mockResolvedValueOnce({ id: "sess-1" } as unknown as never)

      const res = await service.findById("sess-1", "org-123")

      expect(res).toEqual({ id: "sess-1" } as unknown as never)
      expect(mockFindFirst).toHaveBeenCalledWith({
        where: {
          id: "sess-1",
          device: { subscription: { organizationId: "org-123" } },
        },
      })
    })
  })

  describe("ping", () => {
    it("updates lastPingAt for active session", async () => {
      mockUpdate.mockResolvedValueOnce({
        id: "sess-1",
        lastPingAt: fixedNow,
      } as unknown as never)

      const res = await service.ping("sess-1")

      expect(res).toEqual({
        id: "sess-1",
        lastPingAt: fixedNow,
      } as unknown as never)
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: "sess-1", status: "ACTIVE" },
        data: { lastPingAt: fixedNow },
      })
    })

    it("returns null when session ping fails or not found", async () => {
      mockUpdate.mockRejectedValueOnce(new Error("Record not found"))

      const res = await service.ping("sess-unknown")

      expect(res).toBeNull()
    })
  })

  describe("close", () => {
    it("returns null if session does not exist", async () => {
      mockFindUnique.mockResolvedValueOnce(null)

      const res = await service.close("sess-nonexistent")

      expect(res).toBeNull()
    })

    it("closes active or stale session with endedAt and traffic increment", async () => {
      mockFindUnique.mockResolvedValueOnce({
        status: "ACTIVE",
        txBytes: BigInt(0),
        rxBytes: BigInt(0),
      })
      mockUpdate.mockResolvedValueOnce({
        id: "sess-1",
        status: "CLOSED",
        endedAt: fixedNow,
      })

      const res = await service.close("sess-1", {
        txBytes: 1024,
        rxBytes: 2048,
      })

      expect(res).toEqual(
        expect.objectContaining({
          id: "sess-1",
          status: "CLOSED",
        })
      )
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: "sess-1", status: { in: ["ACTIVE", "STALE"] } },
        data: {
          status: "CLOSED",
          endedAt: fixedNow,
          txBytes: { increment: BigInt(1024) },
          rxBytes: { increment: BigInt(2048) },
        },
      })
    })

    it("handles already CLOSED session idempotently by accumulating delta", async () => {
      mockFindUnique.mockResolvedValueOnce({
        status: "CLOSED",
        txBytes: BigInt(1000),
        rxBytes: BigInt(2000),
      })
      mockUpdate.mockResolvedValueOnce({
        id: "sess-1",
        status: "CLOSED",
      })

      const res = await service.close("sess-1", {
        txBytes: 500,
        rxBytes: 500,
      })

      expect(res).toEqual(
        expect.objectContaining({
          id: "sess-1",
          status: "CLOSED",
        })
      )
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: "sess-1" },
        data: {
          txBytes: { increment: BigInt(500) },
          rxBytes: { increment: BigInt(500) },
        },
      })
    })
  })

  describe("list", () => {
    it("lists sessions with filters and pagination cursor", async () => {
      mockCount.mockResolvedValueOnce(2)
      mockFindMany.mockResolvedValueOnce([
        {
          id: "sess-1",
          startedAt: new Date("2026-08-28T10:00:00.000Z"),
          device: { deviceName: "iPhone" },
          server: { name: "SG-1", region: { name: "Singapore" } },
          serverAccount: { protocol: "WIREGUARD" },
        },
        {
          id: "sess-2",
          startedAt: new Date("2026-08-28T09:00:00.000Z"),
          device: { deviceName: "MacBook" },
          server: { name: "SG-1", region: { name: "Singapore" } },
          serverAccount: { protocol: "WIREGUARD" },
        },
      ])

      const res = await service.list({
        status: "ACTIVE",
        serverId: "srv-1",
        subscriptionId: "sub-1",
        deviceId: "dev-1",
        organizationId: "org-1",
        limit: 1,
      })

      expect(res.total).toBe(2)
      expect(res.sessions).toHaveLength(1)
      expect(res.nextCursor).toBeDefined()
      expect(mockFindMany).toHaveBeenCalled()
    })

    it("handles cursor decoding when cursor is passed", async () => {
      mockCount.mockResolvedValueOnce(1)
      mockFindMany.mockResolvedValueOnce([
        {
          id: "sess-2",
          startedAt: new Date("2026-08-28T09:00:00.000Z"),
          device: { deviceName: "MacBook" },
          server: { name: "SG-1", region: { name: "Singapore" } },
          serverAccount: { protocol: "WIREGUARD" },
        },
      ])

      const cursorJson = JSON.stringify({
        startedAt: "2026-08-28T10:00:00.000Z",
        id: "sess-1",
      })

      const res = await service.list({
        cursor: cursorJson,
        limit: 10,
      })

      expect(res.sessions).toHaveLength(1)
      expect(res.nextCursor).toBeNull()
    })
  })

  describe("cleanStale", () => {
    it("updates stale active sessions whose lastPingAt exceeded threshold", async () => {
      mockUpdateMany.mockResolvedValueOnce({ count: 3 })

      const count = await service.cleanStale(15)

      expect(count).toBe(3)
      const expectedCutoff = new Date(fixedNow.getTime() - 15 * 60_000)
      expect(mockUpdateMany).toHaveBeenCalledWith({
        where: {
          status: "ACTIVE",
          lastPingAt: { lt: expectedCutoff },
        },
        data: {
          status: "STALE",
          endedAt: expectedCutoff,
        },
      })
    })
  })

  describe("getStats", () => {
    it("aggregates active sessions by server and subscription", async () => {
      mockGroupBy
        .mockResolvedValueOnce([
          { serverId: "srv-1", _count: { id: 4 } },
          { serverId: "srv-2", _count: { id: 2 } },
        ] as unknown as never)
        .mockResolvedValueOnce([
          { subscriptionId: "sub-1", _count: { id: 6 } },
        ] as unknown as never)
      const stats = await service.getStats("org-1")

      expect(stats).toEqual({
        totalActive: 6,
        byServer: {
          "srv-1": 4,
          "srv-2": 2,
        },
        bySubscription: {
          "sub-1": 6,
        },
      })
    })
  })
})
