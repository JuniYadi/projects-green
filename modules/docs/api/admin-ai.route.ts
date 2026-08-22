import { Elysia, t } from "elysia"
import { prisma } from "@/lib/prisma"
import {
  requireSuperAdmin,
  type AdminApiError,
  type RouteSet,
} from "@/modules/admin/api/admin.guards"

export type AdminAiRouteDependencies = {
  requireSuperAdmin?: (
    set: RouteSet
  ) => Promise<{ ok: true; userId: string } | AdminApiError>
}

export const createAdminAiRoutes = (deps: AdminAiRouteDependencies = {}) => {
  const guard = deps.requireSuperAdmin || requireSuperAdmin

  return (
    new Elysia({ prefix: "/admin/ai" })
      // ─── 1. KPI & BURN RATE STATS ──────────────────────────────────────────
      .get("/stats", async ({ set }) => {
        const actor = await guard(set)
        if ("ok" in actor && !actor.ok) {
          return actor
        }

        const now = new Date()
        const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

        const [
          totalQueries24h,
          totalQueries30d,
          tokenAggregates,
          activeStrikesAgg,
          activeBansCount,
          recentFlaggedFeed,
        ] = await Promise.all([
          prisma.aiChatMessage.count({
            where: {
              role: "user",
              createdAt: { gte: dayAgo },
            },
          }),
          prisma.aiChatMessage.count({
            where: {
              role: "user",
              createdAt: { gte: monthAgo },
            },
          }),
          prisma.aiChatMessage.aggregate({
            where: {
              createdAt: { gte: monthAgo },
            },
            _sum: {
              promptTokens: true,
              responseTokens: true,
            },
          }),
          prisma.aiChatSession.aggregate({
            where: {
              strikeCount: { gt: 0 },
              updatedAt: { gte: dayAgo },
            },
            _sum: {
              strikeCount: true,
            },
          }),
          prisma.aiChatBan.count({
            where: {
              OR: [{ isPermanent: true }, { blockedUntil: { gt: now } }],
            },
          }),
          prisma.aiChatMessage.findMany({
            where: {
              flagReason: { not: null },
              createdAt: { gte: dayAgo },
            },
            orderBy: { createdAt: "desc" },
            take: 10,
            include: {
              session: true,
            },
          }),
        ])

        const promptTokens = tokenAggregates._sum.promptTokens || 0
        const responseTokens = tokenAggregates._sum.responseTokens || 0
        const totalTokens = promptTokens + responseTokens

        // Estimated token burn based on blended LLM costs ($2.5 / 1M prompt, $10 / 1M response)
        const estimatedCostUsd =
          (promptTokens * 2.5) / 1_000_000 + (responseTokens * 10.0) / 1_000_000
        const estimatedCostIdr = Math.round(estimatedCostUsd * 16000)

        return {
          ok: true,
          data: {
            totalQueries24h,
            totalQueries30d,
            tokens: {
              promptTokens,
              responseTokens,
              totalTokens,
              estimatedCostUsd: Number(estimatedCostUsd.toFixed(4)),
              estimatedCostIdr,
            },
            activeStrikes: activeStrikesAgg._sum.strikeCount || 0,
            activeBans: activeBansCount,
            recentFlaggedFeed: recentFlaggedFeed.map((item) => ({
              id: item.id,
              sessionId: item.sessionId,
              flagReason: item.flagReason,
              content: item.content,
              channel: item.session?.channel || "CONSOLE",
              userEmail: item.session?.userEmail || null,
              organizationId: item.session?.organizationId || null,
              ipAddress: item.session?.ipAddress || null,
              createdAt: item.createdAt.toISOString(),
            })),
          },
        }
      })

      // ─── 2. PAGINATED SESSIONS EXPLORER ────────────────────────────────────
      .get(
        "/sessions",
        async ({ query, set }) => {
          const actor = await guard(set)
          if ("ok" in actor && !actor.ok) {
            return actor
          }

          const page = Math.max(1, Number(query.page) || 1)
          const limit = Math.min(100, Math.max(1, Number(query.limit) || 20))
          const skip = (page - 1) * limit

          const whereClause: Record<string, unknown> = {}

          if (query.channel && query.channel !== "ALL") {
            whereClause.channel = query.channel
          }

          if (query.status === "FLAGGED") {
            whereClause.strikeCount = { gt: 0 }
          } else if (query.status === "CLEAN") {
            whereClause.strikeCount = 0
          }

          if (query.search) {
            const search = query.search.trim()
            whereClause.OR = [
              { sessionId: { contains: search, mode: "insensitive" } },
              { userEmail: { contains: search, mode: "insensitive" } },
              { organizationId: { contains: search, mode: "insensitive" } },
              { ipAddress: { contains: search, mode: "insensitive" } },
              { customerPhone: { contains: search, mode: "insensitive" } },
            ]
          }

          const [total, sessions] = await Promise.all([
            prisma.aiChatSession.count({ where: whereClause as never }),
            prisma.aiChatSession.findMany({
              where: whereClause as never,
              orderBy: { updatedAt: "desc" },
              skip,
              take: limit,
              include: {
                messages: {
                  select: {
                    id: true,
                    promptTokens: true,
                    responseTokens: true,
                    flagReason: true,
                  },
                },
              },
            }),
          ])

          return {
            ok: true,
            data: {
              sessions: sessions.map((s) => {
                const totalTokens = s.messages.reduce(
                  (sum, m) =>
                    sum + (m.promptTokens || 0) + (m.responseTokens || 0),
                  0
                )
                const hasFlagged = s.messages.some((m) => m.flagReason !== null)

                return {
                  id: s.id,
                  sessionId: s.sessionId,
                  organizationId: s.organizationId,
                  agentProfileId: s.agentProfileId,
                  channel: s.channel,
                  channelTargetId: s.channelTargetId,
                  userId: s.userId,
                  userEmail: s.userEmail,
                  customerPhone: s.customerPhone,
                  ipAddress: s.ipAddress,
                  strikeCount: s.strikeCount,
                  messageCount: s.messages.length,
                  totalTokens,
                  isFlagged: hasFlagged || s.strikeCount > 0,
                  createdAt: s.createdAt.toISOString(),
                  updatedAt: s.updatedAt.toISOString(),
                }
              }),
              pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
              },
            },
          }
        },
        {
          query: t.Object({
            page: t.Optional(t.String()),
            limit: t.Optional(t.String()),
            channel: t.Optional(t.String()),
            status: t.Optional(t.String()),
            search: t.Optional(t.String()),
          }),
        }
      )

      // ─── 3. FORENSIC TRANSCRIPT DEEP DIVE ──────────────────────────────────
      .get("/sessions/:sessionId", async ({ params, set }) => {
        const actor = await guard(set)
        if ("ok" in actor && !actor.ok) {
          return actor
        }

        const session = await prisma.aiChatSession.findFirst({
          where: {
            OR: [{ sessionId: params.sessionId }, { id: params.sessionId }],
          },
          include: {
            messages: {
              orderBy: { createdAt: "asc" },
            },
          },
        })

        if (!session) {
          set.status = 404
          return {
            ok: false,
            error: "NOT_FOUND",
            message: `AI Chat Session '${params.sessionId}' not found.`,
          }
        }

        const totalPromptTokens = session.messages.reduce(
          (sum, m) => sum + (m.promptTokens || 0),
          0
        )
        const totalResponseTokens = session.messages.reduce(
          (sum, m) => sum + (m.responseTokens || 0),
          0
        )
        const totalTokens = totalPromptTokens + totalResponseTokens
        const totalDurationMs = session.messages.reduce(
          (sum, m) => sum + (m.durationMs || 0),
          0
        )

        return {
          ok: true,
          data: {
            session: {
              id: session.id,
              sessionId: session.sessionId,
              organizationId: session.organizationId,
              agentProfileId: session.agentProfileId,
              channel: session.channel,
              channelTargetId: session.channelTargetId,
              userId: session.userId,
              userEmail: session.userEmail,
              customerPhone: session.customerPhone,
              ipAddress: session.ipAddress,
              userAgent: session.userAgent,
              strikeCount: session.strikeCount,
              createdAt: session.createdAt.toISOString(),
              updatedAt: session.updatedAt.toISOString(),
              metrics: {
                totalPromptTokens,
                totalResponseTokens,
                totalTokens,
                totalDurationMs,
              },
            },
            messages: session.messages.map((m) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              promptTokens: m.promptTokens,
              responseTokens: m.responseTokens,
              totalTokens: (m.promptTokens || 0) + (m.responseTokens || 0),
              durationMs: m.durationMs,
              modelUsed: m.modelName,
              citations:
                (m.citations as Array<{
                  title?: string
                  docPath?: string
                  similarityScore?: number
                }>) || [],
              flagReason: m.flagReason,
              createdAt: m.createdAt.toISOString(),
            })),
          },
        }
      })

      // ─── 4. ACTIVE BANS MATRIX ─────────────────────────────────────────────
      .get("/bans", async ({ set }) => {
        const actor = await guard(set)
        if ("ok" in actor && !actor.ok) {
          return actor
        }

        const now = new Date()

        const bans = await prisma.aiChatBan.findMany({
          where: {
            OR: [{ isPermanent: true }, { blockedUntil: { gt: now } }],
          },
          orderBy: { createdAt: "desc" },
        })

        return {
          ok: true,
          data: {
            bans: bans.map((b) => {
              let timeRemaining = "Permanent"
              if (!b.isPermanent && b.blockedUntil) {
                const diffMs = b.blockedUntil.getTime() - now.getTime()
                if (diffMs <= 0) {
                  timeRemaining = "Expired"
                } else {
                  const hours = Math.floor(diffMs / (1000 * 60 * 60))
                  const minutes = Math.floor(
                    (diffMs % (1000 * 60 * 60)) / (1000 * 60)
                  )
                  timeRemaining =
                    hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
                }
              }

              return {
                id: b.id,
                banType: b.banType,
                targetValue: b.targetValue,
                organizationId: b.organizationId,
                offenseLevel: b.offenseLevel,
                strikeSnapshot: b.strikeSnapshot,
                reason: b.reason,
                isPermanent: b.isPermanent,
                blockedUntil: b.blockedUntil?.toISOString() || null,
                timeRemaining,
                createdAt: b.createdAt.toISOString(),
              }
            }),
          },
        }
      })

      // ─── 5. 1-CLICK PARDON ACTION ──────────────────────────────────────────
      .post(
        "/bans/pardon",
        async ({ body, set }) => {
          const actor = await guard(set)
          if ("ok" in actor && !actor.ok) {
            return actor
          }

          const { banId, reason } = body

          const existingBan = await prisma.aiChatBan.findUnique({
            where: { id: banId },
          })

          if (!existingBan) {
            set.status = 404
            return {
              ok: false,
              error: "NOT_FOUND",
              message: `Ban with id '${banId}' not found.`,
            }
          }

          const now = new Date()

          const updated = await prisma.aiChatBan.update({
            where: { id: banId },
            data: {
              blockedUntil: now,
              isPermanent: false,
              pardonedAt: now,
              pardonedBy: actor.userId,
              reason: reason
                ? `${existingBan.reason} (Pardoned by admin: ${reason})`
                : existingBan.reason,
            },
          })

          return {
            ok: true,
            data: {
              id: updated.id,
              targetValue: updated.targetValue,
              pardonedAt: updated.pardonedAt?.toISOString(),
            },
          }
        },
        {
          body: t.Object({
            banId: t.String(),
            reason: t.Optional(t.String()),
          }),
        }
      )

      // ─── 6. MANUAL BAN CREATION ───────────────────────────────────────────
      .post(
        "/bans/create",
        async ({ body, set }) => {
          const actor = await guard(set)
          if ("ok" in actor && !actor.ok) {
            return actor
          }

          const {
            banType,
            targetValue,
            organizationId,
            durationHours,
            isPermanent,
            reason,
          } = body

          const now = new Date()
          let blockedUntil: Date | null = null

          if (!isPermanent && durationHours && durationHours > 0) {
            blockedUntil = new Date(
              now.getTime() + durationHours * 60 * 60 * 1000
            )
          }

          const createdBan = await prisma.aiChatBan.create({
            data: {
              banType,
              targetValue,
              organizationId: organizationId || null,
              offenseLevel: isPermanent ? 5 : 1,
              strikeSnapshot: 1,
              reason: reason || "Manual super admin ban",
              isPermanent: Boolean(isPermanent),
              blockedUntil,
            },
          })

          return {
            ok: true,
            data: {
              id: createdBan.id,
              banType: createdBan.banType,
              targetValue: createdBan.targetValue,
              isPermanent: createdBan.isPermanent,
              blockedUntil: createdBan.blockedUntil?.toISOString() || null,
              createdAt: createdBan.createdAt.toISOString(),
            },
          }
        },
        {
          body: t.Object({
            banType: t.Union([
              t.Literal("IP"),
              t.Literal("USER"),
              t.Literal("ORGANIZATION"),
              t.Literal("PHONE"),
            ]),
            targetValue: t.String({ minLength: 1 }),
            organizationId: t.Optional(t.String()),
            durationHours: t.Optional(t.Number()),
            isPermanent: t.Optional(t.Boolean()),
            reason: t.Optional(t.String()),
          }),
        }
      )
  )
}

export const adminAiRoutes = createAdminAiRoutes()
