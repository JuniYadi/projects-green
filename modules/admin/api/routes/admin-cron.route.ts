import { Elysia, t } from "elysia"
import { CronAdminService } from "../services/cron-admin.service"

export const createAdminCronRoutes = () => {
  const service = new CronAdminService()

  return new Elysia({ prefix: "/admin/cronjobs" })
    .get(
      "/",
      async () => {
        return await service.listJobs()
      },
      {
        detail: {
          summary: "List all cron job definitions with system health metrics",
          tags: ["Admin - CronJobs"],
        },
      }
    )
    .get(
      "/executions",
      async ({ query }) => {
        return await service.listExecutions({
          jobCode: query.jobCode,
          status: query.status,
          page: query.page ? Number(query.page) : 1,
          limit: query.limit ? Number(query.limit) : 20,
        })
      },
      {
        query: t.Object({
          jobCode: t.Optional(t.String()),
          status: t.Optional(t.String()),
          page: t.Optional(t.String()),
          limit: t.Optional(t.String()),
        }),
        detail: {
          summary: "List execution history and logs across all jobs",
          tags: ["Admin - CronJobs"],
        },
      }
    )
    .get(
      "/executions/:id",
      async ({ params, set }) => {
        const execution = await service.getExecution(params.id)
        if (!execution) {
          set.status = 404
          return { error: "Execution record not found" }
        }
        return execution
      },
      {
        params: t.Object({
          id: t.String(),
        }),
        detail: {
          summary: "Get specific execution detail and logs",
          tags: ["Admin - CronJobs"],
        },
      }
    )
    .post(
      "/:code/trigger",
      async ({ params, body }) => {
        return await service.triggerJob({
          code: params.code,
          reason: body.reason,
          triggeredBy: body.triggeredBy,
        })
      },
      {
        params: t.Object({
          code: t.String(),
        }),
        body: t.Object({
          reason: t.Optional(t.String()),
          triggeredBy: t.Optional(t.String()),
        }),
        detail: {
          summary: "Trigger manual execution of a cronjob",
          tags: ["Admin - CronJobs"],
        },
      }
    )
}
