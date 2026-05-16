import { describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"

import { createGithubRoutes } from "@/modules/github/api/github.route"
import {
  GithubCursorError,
  GithubIntegrationDisabledError,
  type GithubService,
} from "@/modules/github/github.service"

describe("githubRoutes", () => {
  it("returns status payload", async () => {
    const service: GithubService = {
      getFeatureStatus: () => ({
        feature: "github_app_integration",
        envKey: "FEATURE_GITHUB_APP_INTEGRATION",
        enabled: false,
      }),
      assertEnabled: () => {},
      async listRepositoriesForActor() {
        return {
          items: [],
          nextCursor: null,
        }
      },
    }

    const app = new Elysia().use(createGithubRoutes(service))
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

  it("returns 404 when feature is disabled", async () => {
    const service: GithubService = {
      getFeatureStatus: () => ({
        feature: "github_app_integration",
        envKey: "FEATURE_GITHUB_APP_INTEGRATION",
        enabled: false,
      }),
      assertEnabled: () => {
        throw new GithubIntegrationDisabledError()
      },
      async listRepositoriesForActor() {
        throw new Error("not used")
      },
    }

    const app = new Elysia().use(createGithubRoutes(service))
    const response = await app.handle(
      new Request("http://localhost/integrations/github/install/start")
    )
    const body = (await response.json()) as {
      ok: boolean
      error: string
    }

    expect(response.status).toBe(404)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("FEATURE_DISABLED")
  })

  it("returns 401 when repositories request is unauthenticated", async () => {
    const app = new Elysia().use(
      createGithubRoutes({
        authenticate: async () => ({
          user: null,
          organizationId: null,
        }),
        service: {
          getFeatureStatus: () => ({
            feature: "github_app_integration",
            envKey: "FEATURE_GITHUB_APP_INTEGRATION",
            enabled: true,
          }),
          assertEnabled: () => {},
          async listRepositoriesForActor() {
            throw new Error("not used")
          },
        },
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
      getFeatureStatus: () => ({
        feature: "github_app_integration" as const,
        envKey: "FEATURE_GITHUB_APP_INTEGRATION",
        enabled: true,
      }),
      assertEnabled: () => {},
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

  it("returns 400 when cursor is invalid", async () => {
    const app = new Elysia().use(
      createGithubRoutes({
        authenticate: async () => ({
          user: { id: "user_1" },
          organizationId: null,
        }),
        service: {
          getFeatureStatus: () => ({
            feature: "github_app_integration",
            envKey: "FEATURE_GITHUB_APP_INTEGRATION",
            enabled: true,
          }),
          assertEnabled: () => {},
          async listRepositoriesForActor() {
            throw new GithubCursorError()
          },
        },
      })
    )

    const response = await app.handle(
      new Request(
        "http://localhost/integrations/github/repositories?cursor=bad-cursor"
      )
    )
    const body = (await response.json()) as {
      ok: boolean
      error: string
    }

    expect(response.status).toBe(400)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("INVALID_CURSOR")
  })

  it("returns not implemented when webhook feature is enabled", async () => {
    const service: GithubService = {
      getFeatureStatus: () => ({
        feature: "github_app_integration",
        envKey: "FEATURE_GITHUB_APP_INTEGRATION",
        enabled: true,
      }),
      assertEnabled: () => {},
      async listRepositoriesForActor() {
        return {
          items: [],
          nextCursor: null,
        }
      },
    }

    const app = new Elysia().use(createGithubRoutes(service))
    const response = await app.handle(
      new Request("http://localhost/integrations/github/webhook", {
        method: "POST",
      })
    )
    const body = (await response.json()) as {
      ok: boolean
      error: string
    }

    expect(response.status).toBe(501)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("NOT_IMPLEMENTED")
  })
})
