import { beforeEach, describe, expect, it } from "bun:test"

import { __testables } from "@/modules/deploy/api/environment-variables.stub"
import { createEnvironmentVariablesRoutes } from "@/modules/deploy/api/routes/environment-variables.route"

const buildRequest = (
  path: string,
  init?: { method?: string; body?: Record<string, unknown> }
) => {
  return new Request(`http://localhost${path}`, {
    method: init?.method ?? "GET",
    headers: {
      "content-type": "application/json",
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  })
}

describe("environmentVariablesRoutes", () => {
  beforeEach(() => {
    __testables.resetStore()
  })

  it("returns unauthorized when actor is missing", async () => {
    const app = createEnvironmentVariablesRoutes({
      requireActor: async (set) => {
        set.status = 401
        return {
          ok: false,
          error: "UNAUTHORIZED",
          message: "Not signed in.",
        }
      },
    })

    const response = await app.handle(
      buildRequest("/deploy/environments/staging/variables")
    )

    expect(response.status).toBe(401)
  })

  it("returns forbidden for non-managers", async () => {
    const app = createEnvironmentVariablesRoutes({
      requireActor: async () => {
        return {
          userId: "user-1",
          organizationId: "org-1",
          platformRole: "none",
          tenantRole: "member",
        }
      },
    })

    const response = await app.handle(
      buildRequest("/deploy/environments/staging/variables")
    )

    expect(response.status).toBe(403)
  })

  it("supports create and list CRUD stubs", async () => {
    const app = createEnvironmentVariablesRoutes({
      requireActor: async () => ({
        userId: "user-1",
        organizationId: "org-1",
        platformRole: "none",
        tenantRole: "admin",
      }),
    })

    const createResponse = await app.handle(
      buildRequest("/deploy/environments/staging/variables", {
        method: "POST",
        body: {
          key: "APP_ENV",
          value: "staging",
          type: "plain",
          scope: "runtime",
        },
      })
    )

    expect(createResponse.status).toBe(200)

    const listResponse = await app.handle(
      buildRequest("/deploy/environments/staging/variables")
    )

    const payload = (await listResponse.json()) as {
      ok: boolean
      items: Array<{ key: string }>
    }

    expect(payload.ok).toBe(true)
    expect(payload.items).toHaveLength(1)
    expect(payload.items[0]?.key).toBe("APP_ENV")
  })
})
