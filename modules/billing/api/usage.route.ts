import { Elysia } from "elysia"
import { UsageLedgerService } from "../usage-ledger.service"
import { CostingService } from "../costing.service"

export function createUsageRoutes(services: {
  usageLedgerService: UsageLedgerService
  costingService: CostingService
}) {
  return new Elysia({ prefix: "/usage" })
    .get("/", async ({ query, set }) => {
      const { from, to } = query as { from?: string; to?: string }

      const now = new Date()
      const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

      if (from && to) {
        const entries = await services.usageLedgerService.getUsageByDateRange(
          "org-1",
          from,
          to,
        )

        return {
          success: true,
          data: {
            entries,
            from,
            to,
          },
        }
      }

      const breakdown = await services.usageLedgerService.getSpendByCategory(
        "org-1",
        currentPeriod,
      )

      const totalSpend = await services.usageLedgerService.getTotalSpend(
        "org-1",
        currentPeriod,
      )

      return {
        success: true,
        data: {
          period: currentPeriod,
          breakdown,
          totalSpend,
        },
      }
    })
    .get("/breakdown", async ({ set }) => {
      const now = new Date()
      const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

      const breakdown = await services.costingService.getUsageBreakdown(
        "org-1",
        currentPeriod,
      )

      return {
        success: true,
        data: {
          period: currentPeriod,
          breakdown,
        },
      }
    })
    .get("/trend", async ({ query, set }) => {
      const { days } = query as { days?: string }
      const daysNum = days ? parseInt(days, 10) : 30

      const trend = await services.usageLedgerService.getDailyUsageTrend(
        "org-1",
        daysNum,
      )

      return {
        success: true,
        data: {
          days: daysNum,
          trend,
        },
      }
    })
}
