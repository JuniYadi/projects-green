import type { Prisma, PrismaClient } from "@prisma/client"

import { prisma as defaultPrisma } from "@/lib/prisma"

type PrismaLike = PrismaClient

export type CreateSessionInput = {
  deviceId: string
  subscriptionId: string
  serverAccountId: string
  serverId: string
}

export type ListSessionFilter = {
  status?: string
  serverId?: string
  subscriptionId?: string
  deviceId?: string
  cursor?: string
  limit?: number
}

export class VpnMobileSessionService {
  private readonly prisma: PrismaLike
  private readonly now: () => Date

  constructor(
    prisma: PrismaLike = defaultPrisma,
    options: { now?: () => Date } = {}
  ) {
    this.prisma = prisma
    this.now = options.now ?? (() => new Date())
  }

  async create(input: CreateSessionInput) {
    return this.prisma.vpnMobileSession.create({
      data: {
        deviceId: input.deviceId,
        subscriptionId: input.subscriptionId,
        serverAccountId: input.serverAccountId,
        serverId: input.serverId,
        lastPingAt: this.now(),
      },
    })
  }

  async findById(id: string) {
    return this.prisma.vpnMobileSession.findUnique({ where: { id } })
  }

  /**
   * Ping: bump lastPingAt. Returns null if not found.
   */
  async ping(id: string) {
    const now = this.now()
    try {
      return await this.prisma.vpnMobileSession.update({
        where: { id },
        data: { lastPingAt: now },
      })
    } catch {
      return null
    }
  }

  /**
   * Close session with optional traffic data.
   *
   * Idempotent: if already CLOSED, accumulates txBytes/rxBytes (deltas)
   * but keeps endedAt unchanged.
   */
  async close(
    id: string,
    traffic?: { txBytes?: number; rxBytes?: number }
  ) {
    const existing = await this.prisma.vpnMobileSession.findUnique({
      where: { id },
      select: { status: true, txBytes: true, rxBytes: true },
    })
    if (!existing) return null

    const now = this.now()
    const isClosed = existing.status === "CLOSED"

    return this.prisma.vpnMobileSession.update({
      where: { id },
      data: {
        status: isClosed ? undefined : "CLOSED",
        endedAt: isClosed ? undefined : now,
        txBytes: traffic?.txBytes
          ? { increment: BigInt(traffic.txBytes) }
          : undefined,
        rxBytes: traffic?.rxBytes
          ? { increment: BigInt(traffic.rxBytes) }
          : undefined,
      },
    })
  }

  /**
   * List sessions with cursor pagination (startedAt DESC).
   *
   * Default limit 20, max 100. Includes device name + server info.
   * Filters are AND-combined.
   */
  async list(filter: ListSessionFilter = {}) {
    const limit = Math.min(filter.limit ?? 20, 100)
    const where: Prisma.VpnMobileSessionWhereInput = {}

    if (filter.status) where.status = filter.status as never
    if (filter.serverId) where.serverId = filter.serverId
    if (filter.subscriptionId) where.subscriptionId = filter.subscriptionId
    if (filter.deviceId) where.deviceId = filter.deviceId

    // Get total count (no cursor for total)
    const total = await this.prisma.vpnMobileSession.count({ where })

    // Cursor: fetch limit+1 to detect if there's a next page
    const take = limit + 1
    const cursor = filter.cursor
      ? { id: filter.cursor, startedAt: new Date(filter.cursor) }
      : undefined

    const rows = await this.prisma.vpnMobileSession.findMany({
      where,
      take,
      ...(cursor ? { cursor: { id: filter.cursor! }, skip: 1 } : {}),
      orderBy: { startedAt: "desc" },
      include: {
        device: { select: { deviceName: true } },
        server: { select: { name: true, region: { select: { name: true } } } },
        serverAccount: { select: { protocol: true } },
      },
    })

    const hasMore = rows.length > limit
    const sessions = hasMore ? rows.slice(0, limit) : rows
    const nextCursor = hasMore ? sessions[sessions.length - 1].id : null

    return { sessions, nextCursor, total }
  }

  /**
   * Mark ACTIVE sessions with lastPingAt older than thresholdMinutes as STALE.
   * Returns count of updated rows.
   */
  async cleanStale(thresholdMinutes = 15) {
    const cutoff = new Date(this.now().getTime() - thresholdMinutes * 60_000)
    const result = await this.prisma.vpnMobileSession.updateMany({
      where: {
        status: "ACTIVE",
        lastPingAt: { lt: cutoff },
      },
      data: {
        status: "STALE",
        endedAt: cutoff,
      },
    })
    return result.count
  }

  /**
   * Aggregate active sessions by server and subscription.
   */
  async getStats() {
    // ponytail: two GROUP BY queries, no N+1. Add caching when dashboard sees load.
    const byServer = await this.prisma.vpnMobileSession.groupBy({
      by: ["serverId"],
      where: { status: "ACTIVE" },
      _count: { id: true },
    })

    const bySubscription = await this.prisma.vpnMobileSession.groupBy({
      by: ["subscriptionId"],
      where: { status: "ACTIVE" },
      _count: { id: true },
    })

    const totalActive = byServer.reduce((sum, g) => sum + g._count.id, 0)

    return {
      totalActive,
      byServer: Object.fromEntries(
        byServer.map((g) => [g.serverId, g._count.id])
      ),
      bySubscription: Object.fromEntries(
        bySubscription.map((g) => [g.subscriptionId, g._count.id])
      ),
    }
  }
}

export const vpnMobileSessionService = new VpnMobileSessionService()
