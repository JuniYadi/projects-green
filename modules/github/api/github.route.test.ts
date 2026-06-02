/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"

const mockEnqueueGithubWebhookEvent = mock(async () => ({
  ok: true as const,
  status: 202,
  eventId: "event_default",
  deduplicated: false,
}))

mock.module("@/modules/github/github.webhook", () => ({
  enqueueGithubWebhookEvent: mockEnqueueGithubWebhookEvent,
}))

const { createGithubRoutes } = await import("@/modules/github/api/github.route")
const {
  GithubApiError,
  GithubConfigurationError,
  GithubCursorError,
  GithubIntegrationDisabledError,
} = await import("@/modules/github/github.service")
import type { GithubService } from "@/modules/github/github.service"

const createBaseService = (enabled: boolean): GithubService => ({
  getFeatureStatus: () => ({
    feature: "github_app_integration",
    envKey: "FEATURE_GITHUB_APP_INTEGRATION",
    enabled,
  }),
  assertEnabled: () => {
    if (!enabled) {
      throw new GithubIntegrationDisabledError()
    }
  },
  async listRepositoriesForActor() {
    return {
      items: [],
      nextCursor: null,
    }
  },
})

describe("githubRoutes", () => {
  it("returns status payload", async () => {
    const app = new Elysia().use(createGithubRoutes(createBaseService(false)))
    const response = await app.handle(
      new Request("http://localhost/integrations/github/status")
    )
    const body = (await response.json()) as {
      ok: boolean
      feature: { enabled: boolean }
    }

    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.feature.enabled).toBe(false)
  })

  it("guards integration endpoints when feature is disabled", async () => {
    const app = new Elysia().use(createGithubRoutes(createBaseService(false)))

    const installResponse = await app.handle(
      new Request("http://localhost/integrations/github/install/start")
    )
    const repositoriesResponse = await app.handle(
      new Request("http://localhost/integrations/github/repositories")
    )
    const webhookResponse = await app.handle(
      new Request("http://localhost/integrations/github/webhook", {
        method: "POST",
      })
    )

    expect(installResponse.status).toBe(404)
    expect(repositoriesResponse.status).toBe(404)
    expect(webhookResponse.status).toBe(404)
  })

  it("returns not implemented for install start when feature is enabled", async () => {
    const app = new Elysia().use(createGithubRoutes(createBaseService(true)))
    const response = await app.handle(
      new Request("http://localhost/integrations/github/install/start")
    )
    const body = (await response.json()) as {
      ok: boolean
      error: string
    }

    expect(response.status).toBe(501)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("NOT_IMPLEMENTED")
  })

  it("returns 401 when repositories request is unauthenticated", async () => {
    const app = new Elysia().use(
      createGithubRoutes({
        authenticate: async () => ({
          user: null,
          organizationId: null,
        }),
        service: createBaseService(true),
      })
    )

    const response = await app.handle(
      new Request("http://localhost/integrations/github/repositories")
    )
    const body = (await response.json()) as {
      ok: boolean
      error: string
    }

    expect(response.status).toBe(401)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("UNAUTHORIZED")
  })

  it("passes scoped auth context and query params to service", async () => {
    const service = {
      ...createBaseService(true),
      listRepositoriesForActor: mock(async () => ({
        items: [
          {
            repositoryId: 1001,
            fullName: "acme/service-api",
            name: "service-api",
            owner: "acme",
            installationId: 9001,
            defaultBranch: "main",
            private: true,
            pushedAt: "2026-05-16T03:10:45.000Z",
          },
        ],
        nextCursor: "next-cursor",
      })),
    } satisfies GithubService

    const app = new Elysia().use(
      createGithubRoutes({
        authenticate: async () => ({
          user: { id: "user_123" },
          organizationId: "org_123",
        }),
        service,
      })
    )

    const response = await app.handle(
      new Request(
        "http://localhost/integrations/github/repositories?ownerId=acme&query=service&cursor=abc&limit=200"
      )
    )
    const body = (await response.json()) as {
      ok: boolean
      items: Array<{ fullName: string }>
      nextCursor: string | null
    }

    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.items[0]?.fullName).toBe("acme/service-api")
    expect(body.nextCursor).toBe("next-cursor")
    expect(service.listRepositoriesForActor).toHaveBeenCalledTimes(1)
    expect(service.listRepositoriesForActor).toHaveBeenCalledWith(
      {
        userId: "user_123",
        organizationId: "org_123",
      },
      {
        ownerId: "acme",
        query: "service",
        cursor: "abc",
        limit: 100,
      }
    )
  })

  it("returns 400 when query parameters are invalid", async () => {
    const app = new Elysia().use(
      createGithubRoutes({
        authenticate: async () => ({
          user: { id: "user_1" },
          organizationId: null,
        }),
        service: createBaseService(true),
      })
    )

    const response = await app.handle(
      new Request(
        "http://localhost/integrations/github/repositories?ownerId=%20"
      )
    )

    const body = (await response.json()) as {
      ok: boolean
      error: string
    }

    expect(response.status).toBe(400)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("INVALID_QUERY")
  })

  it("returns mapped repository listing errors", async () => {
    const baseDependencies = {
      authenticate: async () => ({
        user: { id: "user_1" },
        organizationId: null,
      }),
    }

    const cursorApp = new Elysia().use(
      createGithubRoutes({
        ...baseDependencies,
        service: {
          ...createBaseService(true),
          async listRepositoriesForActor() {
            throw new GithubCursorError()
          },
        },
      })
    )

    const configApp = new Elysia().use(
      createGithubRoutes({
        ...baseDependencies,
        service: {
          ...createBaseService(true),
          async listRepositoriesForActor() {
            throw new GithubConfigurationError("missing env")
          },
        },
      })
    )

    const apiApp = new Elysia().use(
      createGithubRoutes({
        ...baseDependencies,
        service: {
          ...createBaseService(true),
          async listRepositoriesForActor() {
            throw new GithubApiError("remote unavailable")
          },
        },
      })
    )

    const unexpectedApp = new Elysia().use(
      createGithubRoutes({
        ...baseDependencies,
        service: {
          ...createBaseService(true),
          async listRepositoriesForActor() {
            throw new Error("unexpected")
          },
        },
      })
    )

    const cursorResponse = await cursorApp.handle(
      new Request(
        "http://localhost/integrations/github/repositories?cursor=bad"
      )
    )
    const configResponse = await configApp.handle(
      new Request("http://localhost/integrations/github/repositories")
    )
    const apiResponse = await apiApp.handle(
      new Request("http://localhost/integrations/github/repositories")
    )
    const unexpectedResponse = await unexpectedApp.handle(
      new Request("http://localhost/integrations/github/repositories")
    )

    expect(cursorResponse.status).toBe(400)
    expect((await cursorResponse.json()).error).toBe("INVALID_CURSOR")

    expect(configResponse.status).toBe(500)
    expect((await configResponse.json()).error).toBe("INTERNAL_SERVER_ERROR")

    expect(apiResponse.status).toBe(502)
    expect((await apiResponse.json()).error).toBe("INTERNAL_SERVER_ERROR")

    expect(unexpectedResponse.status).toBe(500)
    expect((await unexpectedResponse.json()).error).toBe(
      "INTERNAL_SERVER_ERROR"
    )
  })

  it("returns 400 when webhook headers are missing", async () => {
    const app = new Elysia().use(createGithubRoutes(createBaseService(true)))

    const response = await app.handle(
      new Request("http://localhost/integrations/github/webhook", {
        method: "POST",
      })
    )
    const body = (await response.json()) as {
      ok: boolean
      error: string
    }

    expect(response.status).toBe(400)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("INVALID_HEADERS")
  })

  it("maps webhook enqueue responses and invalid payload error", async () => {
    const app = new Elysia().use(createGithubRoutes(createBaseService(true)))

    mockEnqueueGithubWebhookEvent.mockImplementationOnce(async () => {
      throw new Error("Invalid webhook payload JSON")
    })

    const invalidPayloadResponse = await app.handle(
      new Request("http://localhost/integrations/github/webhook", {
        method: "POST",
        headers: {
          "x-github-event": "push",
          "x-github-delivery": "delivery_invalid",
          "x-hub-signature-256": "sha256=abc",
        },
        body: "{invalid-json}",
      })
    )

    expect(invalidPayloadResponse.status).toBe(400)
    expect((await invalidPayloadResponse.json()).error).toBe("INVALID_PAYLOAD")

    mockEnqueueGithubWebhookEvent.mockImplementationOnce(async () => ({
      ok: false as const,
      status: 503,
      error: "ENQUEUE_FAILED",
      message: "queue is down",
    }))

    const failedResponse = await app.handle(
      new Request("http://localhost/integrations/github/webhook", {
        method: "POST",
        headers: {
          "x-github-event": "push",
          "x-github-delivery": "delivery_fail",
          "x-hub-signature-256": "sha256=abc",
        },
        body: "{}",
      })
    )

    expect(failedResponse.status).toBe(503)
    expect((await failedResponse.json()).error).toBe("ENQUEUE_FAILED")

    mockEnqueueGithubWebhookEvent.mockImplementationOnce(async () => ({
      ok: true as const,
      status: 202,
      eventId: "event_123",
      deduplicated: true,
    }))

    const successResponse = await app.handle(
      new Request("http://localhost/integrations/github/webhook", {
        method: "POST",
        headers: {
          "x-github-event": "push",
          "x-github-delivery": "delivery_ok",
          "x-hub-signature-256": "sha256=abc",
        },
        body: "{}",
      })
    )

    const successBody = (await successResponse.json()) as {
      ok: boolean
      eventId: string
      deduplicated: boolean
    }

    expect(successResponse.status).toBe(202)
    expect(successBody.ok).toBe(true)
    expect(successBody.eventId).toBe("event_123")
    expect(successBody.deduplicated).toBe(true)
  })
})
