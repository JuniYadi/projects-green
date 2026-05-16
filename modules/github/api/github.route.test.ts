import { describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"

import {
  createGithubRoutes,
} from "@/modules/github/api/github.route"
import { GithubCursorError } from "@/modules/github/github.service"
import type { GithubRepositoryService } from "@/modules/github/github.types"

describe("githubRoutes", () => {
  it("returns 401 when request is unauthenticated", async () => {
    const app = new Elysia().use(
      createGithubRoutes({
        authenticate: async () => ({
          user: null,
          organizationId: null,
        }),
        service: {
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
    } satisfies GithubRepositoryService

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
})
