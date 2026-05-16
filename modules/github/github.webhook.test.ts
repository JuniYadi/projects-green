import { describe, expect, it } from "bun:test"

import {
  createGithubWebhookHandler,
  signGithubWebhookBody,
  verifyGithubWebhookSignature,
} from "@/modules/github/github.webhook"

const WEBHOOK_SECRET = "test-webhook-secret"

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
