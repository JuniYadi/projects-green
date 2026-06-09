import { beforeEach, describe, expect, it, mock } from "bun:test"

import { signGithubWebhookBody } from "@/modules/github/github.webhook"

class MockGithubIntegrationDisabledError extends Error {
  constructor() {
    super("GitHub App integration is disabled.")
    this.name = "GithubIntegrationDisabledError"
  }
}

const mockGithubServiceAssertEnabled = mock(() => {})
const mockCreateGithubService = mock(() => ({
  getFeatureStatus: () => ({
    feature: "github_app_integration" as const,
    envKey: "FEATURE_GITHUB_APP_INTEGRATION",
    enabled: true,
  }),
  assertEnabled: mockGithubServiceAssertEnabled,
}))

const mockFindUnique = mock(async (): Promise<{ id: string } | null> => null)
const mockCreate = mock(async () => ({ id: "event_1" }))
const mockUpdate = mock(async () => ({}))
const mockEnqueueGithubWebhookEvent = mock(async () => {})

mock.module("@/lib/prisma", () => {
  return {
    prisma: {
      githubWebhookEvent: {
        findUnique: mockFindUnique,
        create: mockCreate,
        update: mockUpdate,
      },
      githubInstallation: {
        findUnique: mock(async () => ({ id: "install_1" })),
      },
      githubRepositoryConnection: {
        findUnique: mock(async () => ({
          id: "repo_conn_1",
          branchFilters: ["main"],
        })),
      },
      applicationStack: {
        findFirst: mock(async () => ({ id: "stack_1" })),
      },
    },
  }
})

mock.module("@/modules/github/jobs/github-event.job", () => {
  return {
    GithubEventJob: {
      dispatch: mockEnqueueGithubWebhookEvent,
    },
  }
})

mock.module("@/modules/github/github.service", () => {
  return {
    GithubIntegrationDisabledError: MockGithubIntegrationDisabledError,
    createGithubService: mockCreateGithubService,
  }
})

const createSignedRequest = ({
  payload,
  deliveryId = "delivery_1",
  signatureSecret = "webhook-secret",
}: {
  payload: string
  deliveryId?: string
  signatureSecret?: string
}) =>
  new Request("http://localhost/api/integrations/github/webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-GitHub-Event": "push",
      "X-GitHub-Delivery": deliveryId,
      "X-Hub-Signature-256": signGithubWebhookBody(payload, signatureSecret),
    },
    body: payload,
  })

describe("POST /api/integrations/github/webhook", () => {
  beforeEach(() => {
    process.env.GITHUB_WEBHOOK_SECRET = "webhook-secret"

    mockGithubServiceAssertEnabled.mockClear()
    mockCreateGithubService.mockClear()
    mockFindUnique.mockClear()
    mockCreate.mockClear()
    mockUpdate.mockClear()
    mockEnqueueGithubWebhookEvent.mockClear()

    mockGithubServiceAssertEnabled.mockImplementation(() => {})
    mockCreateGithubService.mockImplementation(() => ({
      getFeatureStatus: () => ({
        feature: "github_app_integration" as const,
        envKey: "FEATURE_GITHUB_APP_INTEGRATION",
        enabled: true,
      }),
      assertEnabled: mockGithubServiceAssertEnabled,
    }))
    mockFindUnique.mockImplementation(async () => null)
    mockCreate.mockImplementation(async () => ({ id: "event_1" }))
    mockEnqueueGithubWebhookEvent.mockImplementation(async () => {})
  })

  it("returns 404 when feature flag is disabled", async () => {
    mockGithubServiceAssertEnabled.mockImplementation(() => {
      throw new MockGithubIntegrationDisabledError()
    })

    const route = await import("@/app/api/integrations/github/webhook/route")
    const response = await route.POST(
      createSignedRequest({
        payload: JSON.stringify({ ref: "refs/heads/main" }),
      })
    )
    const body = (await response.json()) as { ok: boolean; error: string }

    expect(response.status).toBe(404)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("FEATURE_DISABLED")
    expect(mockFindUnique).not.toHaveBeenCalled()
  })

  it("returns 401 when signature is invalid", async () => {
    const route = await import("@/app/api/integrations/github/webhook/route")
    const response = await route.POST(
      createSignedRequest({
        payload: JSON.stringify({ ref: "refs/heads/main" }),
        signatureSecret: "wrong-secret",
      })
    )
    const body = (await response.json()) as { ok: boolean; error: string }

    expect(response.status).toBe(401)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("INVALID_SIGNATURE")
  })

  it("persists accepted webhook and enqueues event id", async () => {
    const route = await import("@/app/api/integrations/github/webhook/route")
    const response = await route.POST(
      createSignedRequest({
        payload: JSON.stringify({
          action: "created",
          installation: { id: 42 },
          repository: { id: 88, full_name: "acme/api" },
          ref: "refs/heads/main",
        }),
      })
    )
    const body = (await response.json()) as {
      ok: boolean
      eventId: string
    }

    expect(response.status).toBe(202)
    expect(body.ok).toBe(true)
    expect(body.eventId).toBe("event_1")
    expect(mockCreate).toHaveBeenCalledTimes(1)
    expect(mockEnqueueGithubWebhookEvent).toHaveBeenCalledWith("event_1")
  })

  it("returns duplicate response when delivery id already exists", async () => {
    mockFindUnique.mockImplementation(async () => ({ id: "event_existing" }))

    const route = await import("@/app/api/integrations/github/webhook/route")
    const response = await route.POST(
      createSignedRequest({
        payload: JSON.stringify({ ref: "refs/heads/main" }),
        deliveryId: "delivery_duplicate",
      })
    )
    const body = (await response.json()) as {
      ok: boolean
      duplicate: boolean
      eventId: string
    }

    expect(response.status).toBe(202)
    expect(body.ok).toBe(true)
    expect(body.duplicate).toBe(true)
    expect(body.eventId).toBe("event_existing")
    expect(mockCreate).not.toHaveBeenCalled()
    expect(mockEnqueueGithubWebhookEvent).not.toHaveBeenCalled()
  })
})
