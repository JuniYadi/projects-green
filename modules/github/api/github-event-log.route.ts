import { Elysia } from "elysia"
import { z } from "zod"

import { prisma } from "@/lib/prisma"
import {
  requireSuperAdmin,
  type AdminApiError,
} from "@/modules/admin/api/admin.guards"
import {
  getGithubWebhookEventDetail,
  listGithubWebhookEvents,
  restoreGithubWebhookEvent,
  type GithubEventLogQuery,
} from "@/modules/github/github-event-log.service"
import {
  toEventRowDTO,
  toEventDetailDTO,
  type GithubEventListDTO,
} from "./github-event-log.dto"

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().trim().optional(),
  eventName: z.string().trim().optional(),
  processStatus: z.string().trim().optional(),
  eventDisposition: z.string().trim().optional(),
  repositoryFullName: z.string().trim().optional(),
  branch: z.string().trim().optional(),
  from: z.string().trim().optional(),
  until: z.string().trim().optional(),
  deletedState: z.enum(["active", "deleted", "include_deleted"]).optional(),
  sort: z
    .enum([
      "receivedAt",
      "eventName",
      "repositoryFullName",
      "branch",
      "processStatus",
      "eventDisposition",
    ])
    .optional(),
  order: z.enum(["asc", "desc"]).optional(),
})

export type GithubEventLogRouteDeps = {
  requireSuperAdmin?: typeof requireSuperAdmin
  listGithubWebhookEvents?: typeof listGithubWebhookEvents
  getGithubWebhookEventDetail?: typeof getGithubWebhookEventDetail
  restoreGithubWebhookEvent?: typeof restoreGithubWebhookEvent
}

export const createGithubEventLogRoutes = (
  deps: GithubEventLogRouteDeps = {}
) => {
  const guard = deps.requireSuperAdmin ?? requireSuperAdmin
  const listEvents = deps.listGithubWebhookEvents ?? listGithubWebhookEvents
  const getEvent =
    deps.getGithubWebhookEventDetail ?? getGithubWebhookEventDetail
  const restoreEvent =
    deps.restoreGithubWebhookEvent ?? restoreGithubWebhookEvent

  return new Elysia()
    .get(
      "/admin/app/events/github",
      async ({ query, set }) => {
        const actor = await guard(set)
        if ("ok" in actor && !actor.ok) return actor as AdminApiError

        const result = await listEvents({
          prisma,
          query: query as GithubEventLogQuery,
        })
        const dto: GithubEventListDTO = {
          items: result.items.map(toEventRowDTO),
          total: result.total,
          page: result.page,
          pageSize: result.pageSize,
        }
        return { ok: true as const, data: dto }
      },
      { query: listQuerySchema }
    )
    .get("/admin/app/events/github/:id", async ({ params, set }) => {
      const actor = await guard(set)
      if ("ok" in actor && !actor.ok) return actor as AdminApiError

      const event = await getEvent({ prisma, id: params.id })
      if (!event) {
        set.status = 404
        return {
          ok: false as const,
          error: "NOT_FOUND" as const,
          message: "GitHub event not found.",
        }
      }

      return { ok: true as const, data: toEventDetailDTO(event) }
    })
    .post("/admin/app/events/github/:id/restore", async ({ params, set }) => {
      const actor = await guard(set)
      if ("ok" in actor && !actor.ok) return actor as AdminApiError

      const existing = await getEvent({ prisma, id: params.id })
      if (!existing) {
        set.status = 404
        return {
          ok: false as const,
          error: "NOT_FOUND" as const,
          message: "GitHub event not found.",
        }
      }

      const event = await restoreEvent({ prisma, id: params.id })
      return { ok: true as const, data: toEventDetailDTO(event) }
    })
}

export const githubEventLogRoutes = createGithubEventLogRoutes()
