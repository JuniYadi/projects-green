import { afterEach, describe, expect, it, mock } from "bun:test"

import {
  createGithubWebhookHandler,
  enqueueGithubWebhookEvent,
  evaluatePushRules,
  extractBranchFromRef,
  processGithubWebhookEvent,
  signGithubWebhookBody,
  verifyGithubWebhookSignature,
} from "@/modules/github/github.webhook"

const WEBHOOK_SECRET = "test-webhook-secret"

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
          githubInstallationId:
            (data.githubInstallationId as bigint | null) ?? null,
          githubRepositoryId:
            (data.githubRepositoryId as bigint | null) ?? null,
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

const createMockStore = () => {
  const createCalls: Array<Record<string, unknown>> = []
  const failedCalls: Array<{ eventId: string; processError: string }> = []
  const seenDeliveries = new Map<string, { id: string }>()
  let idCounter = 1

  return {
    createCalls,
    failedCalls,
    seenDeliveries,
    store: {
      async findByDeliveryId(deliveryId: string) {
        return seenDeliveries.get(deliveryId) ?? null
      },
      async create(input: Record<string, unknown>) {
        createCalls.push(input)
        const event = { id: `event_${idCounter++}` }
        seenDeliveries.set(input.deliveryId as string, event)
        return event
      },
      async markEnqueueFailed(eventId: string, processError: string) {
        failedCalls.push({ eventId, processError })
      },
    },
  }
}

const createSignedRequest = ({
  payload,
  eventName = "push",
  deliveryId = "delivery_1",
  signature,
}: {
  payload: string
  eventName?: string
  deliveryId?: string
  signature?: string
}) => {
  const resolvedSignature =
    signature ?? signGithubWebhookBody(payload, WEBHOOK_SECRET)

  return new Request("http://localhost/api/integrations/github/webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-GitHub-Event": eventName,
      "X-GitHub-Delivery": deliveryId,
      "X-Hub-Signature-256": resolvedSignature,
    },
    body: payload,
  })
}

describe("verifyGithubWebhookSignature", () => {
  it("returns true when signature matches the raw payload", () => {
    const payload = JSON.stringify({ ref: "refs/heads/main" })
    const signature = signGithubWebhookBody(payload, WEBHOOK_SECRET)
    const valid = verifyGithubWebhookSignature({
      rawBody: payload,
      signatureHeader: signature,
      secret: WEBHOOK_SECRET,
    })

    expect(valid).toBe(true)
  })

  it("returns false when signature does not match", () => {
    const payload = JSON.stringify({ ref: "refs/heads/main" })
    const signature = signGithubWebhookBody(payload, "wrong-secret")
    const valid = verifyGithubWebhookSignature({
      rawBody: payload,
      signatureHeader: signature,
      secret: WEBHOOK_SECRET,
    })

    expect(valid).toBe(false)
  })
})

