import { beforeEach, describe, expect, it, mock } from "bun:test"

mock.module("server-only", () => ({}))
mock.module("@/lib/prisma", () => ({ prisma: {} }))
mock.module("@/modules/deploy/sync-stack.service", () => ({
  syncStackConfiguration: mock(async () => ({ ok: true, commitSha: null, message: "synced" })),
}))

const { __testables } = await import("@/modules/deploy/api/environment-variables.stub")
const { createEnvironmentVariablesRoutes } = await import(
  "@/modules/deploy/api/routes/environment-variables.route"
)

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

// ── Shared actor factories ─────────────────────────────

const adminActor = () => ({
  userId: "user-1",
  organizationId: "org-1",
  platformRole: "none" as const,
  tenantRole: "admin" as const,
})

const memberActor = () => ({
  userId: "user-2",
  organizationId: "org-1",
  platformRole: "none" as const,
  tenantRole: "member" as const,
})

// ── Shared mock factories ───────────────────────────────

const mockDeleteSecret = mock()
const mockUpdate = mock()
const mockSync = mock()

const secretEntry = {
  id: "var-secret-1",
  key: "DATABASE_URL",
  type: "secret_ref",
  vaultPath: "tenants/org-1/stacks/stack-1/prod/app-env",
  vaultKey: "DATABASE_URL",
  scope: "runtime",
  masked: true,
  isStoredSecret: true,
}

const plainEntry = {
  id: "var-plain-1",
  key: "APP_ENV",
  type: "plain",
  value: "staging",
  scope: "all",
  masked: false,
  isStoredSecret: false,
}

const makeStack = (envVarsJson: unknown[] = [secretEntry, plainEntry]) => ({
  id: "stack-1",
  slug: "my-app",
  organizationId: "org-1",
  envVarsJson,
})

const makeFindFirst = (stack: ReturnType<typeof makeStack> | null) =>
  mock(async () => stack)

const makeApp = (opts: {
  actor?: ReturnType<typeof adminActor>
  stack?: ReturnType<typeof makeStack> | null
  deleteSecretImpl?: () => Promise<unknown>
  updateImpl?: () => Promise<unknown>
  syncImpl?: () => Promise<unknown>
}) => {
  const stack = opts.stack !== undefined ? opts.stack : makeStack()
  const findFirst = makeFindFirst(stack)

  const dbMock = {
    applicationStack: {
      findFirst,
      update: opts.updateImpl ? mock(opts.updateImpl) : mockUpdate,
    },
  }

  const vaultMock = {
    deleteSecret:
      opts.deleteSecretImpl !== undefined
        ? mock(opts.deleteSecretImpl)
        : mockDeleteSecret,
  }

  const actor = opts.actor ?? adminActor()

  return {
    app: createEnvironmentVariablesRoutes({
      requireActor: async () => actor,
      db: dbMock as never,
      vaultService: vaultMock as never,
      sync: opts.syncImpl ? (mock(opts.syncImpl) as never) : (mockSync as never),
    }),
    findFirst,
    dbMock,
    vaultMock,
  }
}

