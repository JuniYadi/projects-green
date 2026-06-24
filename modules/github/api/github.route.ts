import { Elysia } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { z } from "zod"

import {
  createGithubService,
  GithubApiError,
  GithubConfigurationError,
  GithubCursorError,
  GithubIntegrationDisabledError,
  type GithubService,
} from "@/modules/github/github.service"
import { enqueueGithubWebhookEvent } from "@/modules/github/github.webhook"
import {
  issueGithubInstallState,
  validateGithubInstallState,
} from "@/modules/github/github-install-state"
import { getGithubInstallUrl, fetchGithubInstallationDetails, fetchGithubInstallationRepositories, syncGithubInstallation } from "@/modules/github/github.service"

const repositoriesQuerySchema = z.object({
  ownerId: z.string().trim().min(1).optional(),
  query: z.string().trim().min(1).optional(),
  cursor: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().positive().optional(),
})

type GithubAuthContext = {
  user: {
    id: string
  } | null
  organizationId?: string | null
}

type GithubRouteDependencies = {
  authenticate: () => Promise<GithubAuthContext>
  service: GithubService
}

type RouteSet = {
  status?: number | string
}

const disabledResponse = {
  ok: false as const,
  error: "FEATURE_DISABLED" as const,
  message: "GitHub App integration is disabled.",
}

const createDefaultDependencies = (): GithubRouteDependencies => ({
  authenticate: () => withAuth(),
  service: createGithubService(),
})

const normalizeDependencies = (
  input?: GithubService | GithubRouteDependencies
): GithubRouteDependencies => {
  if (!input) {
    return createDefaultDependencies()
  }

  if ("authenticate" in input) {
    return input
  }

  return {
    authenticate: () => withAuth(),
    service: input,
  }
}

