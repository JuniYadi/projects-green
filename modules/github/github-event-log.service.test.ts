import { describe, expect, it } from "bun:test"

import {
  cleanupGithubWebhookEvents,
  listGithubWebhookEvents,
  restoreGithubWebhookEvent,
} from "./github-event-log.service"

describe("github event log service", () => {
  it("lists active tracked/error events by default without payloadJson", async () => {
    const calls: unknown[] = []
    const prisma = {
      githubWebhookEvent: {
        findMany: async (args: unknown) => {
          calls.push(args)
          return []
        },
        count: async () => 0,
      },
    }

    const result = await listGithubWebhookEvents({ prisma, query: {} })

    expect(result).toEqual({ items: [], total: 0, page: 1, pageSize: 25 })
    expect(JSON.stringify(calls[0])).toContain("eventDisposition")
    expect(JSON.stringify(calls[0])).not.toContain("payloadJson")
  })

  it("restores soft-deleted events", async () => {
    const prisma = {
      githubWebhookEvent: {
        update: async (args: unknown) => args,
      },
    }

    const result = await restoreGithubWebhookEvent({ prisma, id: "event_1" })

    expect(result).toEqual({
      where: { id: "event_1" },
      data: {
        deletedAt: null,
        deleteReason: null,
        permanentDeleteAfter: null,
      },
    })
  })

  it("soft-deletes after 30 days and permanently deletes after 45 days", async () => {
    const updates: unknown[] = []
    const deletes: unknown[] = []
    const now = new Date("2026-06-09T00:00:00.000Z")
    const prisma = {
      githubWebhookEvent: {
        updateMany: async (args: unknown) => {
          updates.push(args)
          return { count: 2 }
        },
        deleteMany: async (args: unknown) => {
          deletes.push(args)
          return { count: 1 }
        },
      },
    }

    const result = await cleanupGithubWebhookEvents({ prisma, now })

    expect(result).toEqual({ softDeleted: 2, permanentlyDeleted: 1 })
    expect(JSON.stringify(updates[0])).toContain("retention_30_days")
    expect(JSON.stringify(updates[0])).toContain("2026-06-24T00:00:00.000Z")
    expect(JSON.stringify(deletes[0])).toContain("permanentDeleteAfter")
  })
})