describe("environmentVariablesRoutes", () => {
  beforeEach(() => {
    __testables.resetStore()
    mockDeleteSecret.mockClear()
    mockUpdate.mockClear()
    mockSync.mockClear()
    mockDeleteSecret.mockImplementation(async () => ({
      deleted: true,
      vaultPath: "tenants/org-1/stacks/stack-1/prod/app-env",
      vaultKey: "DATABASE_URL",
    }))
    mockUpdate.mockImplementation(async () => undefined)
    mockSync.mockImplementation(async () => ({
      ok: true,
      commitSha: null,
      message: "synced",
    }))
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

  // ── DELETE tests ──────────────────────────────────────

  describe("DELETE /:variableId — secret type", () => {
    it("removes key from Vault and returns ok with deletedId", async () => {
      const { app, vaultMock } = makeApp({})

      const response = await app.handle(
        buildRequest(
          "/deploy/environments/stack-1/variables/var-secret-1",
          { method: "DELETE" }
        )
      )

      expect(response.status).toBe(200)
      const body = (await response.json()) as { ok: boolean; deletedId: string }
      expect(body.ok).toBe(true)
      expect(body.deletedId).toBe("var-secret-1")

      // Vault was called
      expect(vaultMock.deleteSecret).toHaveBeenCalledTimes(1)
      expect(vaultMock.deleteSecret).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: "org-1",
          stackId: "stack-1",
          vaultPath: "tenants/org-1/stacks/stack-1/prod/app-env",
          vaultKey: "DATABASE_URL",
          variableId: "var-secret-1",
        })
      )

      // sync was triggered
      expect(mockSync).toHaveBeenCalledTimes(1)
      expect(mockSync).toHaveBeenCalledWith({
        slug: "my-app",
        organizationId: "org-1",
      })
    })

    it("returns 403 when actor has no organizationId", async () => {
      const app = createEnvironmentVariablesRoutes({
        requireActor: async () => ({
          userId: "user-1",
          organizationId: null,
          platformRole: "none",
          tenantRole: "admin",
        }),
      })

      const response = await app.handle(
        buildRequest(
          "/deploy/environments/stack-1/variables/var-secret-1",
          { method: "DELETE" }
        )
      )

      expect(response.status).toBe(403)
    })

    it("returns 404 when stack is not found in DB", async () => {
      const { app } = makeApp({ stack: null })

      const response = await app.handle(
        buildRequest(
          "/deploy/environments/stack-1/variables/var-secret-1",
          { method: "DELETE" }
        )
      )

      expect(response.status).toBe(404)
    })

    it("returns 404 when variable id is not in envVarsJson", async () => {
      const { app } = makeApp({
        stack: makeStack([plainEntry]),
      })

      const response = await app.handle(
        buildRequest(
          "/deploy/environments/stack-1/variables/var-does-not-exist",
          { method: "DELETE" }
        )
      )

      expect(response.status).toBe(404)
      const body = (await response.json()) as { error: string }
      expect(body.error).toBe("NOT_FOUND")
    })

    it("returns 403 when actor is non-manager (member role)", async () => {
      const { app } = makeApp({ actor: memberActor() })

      const response = await app.handle(
        buildRequest(
          "/deploy/environments/stack-1/variables/var-secret-1",
          { method: "DELETE" }
        )
      )

      expect(response.status).toBe(403)
    })
  })

  describe("DELETE /:variableId — plain type", () => {
    it("removes entry from DB only, does not call Vault", async () => {
      const { app, vaultMock } = makeApp({
        stack: makeStack([plainEntry]),
      })

      const response = await app.handle(
        buildRequest(
          "/deploy/environments/stack-1/variables/var-plain-1",
          { method: "DELETE" }
        )
      )

      expect(response.status).toBe(200)
      const body = (await response.json()) as { ok: boolean; deletedId: string }
      expect(body.ok).toBe(true)
      expect(body.deletedId).toBe("var-plain-1")

      // Vault was NOT called for plain vars
      expect(vaultMock.deleteSecret).not.toHaveBeenCalled()

      // DB update was called directly
      expect(mockUpdate).toHaveBeenCalledTimes(1)
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "stack-1" },
          data: {
            envVarsJson: expect.arrayContaining([]),
          },
        })
      )

      // Sync was triggered
      expect(mockSync).toHaveBeenCalledTimes(1)
    })

    it("syncs even for plain var deletion", async () => {
      const syncFn = mock(async () => ({
        ok: true,
        commitSha: null,
        message: "synced",
      }))
      const { app } = makeApp({
        stack: makeStack([plainEntry]),
        syncImpl: () => syncFn(),
      })

      await app.handle(
        buildRequest(
          "/deploy/environments/stack-1/variables/var-plain-1",
          { method: "DELETE" }
        )
      )

      expect(syncFn).toHaveBeenCalledTimes(1)
    })
  })
})
