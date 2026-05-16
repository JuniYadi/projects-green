import { Elysia } from "elysia"

import {
  createGithubService,
  GithubIntegrationDisabledError,
  type GithubService,
} from "@/modules/github/github.service"
import { enqueueGithubWebhookEvent } from "@/modules/github/github.webhook"

const disabledResponse = {
  ok: false as const,
  error: "FEATURE_DISABLED" as const,
  message: "GitHub App integration is disabled.",
}

const withGithubFeatureFlag = <TContext>(
  service: GithubService,
  handler: (context: TContext) => unknown
) => {
  return (context: TContext) => {
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
      withGithubFeatureFlag(service, async ({ request, set }) => {
        const eventName = request.headers.get("x-github-event")?.trim()
        const deliveryId = request.headers.get("x-github-delivery")?.trim()
        const signature = request.headers
          .get("x-hub-signature-256")
          ?.trim()

        if (!eventName || !deliveryId || !signature) {
          set.status = 400
          return {
            ok: false as const,
            error: "INVALID_HEADERS" as const,
            message:
              "Missing required GitHub webhook headers for event processing.",
          }
        }

        const rawBody = await request.text()
        let result:
          | Awaited<ReturnType<typeof enqueueGithubWebhookEvent>>
          | undefined

        try {
          result = await enqueueGithubWebhookEvent({
            eventName,
            deliveryId,
            signature,
            rawBody,
          })
        } catch (error) {
          if (
            error instanceof Error &&
            error.message === "Invalid webhook payload JSON"
          ) {
            set.status = 400
            return {
              ok: false as const,
              error: "INVALID_PAYLOAD" as const,
              message: "Webhook payload must be valid JSON.",
            }
          }

          throw error
        }

        set.status = result.status

        if (!result.ok) {
          return result
        }

        return {
          ok: true as const,
          eventId: result.eventId,
          deduplicated: result.deduplicated,
        }
      })
    )

export const githubRoutes = createGithubRoutes()
