import { Elysia } from "elysia"

import {
  createGithubService,
  GithubIntegrationDisabledError,
  type GithubService,
} from "@/modules/github/github.service"

const disabledResponse = {
  ok: false as const,
  error: "FEATURE_DISABLED" as const,
  message: "GitHub App integration is disabled.",
}

const withGithubFeatureFlag = (
  service: GithubService,
  handler: (context: any) => unknown
) => {
  return (context: any) => {
    try {
      service.assertEnabled()
      return handler(context)
    } catch (error) {
      if (error instanceof GithubIntegrationDisabledError) {
        context.set.status = 404
        return disabledResponse
      }

      throw error
    }
  }
}

export const createGithubRoutes = (
  service: GithubService = createGithubService()
) =>
  new Elysia({ prefix: "/integrations/github" })
    .get("/status", () => ({
      ok: true as const,
      feature: service.getFeatureStatus(),
    }))
    .get(
      "/install/start",
      withGithubFeatureFlag(service, ({ set }) => {
        set.status = 501

        return {
          ok: false as const,
          error: "NOT_IMPLEMENTED" as const,
          message: "GitHub installation flow is not implemented yet.",
        }
      })
    )
    .get(
      "/repositories",
      withGithubFeatureFlag(service, ({ set }) => {
        set.status = 501

        return {
          ok: false as const,
          error: "NOT_IMPLEMENTED" as const,
          message: "Repository listing is not implemented yet.",
        }
      })
    )
    .post(
      "/webhook",
      withGithubFeatureFlag(service, ({ set }) => {
        set.status = 501

        return {
          ok: false as const,
          error: "NOT_IMPLEMENTED" as const,
          message: "Webhook processing is not implemented yet.",
        }
      })
    )

export const githubRoutes = createGithubRoutes()
