import { Elysia, t } from "elysia"

import {
  resolveAuthContext,
  type ResolvedAuth,
} from "@/lib/auth/resolve-proxy-auth"
import { whatsappUsageService } from "../usage.service"
import {
  toDailyCountDTO,
  toMonthlyCountDTO,
  type UsageOverviewDTO,
} from "../usage.dto"

type RouteSet = {
  status?: number | string
}

const toUnauthorized = (set: RouteSet) => {
  set.status = 401
  return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
}

function getCurrentPeriod(): string {
  const now = new Date()
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`
}

function resolveTargetOrgId(
  auth: ResolvedAuth,
  queryOrgId?: string
): string | undefined {
  if (auth.type === "workos" && auth.platformRole === "super_admin") {
    if (queryOrgId && queryOrgId !== "all") {
      return queryOrgId
    }
    return undefined
  }
  return auth.organizationId!
}

export const usageRoutes = new Elysia({ prefix: "/usage" })
  // GET /usage/overview — current month overview
  .get(
    "/overview",
    async ({ request, set, query }: { request: any; set: any; query: any }) => {
      const whatsappAuth = await resolveAuthContext(request)
      if (!whatsappAuth) return toUnauthorized(set)

      const targetOrgId = resolveTargetOrgId(
        whatsappAuth,
        query?.organizationId
      )
      const raw = await whatsappUsageService.getUsageOverview(targetOrgId)

      const overview: UsageOverviewDTO = {
        month: raw.month.map((r) => ({
          id: r.id,
          organizationId: r.organizationId,
          year: r.year,
          month: r.month,
          sessionCount: r.sessionCount,
          messageInboxCount: r.messageInboxCount,
          messageOutboxCount: r.messageOutboxCount,
          messageFailedCount: r.messageFailedCount,
          whatsappDeviceId: r.whatsappDeviceId,
        })),
        today: raw.today.map(toDailyCountDTO),
        cost: raw.cost,
        devices: raw.devices,
      }

      return { ok: true, ...overview }
    },
    {
      query: t.Object({
        organizationId: t.Optional(t.String()),
      }),
    }
  )
  // GET /usage/daily — daily counts with date range + device filter
  .get(
    "/daily",
    async ({ request, set, query }: { request: any; set: any; query: any }) => {
      const whatsappAuth = await resolveAuthContext(request)
      if (!whatsappAuth) return toUnauthorized(set)

      const { from, to, deviceId, organizationId } = query as {
        from?: string
        to?: string
        deviceId?: string
        organizationId?: string
      }

      const targetOrgId = resolveTargetOrgId(whatsappAuth, organizationId)
      const rows = await whatsappUsageService.getDailyCounts(targetOrgId, {
        from,
        to,
        deviceId,
      })

      return { ok: true, counts: rows.map(toDailyCountDTO) }
    },
    {
      query: t.Object({
        organizationId: t.Optional(t.String()),
        from: t.Optional(t.String()),
        to: t.Optional(t.String()),
        deviceId: t.Optional(t.String()),
      }),
    }
  )
  // GET /usage/monthly — monthly counts with year/month + device filter
  .get(
    "/monthly",
    async ({ request, set, query }: { request: any; set: any; query: any }) => {
      const whatsappAuth = await resolveAuthContext(request)
      if (!whatsappAuth) return toUnauthorized(set)

      const { year, month, deviceId, organizationId } = query as {
        year?: string
        month?: string
        deviceId?: string
        organizationId?: string
      }

      const targetOrgId = resolveTargetOrgId(whatsappAuth, organizationId)
      const rows = await whatsappUsageService.getMonthlyCounts(targetOrgId, {
        year: year ? Number(year) : undefined,
        month: month ? Number(month) : undefined,
        deviceId,
      })

      return { ok: true, counts: rows.map(toMonthlyCountDTO) }
    },
    {
      query: t.Object({
        organizationId: t.Optional(t.String()),
        year: t.Optional(t.String()),
        month: t.Optional(t.String()),
        deviceId: t.Optional(t.String()),
      }),
    }
  )
  // GET /usage/cost — cost breakdown with period filter
  .get(
    "/cost",
    async ({ request, set, query }: { request: any; set: any; query: any }) => {
      const whatsappAuth = await resolveAuthContext(request)
      if (!whatsappAuth) return toUnauthorized(set)

      const { period, organizationId } = query as {
        period?: string
        organizationId?: string
      }
      if (!period) {
        set.status = 422
        return {
          ok: false,
          error: "VALIDATION_ERROR",
          message: "period query param is required (e.g. 2026-06).",
        }
      }

      const targetOrgId = resolveTargetOrgId(whatsappAuth, organizationId)
      const cost = await whatsappUsageService.getCostSummary(
        targetOrgId,
        period
      )

      return { ok: true, ...cost }
    },
    {
      query: t.Object({
        organizationId: t.Optional(t.String()),
        period: t.Optional(t.String()),
      }),
    }
  )
  // GET /usage/cost-breakdown — per-device cost breakdown with forecast
  .get(
    "/cost-breakdown",
    async ({ request, set, query }: { request: any; set: any; query: any }) => {
      const whatsappAuth = await resolveAuthContext(request)
      if (!whatsappAuth) return toUnauthorized(set)

      const { period, deviceId, organizationId } = query as {
        period?: string
        deviceId?: string
        organizationId?: string
      }
      const targetPeriod = period ?? getCurrentPeriod()

      // Validate period format YYYY-MM
      if (period && !/^\d{4}-\d{2}$/.test(period)) {
        set.status = 422
        return {
          ok: false,
          error: "VALIDATION_ERROR",
          message: "period query param must use YYYY-MM.",
        }
      }

      const targetOrgId = resolveTargetOrgId(whatsappAuth, organizationId)
      const breakdown = await whatsappUsageService.getCostBreakdown(
        targetOrgId,
        targetPeriod,
        { deviceId }
      )

      return { ok: true, ...breakdown }
    },
    {
      query: t.Object({
        organizationId: t.Optional(t.String()),
        period: t.Optional(t.String()),
        deviceId: t.Optional(t.String()),
      }),
    }
  )
  // GET /usage/ledger — itemized quota & balance deduction ledger
  .get(
    "/ledger",
    async ({ request, set, query }: { request: any; set: any; query: any }) => {
      const whatsappAuth = await resolveAuthContext(request)
      if (!whatsappAuth) return toUnauthorized(set)

      const {
        deviceId,
        category,
        status,
        search,
        from,
        to,
        page,
        limit,
        organizationId,
      } = query as {
        deviceId?: string
        category?: string
        status?: string
        search?: string
        from?: string
        to?: string
        page?: string
        limit?: string
        organizationId?: string
      }

      const targetOrgId = resolveTargetOrgId(whatsappAuth, organizationId)
      const result = await whatsappUsageService.getLedgerEntries(targetOrgId, {
        deviceId,
        category,
        status,
        search,
        from,
        to,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      })

      return { ok: true, ...result }
    },
    {
      query: t.Object({
        organizationId: t.Optional(t.String()),
        deviceId: t.Optional(t.String()),
        category: t.Optional(t.String()),
        status: t.Optional(t.String()),
        search: t.Optional(t.String()),
        from: t.Optional(t.String()),
        to: t.Optional(t.String()),
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
      }),
    }
  )
