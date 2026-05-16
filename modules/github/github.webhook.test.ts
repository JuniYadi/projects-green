import { describe, expect, it, mock } from "bun:test"

import {
  evaluatePushRules,
  extractBranchFromRef,
  processGithubWebhookEvent,
} from "@/modules/github/github.webhook"

type MutableWebhookEvent = {
  id: string
  deliveryId: string
  eventName: string
  action: string | null
  githubInstallationId: bigint | null
  githubRepositoryId: bigint | null
  payloadJson: unknown
  payloadSha256: string
  enqueueStatus: string
  processStatus: string
  processError?: string | null
  processedAt?: Date | null
}

const createWebhookPrismaHarness = ({
  event,
  connection,
}: {
  event: MutableWebhookEvent
  connection: {
    id: string
    enabled: boolean
    branchFilters: string[]
    githubRepositoryId: bigint
    githubInstallationId: bigint
  } | null
}) => {
  const events = new Map<string, MutableWebhookEvent>([[event.id, event]])
  const deliveries = new Map<string, MutableWebhookEvent>([
    [event.deliveryId, event],
  ])

  const prismaClient = {
    githubWebhookEvent: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const created: MutableWebhookEvent = {
          id: data.id as string,
          deliveryId: data.deliveryId as string,
          eventName: data.eventName as string,
          action: (data.action as string | null) ?? null,
          githubInstallationId: (data.githubInstallationId as bigint | null) ?? null,
          githubRepositoryId: (data.githubRepositoryId as bigint | null) ?? null,
          payloadJson: data.payloadJson,
          payloadSha256: data.payloadSha256 as string,
          enqueueStatus: (data.enqueueStatus as string) ?? "queued",
          processStatus: (data.processStatus as string) ?? "pending",
        }

        events.set(created.id, created)
        deliveries.set(created.deliveryId, created)

        return created
      },
      findUnique: async ({
        where,
      }: {
        where: {
          id?: string
          deliveryId?: string
        }
      }) => {
        if (where.id) {
          return events.get(where.id) ?? null
        }

        if (where.deliveryId) {
          return deliveries.get(where.deliveryId) ?? null
        }

        return null
      },
      update: async ({
        where,
        data,
      }: {
        where: {
          id: string
        }
        data: Record<string, unknown>
      }) => {
        const existing = events.get(where.id)

        if (!existing) {
          throw new Error(`Event ${where.id} not found`)
        }

        Object.assign(existing, data)
        return existing
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: Record<string, unknown>
        data: Record<string, unknown>
      }) => {
        const id = where.id as string
        const existing = events.get(id)

        if (!existing) {
          return { count: 0 }
        }

        const processStatus = where.processStatus as {
          in?: string[]
        }

        const allowed = processStatus?.in ?? []

        if (allowed.length > 0 && !allowed.includes(existing.processStatus)) {
          return {
            count: 0,
          }
        }

        Object.assign(existing, data)

        return {
          count: 1,
        }
      },
    },
    githubRepositoryConnection: {
      findFirst: async () => {
        if (!connection) {
          return null
        }

        return {
          id: connection.id,
          enabled: connection.enabled,
          branchFilters: connection.branchFilters,
        }
      },
    },
  }

  return {
    prismaClient,
    getEvent() {
      const target = events.get(event.id)

      if (!target) {
        throw new Error("Missing event")
      }

      return target
    },
  }
}

describe("github webhook branch matching", () => {
  it("extracts branches from heads refs only", () => {
    expect(extractBranchFromRef("refs/heads/main")).toBe("main")
    expect(extractBranchFromRef("refs/tags/v1.0.0")).toBeNull()
    expect(extractBranchFromRef(undefined)).toBeNull()
  })

  it("evaluates push rules against enabled connection and branch filters", () => {
    const enabledConnection = {
      id: "conn_1",
      enabled: true,
      branchFilters: ["main", "release"],
    }

    expect(
      evaluatePushRules({
        payload: {
          ref: "refs/heads/main",
          deleted: false,
        },
        connection: enabledConnection,
      })
    ).toEqual({
      shouldDispatch: true,
      branch: "main",
    })

    expect(
      evaluatePushRules({
        payload: {
          ref: "refs/heads/feature-a",
          deleted: false,
        },
        connection: enabledConnection,
      })
    ).toEqual({
      shouldDispatch: false,
      reason: "BRANCH_FILTER_MISS",
    })

    expect(
      evaluatePushRules({
        payload: {
          ref: "refs/tags/v1.0.0",
          deleted: false,
        },
        connection: enabledConnection,
      })
    ).toEqual({
      shouldDispatch: false,
      reason: "NON_HEAD_REF",
    })
  })
})