const withGithubFeatureFlag = (
  service: GithubService,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (context: any) => unknown
) => {
  return (context: { set: RouteSet }) => {
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

const toUnauthorized = (set: RouteSet) => {
  set.status = 401
  return {
    ok: false as const,
    error: "UNAUTHORIZED" as const,
    message: "You must be signed in to view GitHub repositories.",
  }
}

const toValidationError = (
  set: RouteSet,
  message: string,
  code: "INVALID_QUERY" | "INVALID_CURSOR"
) => {
  set.status = 400
  return {
    ok: false as const,
    error: code,
    message,
  }
}

const toServerError = (set: RouteSet, message: string, status = 500) => {
  set.status = status
  return {
    ok: false as const,
    error: "INTERNAL_SERVER_ERROR" as const,
    message,
  }
}

export const createGithubRoutes = (
  input?: GithubService | GithubRouteDependencies
) => {
  const dependencies = normalizeDependencies(input)

  return new Elysia({ prefix: "/integrations/github" })
    .get("/status", () => ({
      ok: true as const,
      feature: dependencies.service.getFeatureStatus(),
    }))
    .get(
      "/install/start",
      withGithubFeatureFlag(dependencies.service, async ({ query, set }) => {
        const auth = await dependencies.authenticate()

        if (!auth.user) {
          set.status = 401
          return {
            ok: false as const,
            error: "UNAUTHORIZED" as const,
            message: "You must be signed in to start the GitHub installation.",
          }
        }

        try {
          const state = await issueGithubInstallState({
            workosUserId: auth.user.id,
            organizationId: auth.organizationId ?? null,
            returnTo: (query.returnTo as string) ?? null,
            secret: process.env.APP_SECRET ?? "",
          })

          const redirectUrl = getGithubInstallUrl({ state: state.state })

          set.redirect = redirectUrl

          return {
            ok: true as const,
            redirectUrl,
          }
        } catch (error) {
          console.error(
            `[github] GET /integrations/github/install/start —`,
            error instanceof Error ? (error.stack ?? error.message) : error
          )
          set.status = 500
          return {
            ok: false as const,
            error: "INSTALL_START_FAILED" as const,
            message: "Failed to start GitHub installation flow.",
          }
        }
      })
    )
    .get(
      "/install/callback",
      withGithubFeatureFlag(dependencies.service, async ({ query, set }) => {
        const auth = await dependencies.authenticate()

        // Determine locale from query or session for redirect
        const locale = (query.locale as string) ?? "en"

        const errorRedirect = () => {
          set.redirect = `/${locale}/console/app/deploy?github=error`
        }

        if (!auth.user) {
          errorRedirect()
          return
        }

        const installationIdParam = query.installation_id as string | undefined
        const stateParam = query.state as string | undefined

        if (!installationIdParam || !stateParam) {
          errorRedirect()
          return
        }

        try {
          // Validate and consume the state nonce
          await validateGithubInstallState({
            state: stateParam,
            secret: process.env.APP_SECRET ?? "",
          })
        } catch {
          errorRedirect()
          return
        }

        let installationId: bigint
        try {
          installationId = BigInt(installationIdParam)
        } catch {
          errorRedirect()
          return
        }

        try {
          // Fetch installation details from GitHub API
          const installation = await fetchGithubInstallationDetails(installationId)

          // Fetch all repositories for this installation
          const repositories = await fetchGithubInstallationRepositories(installationId)

          // Sync to DB
          await syncGithubInstallation({
            installationId,
            workosUserId: auth.user.id,
            organizationId: auth.organizationId ?? null,
            installation,
            repositories,
          })
        } catch (error) {
          console.error(
            `[github] GET /integrations/github/install/callback —`,
            error instanceof Error ? (error.stack ?? error.message) : error
          )
          errorRedirect()
          return
        }

        set.redirect = `/${locale}/console/app/deploy?github=connected`
      })
    )
    .get(
      "/repositories",
      withGithubFeatureFlag(dependencies.service, async ({ query, set }) => {
        const auth = await dependencies.authenticate()

        if (!auth.user) {
          return toUnauthorized(set)
        }

        const parsedQuery = repositoriesQuerySchema.safeParse(query)

        if (!parsedQuery.success) {
          return toValidationError(
            set,
            "Invalid query parameters for listing GitHub repositories.",
            "INVALID_QUERY"
          )
        }

        const safeLimit =
          parsedQuery.data.limit === undefined
            ? undefined
            : Math.min(parsedQuery.data.limit, 100)

        try {
          const result = await dependencies.service.listRepositoriesForActor(
            {
              userId: auth.user.id,
              organizationId: auth.organizationId ?? null,
            },
            {
              ownerId: parsedQuery.data.ownerId,
              query: parsedQuery.data.query,
              cursor: parsedQuery.data.cursor,
              limit: safeLimit,
            }
          )

          return {
            ok: true as const,
            items: result.items,
            nextCursor: result.nextCursor,
          }
        } catch (error) {
          if (error instanceof GithubCursorError) {
            return toValidationError(
              set,
              "Invalid cursor value for repository pagination.",
              "INVALID_CURSOR"
            )
          }

          if (error instanceof GithubConfigurationError) {
            return toServerError(
              set,
              "GitHub integration is not configured for this environment."
            )
          }

          if (error instanceof GithubApiError) {
            return toServerError(
              set,
              "Unable to load repositories from GitHub installations.",
              502
            )
          }

          console.error(
            `[github] GET /integrations/github/repositories —`,
            error instanceof Error ? (error.stack ?? error.message) : error
          )
          return toServerError(
            set,
            "Unexpected error while listing GitHub repositories."
          )
        }
      })
    )
    .post(
      "/webhook",
      withGithubFeatureFlag(dependencies.service, async ({ request, set }) => {
        const eventName = request.headers.get("x-github-event")?.trim()
        const deliveryId = request.headers.get("x-github-delivery")?.trim()
        const signature = request.headers.get("x-hub-signature-256")?.trim()

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
}

export const githubRoutes = createGithubRoutes()
