import { Elysia } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"

import { UsageLedgerService } from "../usage-ledger.service"
import { CostingService } from "../costing.service"

type UsageAuthContext = {
  organizationId?: string | null
  user: { id: string; email?: string | null } | null
}

type RouteSet = {
  status?: number | string
}

function toUnauthorized(set: RouteSet) {
  set.status = 401
  return {
    success: false as const,
    error: "UNAUTHORIZED" as const,
    message: "You must be signed in to access usage data.",
  }
}

function toForbidden(set: RouteSet, message: string) {
  set.status = 403
  return {
    success: false as const,
    error: "FORBIDDEN" as const,
    message,
  }
}

function toValidationError(set: RouteSet, message: string) {
  set.status = 422
  return {
    success: false as const,
    error: "VALIDATION_ERROR" as const,
    message,
  }
}

function isValidDate(dateStr: string): boolean {
  const date = new Date(dateStr)
  return !isNaN(date.getTime())
}

export function createUsageRoutes(services: {
  usageLedgerService: UsageLedgerService
  costingService: CostingService
  authenticate?: () => Promise<UsageAuthContext>
}) {
  const authenticate = services.authenticate ?? (() => withAuth())

  return new Elysia({ prefix: "/usage" })
    .get("/", async ({ query, set }) => {
      const auth = await authenticate()

      if (!auth.user) {
        return toUnauthorized(set)
      }

      if (!auth.organizationId) {
        return toForbidden(set, "No active organization found.")
      }

      const { from, to } = query as { from?: string; to?: string }

      const now = new Date()
      const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

      if (from && to) {
        if (!isValidDate(from) || !isValidDate(to)) {
          return toValidationError(set, "Invalid date format. Use YYYY-MM-DD.")
        }

        if (new Date(from) > new Date(to)) {
          return toValidationError(set, "'from' date must be before 'to' date.")
        }

        const entries = await services.usageLedgerService.getUsageByDateRange(
          auth.organizationId,
          from,
          to
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
        auth.organizationId,
        currentPeriod
      )

      const totalSpend = await services.usageLedgerService.getTotalSpend(
        auth.organizationId,
        currentPeriod
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
      const auth = await authenticate()

      if (!auth.user) {
        return toUnauthorized(set)
      }

      if (!auth.organizationId) {
        return toForbidden(set, "No active organization found.")
      }

      const now = new Date()
      const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

      const breakdown = await services.costingService.getUsageBreakdown(
        auth.organizationId,
        currentPeriod
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
      const auth = await authenticate()

      if (!auth.user) {
        return toUnauthorized(set)
      }

      if (!auth.organizationId) {
        return toForbidden(set, "No active organization found.")
      }

      const { days } = query as { days?: string }
      const daysNum = days ? parseInt(days, 10) : 30

      if (isNaN(daysNum) || daysNum < 1 || daysNum > 365) {
        return toValidationError(
          set,
          "Invalid 'days' parameter. Must be between 1 and 365."
        )
      }

      const trend = await services.usageLedgerService.getDailyUsageTrend(
        auth.organizationId,
        daysNum
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