describe("createGithubWebhookHandler", () => {
  it("returns 400 when required GitHub headers are missing", async () => {
    const { store } = createMockStore()
    const handler = createGithubWebhookHandler({
      webhookSecret: WEBHOOK_SECRET,
      store,
      queue: {
        async enqueueEventId() {},
      },
    })

    const response = await handler(
      new Request("http://localhost/api/integrations/github/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ok: true }),
      })
    )
    const body = (await response.json()) as { ok: boolean; error: string }

    expect(response.status).toBe(400)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("MISSING_GITHUB_HEADERS")
  })

  it("returns 401 when webhook signature is invalid", async () => {
    const { store } = createMockStore()
    const handler = createGithubWebhookHandler({
      webhookSecret: WEBHOOK_SECRET,
      store,
      queue: {
        async enqueueEventId() {},
      },
    })
    const payload = JSON.stringify({ ref: "refs/heads/main" })
    const response = await handler(
      createSignedRequest({
        payload,
        signature: signGithubWebhookBody(payload, "another-secret"),
      })
    )
    const body = (await response.json()) as { ok: boolean; error: string }

    expect(response.status).toBe(401)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("INVALID_SIGNATURE")
  })

  it("returns 400 when payload is not valid JSON", async () => {
    const { store } = createMockStore()
    const handler = createGithubWebhookHandler({
      webhookSecret: WEBHOOK_SECRET,
      store,
      queue: {
        async enqueueEventId() {},
      },
    })
    const response = await handler(
      createSignedRequest({
        payload: "not-json",
      })
    )
    const body = (await response.json()) as { ok: boolean; error: string }

    expect(response.status).toBe(400)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("INVALID_PAYLOAD")
  })

  it("returns 500 when webhook secret is missing", async () => {
    const { store } = createMockStore()
    const handler = createGithubWebhookHandler({
      webhookSecret: "   ",
      store,
      queue: {
        async enqueueEventId() {},
      },
    })

    const response = await handler(
      createSignedRequest({
        payload: JSON.stringify({ ref: "refs/heads/main" }),
      })
    )
    const body = (await response.json()) as { ok: boolean; error: string }

    expect(response.status).toBe(500)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("MISSING_WEBHOOK_SECRET")
  })

  it("accepts valid payload, persists event, and enqueues event id", async () => {
    const { store, createCalls } = createMockStore()
    const enqueuedEventIds: string[] = []
    const handler = createGithubWebhookHandler({
      webhookSecret: WEBHOOK_SECRET,
      store,
      queue: {
        async enqueueEventId(eventId) {
          enqueuedEventIds.push(eventId)
        },
      },
    })
    const payload = JSON.stringify({
      action: "created",
      installation: { id: 987654 },
      repository: { id: 123456, full_name: "acme/service-api" },
      ref: "refs/heads/main",
    })

    const response = await handler(
      createSignedRequest({
        payload,
        deliveryId: "delivery_accept",
      })
    )
    const body = (await response.json()) as {
      ok: boolean
      eventId?: string
      duplicate?: boolean
    }

    expect(response.status).toBe(202)
    expect(body.ok).toBe(true)
    expect(body.duplicate).toBeUndefined()
    expect(body.eventId).toBe("event_1")
    expect(createCalls.length).toBe(1)
    expect(createCalls[0]?.deliveryId).toBe("delivery_accept")
    expect(createCalls[0]?.eventName).toBe("push")
    expect(createCalls[0]?.action).toBe("created")
    expect(createCalls[0]?.githubInstallationId).toBe(BigInt(987654))
    expect(createCalls[0]?.githubRepositoryId).toBe(BigInt(123456))
    expect(typeof createCalls[0]?.payloadSha256).toBe("string")
    expect(enqueuedEventIds).toEqual(["event_1"])
  })

  it("returns 202 and skips insert/enqueue for duplicate delivery id", async () => {
    const { store, createCalls, seenDeliveries } = createMockStore()
    seenDeliveries.set("delivery_duplicate", { id: "event_existing" })
    const enqueuedEventIds: string[] = []
    const handler = createGithubWebhookHandler({
      webhookSecret: WEBHOOK_SECRET,
      store,
      queue: {
        async enqueueEventId(eventId) {
          enqueuedEventIds.push(eventId)
        },
      },
    })

    const response = await handler(
      createSignedRequest({
        payload: JSON.stringify({ ref: "refs/heads/main" }),
        deliveryId: "delivery_duplicate",
      })
    )
    const body = (await response.json()) as {
      ok: boolean
      duplicate?: boolean
      eventId?: string
    }

    expect(response.status).toBe(202)
    expect(body.ok).toBe(true)
    expect(body.duplicate).toBe(true)
    expect(body.eventId).toBe("event_existing")
    expect(createCalls.length).toBe(0)
    expect(enqueuedEventIds.length).toBe(0)
  })

  it("returns duplicate response when create races on unique delivery id", async () => {
    const { store, seenDeliveries } = createMockStore()
    const enqueuedEventIds: string[] = []
    const handler = createGithubWebhookHandler({
      webhookSecret: WEBHOOK_SECRET,
      store: {
        ...store,
        async create(input) {
          seenDeliveries.set(input.deliveryId as string, { id: "event_race" })
          throw {
            code: "P2002",
          }
        },
      },
      queue: {
        async enqueueEventId(eventId) {
          enqueuedEventIds.push(eventId)
        },
      },
    })

    const response = await handler(
      createSignedRequest({
        payload: JSON.stringify({ ref: "refs/heads/main" }),
        deliveryId: "delivery_race",
      })
    )
    const body = (await response.json()) as {
      ok: boolean
      duplicate: boolean
      eventId?: string
    }

    expect(response.status).toBe(202)
    expect(body.ok).toBe(true)
    expect(body.duplicate).toBe(true)
    expect(body.eventId).toBe("event_race")
    expect(enqueuedEventIds).toEqual([])
  })
})

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

describe("enqueueGithubWebhookEvent", () => {
  const originalWebhookSecret = process.env.GITHUB_WEBHOOK_SECRET

  afterEach(() => {
    if (originalWebhookSecret === undefined) {
      delete process.env.GITHUB_WEBHOOK_SECRET
      return
    }

    process.env.GITHUB_WEBHOOK_SECRET = originalWebhookSecret
  })

  it("handles unique-constraint race as deduplicated acceptance", async () => {
    process.env.GITHUB_WEBHOOK_SECRET = WEBHOOK_SECRET
    const rawBody = JSON.stringify({
      ref: "refs/heads/main",
      installation: { id: 1 },
      repository: { id: 2 },
    })
    const signature = signGithubWebhookBody(rawBody, WEBHOOK_SECRET)

    const prismaClient = {
      githubWebhookEvent: {
        findUnique: mock(
          async ({ where }: { where: { deliveryId?: string } }) => {
            if (where.deliveryId === "delivery_race") {
              return { id: "event_existing" }
            }

            return null
          }
        ),
        create: mock(async () => {
          const error = new Error("Unique conflict") as Error & { code: string }
          error.code = "P2002"
          throw error
        }),
        update: mock(async () => null),
        updateMany: mock(async () => ({ count: 0 })),
      },
      githubRepositoryConnection: {
        findFirst: mock(async () => null),
      },
    }

    const queue = {
      enqueue: mock(async () => {}),
      close: mock(async () => {}),
    }

    const result = await enqueueGithubWebhookEvent({
      eventName: "push",
      deliveryId: "delivery_race",
      signature,
      rawBody,
      prismaClient: prismaClient as Parameters<
        typeof enqueueGithubWebhookEvent
      >[0]["prismaClient"],
      queue,
    })

    expect(result).toEqual({
      ok: true,
      status: 202,
      deduplicated: true,
      eventId: "event_existing",
    })
    expect(queue.enqueue).toHaveBeenCalledTimes(0)
  })
})
