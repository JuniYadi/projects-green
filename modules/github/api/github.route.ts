import { Elysia } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { z } from "zod"

import {
  GithubApiError,
  GithubConfigurationError,
  GithubCursorError,
  githubRepositoryService,
} from "@/modules/github/github.service"
import type { GithubRepositoryService } from "@/modules/github/github.types"

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
  service: GithubRepositoryService
}

type RouteSet = {
  status?: number | string
}

const createDefaultDependencies = (): GithubRouteDependencies => ({
  authenticate: () => withAuth(),
  service: githubRepositoryService,
})

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

const toServerError = (
  set: RouteSet,
  message: string,
  status = 500
) => {
  set.status = status
  return {
    ok: false as const,
    error: "INTERNAL_SERVER_ERROR" as const,
    message,
  }
}

export const createGithubRoutes = (
  dependencies: GithubRouteDependencies = createDefaultDependencies()
) =>
  new Elysia().get("/integrations/github/repositories", async ({ query, set }) => {
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

      return toServerError(
        set,
        "Unexpected error while listing GitHub repositories."
      )
    }
  })

export const githubRoutes = createGithubRoutes()
