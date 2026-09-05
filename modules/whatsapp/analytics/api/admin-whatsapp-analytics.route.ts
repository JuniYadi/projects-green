import { Elysia, t } from "elysia"
import { requireSuperAdmin } from "@/modules/admin/api/admin.guards"
import { AdminWhatsappAnalyticsService } from "../admin-whatsapp-analytics.service"

export const adminWhatsappAnalyticsRoutes = new Elysia({
  prefix: "/admin/whatsapp/analytics",
})
  .get(
    "/summary",
    async ({ set, query }) => {
      const auth = await requireSuperAdmin(set)
      if ("ok" in auth && !auth.ok) return auth

      const service = new AdminWhatsappAnalyticsService()
      const summary = await service.getFinancialSummary({
        days: query.days ? Number(query.days) : undefined,
        startDate: query.startDate,
        endDate: query.endDate,
        organizationId: query.organizationId,
      })

      return {
        ok: true,
        data: summary,
      }
    },
    {
      query: t.Object({
        days: t.Optional(t.Union([t.String(), t.Number()])),
        startDate: t.Optional(t.String()),
        endDate: t.Optional(t.String()),
        organizationId: t.Optional(t.String()),
      }),
    }
  )
  .get(
    "/trends",
    async ({ set, query }) => {
      const auth = await requireSuperAdmin(set)
      if ("ok" in auth && !auth.ok) return auth

      const service = new AdminWhatsappAnalyticsService()
      const trends = await service.getTimeseriesTrends({
        days: query.days ? Number(query.days) : undefined,
        startDate: query.startDate,
        endDate: query.endDate,
        organizationId: query.organizationId,
      })

      return {
        ok: true,
        data: trends,
      }
    },
    {
      query: t.Object({
        days: t.Optional(t.Union([t.String(), t.Number()])),
        startDate: t.Optional(t.String()),
        endDate: t.Optional(t.String()),
        organizationId: t.Optional(t.String()),
      }),
    }
  )
  .get(
    "/monthly-trends",
    async ({ set, query }) => {
      const auth = await requireSuperAdmin(set)
      if ("ok" in auth && !auth.ok) return auth

      const service = new AdminWhatsappAnalyticsService()
      const trends = await service.getMonthlyTrends({
        months: query.months ? Number(query.months) : undefined,
        organizationId: query.organizationId,
      })

      return {
        ok: true,
        data: trends,
      }
    },
    {
      query: t.Object({
        months: t.Optional(t.Union([t.String(), t.Number()])),
        organizationId: t.Optional(t.String()),
      }),
    }
  )
  .get(
    "/organizations",
    async ({ set, query }) => {
      const auth = await requireSuperAdmin(set)
      if ("ok" in auth && !auth.ok) return auth

      const service = new AdminWhatsappAnalyticsService()
      const organizations = await service.getOrganizationProfitability({
        days: query.days ? Number(query.days) : undefined,
        startDate: query.startDate,
        endDate: query.endDate,
      })

      return {
        ok: true,
        data: organizations,
      }
    },
    {
      query: t.Object({
        days: t.Optional(t.Union([t.String(), t.Number()])),
        startDate: t.Optional(t.String()),
        endDate: t.Optional(t.String()),
      }),
    }
  )
  .get(
    "/organizations/:organizationId",
    async ({ set, params, query }) => {
      const auth = await requireSuperAdmin(set)
      if ("ok" in auth && !auth.ok) return auth

      const service = new AdminWhatsappAnalyticsService()
      const [summary, devices] = await Promise.all([
        service.getFinancialSummary({
          days: query.days ? Number(query.days) : undefined,
          startDate: query.startDate,
          endDate: query.endDate,
          organizationId: params.organizationId,
        }),
        service.getOrganizationDeviceBreakdown(params.organizationId, {
          days: query.days ? Number(query.days) : undefined,
          startDate: query.startDate,
          endDate: query.endDate,
        }),
      ])

      return {
        ok: true,
        data: {
          summary,
          devices,
        },
      }
    },
    {
      params: t.Object({
        organizationId: t.String(),
      }),
      query: t.Object({
        days: t.Optional(t.Union([t.String(), t.Number()])),
        startDate: t.Optional(t.String()),
        endDate: t.Optional(t.String()),
      }),
    }
  )
  .post(
    "/sync",
    async ({ set, body }) => {
      const auth = await requireSuperAdmin(set)
      if ("ok" in auth && !auth.ok) return auth

      const service = new AdminWhatsappAnalyticsService()
      const result = await service.syncMetaPricingAnalytics({
        days: body?.days,
        startDate: body?.startDate,
        endDate: body?.endDate,
        deviceId: body?.deviceId,
      })

      return {
        ok: true,
        data: {
          syncedCount: result.syncedCount,
          totalBaseCostIdr: result.totalBaseCostIdr.toFixed(2),
          totalVatCostIdr: result.totalVatCostIdr.toFixed(2),
          totalCostIdr: result.totalCostIdr.toFixed(2),
          recordsCount: result.records.length,
        },
      }
    },
    {
      body: t.Optional(
        t.Object({
          days: t.Optional(t.Number()),
          startDate: t.Optional(t.String()),
          endDate: t.Optional(t.String()),
          deviceId: t.Optional(t.String()),
        })
      ),
    }
  )
