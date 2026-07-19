import { Elysia } from "elysia"
import { prisma } from "@/lib/prisma"
import { resolveAuthContext } from "@/lib/auth/resolve-proxy-auth"
import { analyticsService } from "../analytics.service"
import {
  syncQuerySchema,
  reportQuerySchema,
  costReconciliationQuerySchema,
} from "../analytics.schemas"

export const analyticsRoutes = new Elysia({ prefix: "/analytics" })
  .post(
    "/sync",
    async ({ request, body, set }: { request: any; body: any; set: any }) => {
      const auth = await resolveAuthContext(request)
      if (!auth) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
      }

      const parsed = syncQuerySchema.safeParse(body)
      if (!parsed.success) {
        set.status = 422
        return {
          ok: false,
          error: "VALIDATION_ERROR",
          message: "Invalid request body.",
          fieldErrors: parsed.error.flatten().fieldErrors,
        }
      }

      try {
        const result = await analyticsService.syncAnalytics({
          deviceId: parsed.data.deviceId,
          organizationId: auth.organizationId!,
          startDate: parsed.data.startDate,
          endDate: parsed.data.endDate,
          granularity: parsed.data.granularity,
        })
        return { ok: true, ...result }
      } catch (err: any) {
        set.status = 400
        return { ok: false, error: "SYNC_FAILED", message: err.message }
      }
    }
  )
  .get(
    "/report",
    async ({ request, query, set }: { request: any; query: any; set: any }) => {
      const auth = await resolveAuthContext(request)
      if (!auth) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
      }

      const parsed = reportQuerySchema.safeParse(query)
      if (!parsed.success) {
        set.status = 422
        return {
          ok: false,
          error: "VALIDATION_ERROR",
          message: "Invalid query params.",
          fieldErrors: parsed.error.flatten().fieldErrors,
        }
      }

      try {
        const report = await analyticsService.getComparisonReport(
          auth.organizationId!,
          parsed.data.deviceId,
          parsed.data.startDate,
          parsed.data.endDate
        )
        return { ok: true, ...report }
      } catch (err: any) {
        set.status = 400
        return { ok: false, error: "REPORT_FAILED", message: err.message }
      }
    }
  )
  .get(
    "/cost-reconciliation",
    async ({ request, query, set }: { request: any; query: any; set: any }) => {
      const auth = await resolveAuthContext(request)
      if (!auth) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
      }

      const parsed = costReconciliationQuerySchema.safeParse(query)
      if (!parsed.success) {
        set.status = 422
        return {
          ok: false,
          error: "VALIDATION_ERROR",
          message: "Invalid query params.",
          fieldErrors: parsed.error.flatten().fieldErrors,
        }
      }

      try {
        const result = await analyticsService.getCostReconciliation(
          auth.organizationId!,
          parsed.data
        )
        return { ok: true, ...result }
      } catch (err: any) {
        set.status = 400
        return {
          ok: false,
          error: "RECONCILIATION_FAILED",
          message: err.message,
        }
      }
    }
  )
