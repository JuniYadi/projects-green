import { describe, expect, it } from "bun:test"
import { Elysia } from "elysia"

import {
  createGithubRoutes,
} from "@/modules/github/api/github.route"
import {
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

  it("guards all integration endpoints when feature is disabled", async () => {
    const service: GithubService = {
      getFeatureStatus: () => ({
        feature: "github_app_integration",
        envKey: "FEATURE_GITHUB_APP_INTEGRATION",
        enabled: false,
      }),
      assertEnabled: () => {
        throw new GithubIntegrationDisabledError()
      },
    }

    const app = new Elysia().use(createGithubRoutes(service))
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

  it("returns not implemented when feature is enabled", async () => {
    const service: GithubService = {
      getFeatureStatus: () => ({
        feature: "github_app_integration",
        envKey: "FEATURE_GITHUB_APP_INTEGRATION",
        enabled: true,
      }),
      assertEnabled: () => {},
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
