import { Elysia } from "elysia"

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

export const usageRoutes = new Elysia({ prefix: "/usage" })
  // GET /usage/overview — current month overview
  .get("/overview", async ({ request, set }: { request: any; set: any }) => {
    const whatsappAuth = await resolveAuthContext(request)
    if (!whatsappAuth) return toUnauthorized(set)

    const raw = await whatsappUsageService.getUsageOverview(
      whatsappAuth.organizationId!
    )

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
  })
  // GET /usage/daily — daily counts with date range + device filter
  .get(
    "/daily",
    async ({ request, set, query }: { request: any; set: any; query: any }) => {
      const whatsappAuth = await resolveAuthContext(request)
      if (!whatsappAuth) return toUnauthorized(set)

      const { from, to, deviceId } = query as {
        from?: string
        to?: string
        deviceId?: string
      }

      const rows = await whatsappUsageService.getDailyCounts(
        whatsappAuth.organizationId!,
        { from, to, deviceId }
      )

      return { ok: true, counts: rows.map(toDailyCountDTO) }
    }
  )
  // GET /usage/monthly — monthly counts with year/month + device filter
  .get(
    "/monthly",
    async ({ request, set, query }: { request: any; set: any; query: any }) => {
      const whatsappAuth = await resolveAuthContext(request)
      if (!whatsappAuth) return toUnauthorized(set)

      const { year, month, deviceId } = query as {
        year?: string
        month?: string
        deviceId?: string
      }

      const rows = await whatsappUsageService.getMonthlyCounts(
        whatsappAuth.organizationId!,
        {
          year: year ? Number(year) : undefined,
          month: month ? Number(month) : undefined,
          deviceId,
        }
      )

      return { ok: true, counts: rows.map(toMonthlyCountDTO) }
    }
  )
  // GET /usage/cost — cost breakdown with period filter
  .get(
    "/cost",
    async ({ request, set, query }: { request: any; set: any; query: any }) => {
      const whatsappAuth = await resolveAuthContext(request)
      if (!whatsappAuth) return toUnauthorized(set)

      const { period } = query as { period?: string }
      if (!period) {
        set.status = 422
        return {
          ok: false,
          error: "VALIDATION_ERROR",
          message: "period query param is required (e.g. 2026-06).",
        }
      }

      const cost = await whatsappUsageService.getCostSummary(
        whatsappAuth.organizationId!,
        period
      )

      return { ok: true, ...cost }
    }
  )
  // GET /usage/cost-breakdown — per-device cost breakdown with forecast
  .get(
    "/cost-breakdown",
    async ({ request, set, query }: { request: any; set: any; query: any }) => {
      const whatsappAuth = await resolveAuthContext(request)
      if (!whatsappAuth) return toUnauthorized(set)

      const { period, deviceId } = query as { period?: string; deviceId?: string }
      const targetPeriod = period ?? getCurrentPeriod()

      const breakdown = await whatsappUsageService.getCostBreakdown(
        whatsappAuth.organizationId!,
        targetPeriod,
        { deviceId }
      )

      return { ok: true, ...breakdown }
    }
  )