describe("github webhook idempotency", () => {
  it("processes a matching push once and ignores duplicate re-processing", async () => {
    const harness = createWebhookPrismaHarness({
      event: {
        id: "event_1",
        deliveryId: "delivery_1",
        eventName: "push",
        action: null,
        githubInstallationId: BigInt(101),
        githubRepositoryId: BigInt(202),
        payloadJson: {
          ref: "refs/heads/main",
          deleted: false,
        },
        payloadSha256: "hash",
        enqueueStatus: "enqueued",
        processStatus: "pending",
      },
      connection: {
        id: "conn_1",
        enabled: true,
        branchFilters: ["main"],
        githubRepositoryId: BigInt(202),
        githubInstallationId: BigInt(101),
      },
    })

    const dispatchBuildJob = mock(async () => ({
      jobId: "build_1",
    }))

    const first = await processGithubWebhookEvent({
      eventId: "event_1",
      attemptNumber: 1,
      maxAttempts: 3,
      prismaClient: harness.prismaClient as Parameters<
        typeof processGithubWebhookEvent
      >[0]["prismaClient"],
      buildDispatcher: dispatchBuildJob,
    })

    expect(first).toEqual({
      outcome: "processed",
      branch: "main",
    })
    expect(dispatchBuildJob).toHaveBeenCalledTimes(1)
    expect(harness.getEvent().processStatus).toBe("processed")

    const second = await processGithubWebhookEvent({
      eventId: "event_1",
      attemptNumber: 2,
      maxAttempts: 3,
      prismaClient: harness.prismaClient as Parameters<
        typeof processGithubWebhookEvent
      >[0]["prismaClient"],
      buildDispatcher: dispatchBuildJob,
    })

    expect(second).toEqual({
      outcome: "duplicate",
    })
    expect(dispatchBuildJob).toHaveBeenCalledTimes(1)
  })
})

describe("github worker retry behavior", () => {
  it("marks retrying on transient failure and dead-lettered on terminal failure", async () => {
    const harness = createWebhookPrismaHarness({
      event: {
        id: "event_2",
        deliveryId: "delivery_2",
        eventName: "push",
        action: null,
        githubInstallationId: BigInt(303),
        githubRepositoryId: BigInt(404),
        payloadJson: {
          ref: "refs/heads/main",
          deleted: false,
        },
        payloadSha256: "hash",
        enqueueStatus: "enqueued",
        processStatus: "pending",
      },
      connection: {
        id: "conn_2",
        enabled: true,
        branchFilters: ["main"],
        githubRepositoryId: BigInt(404),
        githubInstallationId: BigInt(303),
      },
    })

    const dispatchBuildJob = mock(async () => {
      throw new Error("Build dispatch failed")
    })

    await expect(
      processGithubWebhookEvent({
        eventId: "event_2",
        attemptNumber: 1,
        maxAttempts: 2,
        prismaClient: harness.prismaClient as Parameters<
          typeof processGithubWebhookEvent
        >[0]["prismaClient"],
        buildDispatcher: dispatchBuildJob,
      })
    ).rejects.toThrow("Build dispatch failed")

    expect(harness.getEvent().processStatus).toBe("retrying")

    await expect(
      processGithubWebhookEvent({
        eventId: "event_2",
        attemptNumber: 2,
        maxAttempts: 2,
        prismaClient: harness.prismaClient as Parameters<
          typeof processGithubWebhookEvent
        >[0]["prismaClient"],
        buildDispatcher: dispatchBuildJob,
      })
    ).rejects.toThrow("Build dispatch failed")

    expect(harness.getEvent().processStatus).toBe("dead_lettered")
    expect(harness.getEvent().enqueueStatus).toBe("dead_lettered")
    expect(harness.getEvent().processError).toContain("delivery_2:push")
  })
})
