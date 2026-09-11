import { beforeEach, describe, expect, it, mock } from "bun:test"

const authState: {
  user: { id: string; email?: string } | null
  organizationId: string | null
  role?: string | null
  roles?: string[] | null
} = {
  user: { id: "user-1" },
  organizationId: "org-1",
  role: null,
  roles: null,
}

let mockPlatformRole: "none" | "super_admin" = "super_admin"

const stack: {
  id: string
  organizationId: string
  envVarsJson: unknown
  metadataJson: unknown
} = {
  id: "stack-1",
  organizationId: "org-1",
  envVarsJson: [
    {
      key: "PUBLIC_URL",
      value: "https://example.test",
      type: "plain",
      scope: "runtime",
    },
    {
      key: "DATABASE_PASSWORD",
      value: "old-secret",
      type: "secret",
      scope: "runtime",
    },
  ],
  metadataJson: {
    unrelated: { keep: true },
    storage: {
      version: 1,
      mounts: {
        dev: [
          {
            id: "mount-dev",
            type: "pvc",
            name: "data",
            mountPath: "/data",
            readOnly: false,
          },
        ],
        staging: [],
        prod: [],
      },
    },
  },
}

const mockFindUnique = mock(async (): Promise<typeof stack | null> =>
  structuredClone(stack)
)
const mockUpdate = mock(async ({ data }: { data: Record<string, unknown> }) => {
  if ("envVarsJson" in data) stack.envVarsJson = data.envVarsJson
  if ("metadataJson" in data) stack.metadataJson = data.metadataJson
  return {
    envVarsJson: stack.envVarsJson,
    metadataJson: stack.metadataJson,
  }
})

mock.module("@workos-inc/authkit-nextjs", () => ({
  withAuth: mock(async () => authState),
}))
mock.module("@/lib/platform-role", () => ({
  getPlatformRoleForUser: mock(async () => mockPlatformRole),
}))
mock.module("@/lib/prisma", () => ({
  prisma: {
    applicationStack: { findUnique: mockFindUnique, update: mockUpdate },
  },
}))
mock.module("@/lib/encryption", () => ({
  encrypt: mock((value: string) => ({
    encrypted: `cipher:${value}`,
    iv: "iv",
    tag: "tag",
  })),
  getEncryptionKey: mock(() => Buffer.alloc(32)),
  serializeEncryptedField: mock((value: unknown) => JSON.stringify(value)),
}))

const { appSettingsRoutes } = await import("./app-settings.route")

function request(path: string, init?: RequestInit) {
  return appSettingsRoutes.handle(
    new Request(`http://localhost${path}`, {
      headers: { "Content-Type": "application/json" },
      ...init,
    })
  )
}

function json(path: string, method: string, body: unknown) {
  return request(path, { method, body: JSON.stringify(body) })
}

describe("appSettingsRoutes", () => {
  beforeEach(() => {
    authState.user = { id: "user-1" }
    authState.organizationId = "org-1"
    authState.role = null
    authState.roles = null
    mockPlatformRole = "super_admin"
    stack.envVarsJson = [
      {
        key: "PUBLIC_URL",
        value: "https://example.test",
        type: "plain",
        scope: "runtime",
      },
      {
        key: "DATABASE_PASSWORD",
        value: "old-secret",
        type: "secret",
        scope: "runtime",
      },
    ]
    stack.metadataJson = {
      unrelated: { keep: true },
      storage: {
        version: 1,
        mounts: {
          dev: [
            {
              id: "mount-dev",
              type: "pvc",
              name: "data",
              mountPath: "/data",
              readOnly: false,
            },
          ],
          staging: [],
          prod: [],
        },
      },
    }
    mockFindUnique.mockClear()
    mockUpdate.mockClear()
  })

  it("enforces authentication and organization tenant isolation", async () => {
    authState.user = null
    const unauthorized = await request("/deploy/apps/demo/settings")
    expect(unauthorized.status).toBe(401)

    authState.user = { id: "user-1" }
    authState.organizationId = "org-other"
    mockFindUnique.mockResolvedValueOnce(null)
    const isolated = await request("/deploy/apps/demo/settings")
    expect(isolated.status).toBe(404)
    expect(mockFindUnique).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          organizationId_slug: { organizationId: "org-other", slug: "demo" },
        },
      })
    )
  })

  it("hydrates GET settings with safe env rows and all environment mounts", async () => {
    const response = await request("/deploy/apps/demo/settings")
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({
      ok: true,
      data: {
        envVars: [
          {
            id: "PUBLIC_URL",
            key: "PUBLIC_URL",
            type: "plain",
            scope: "runtime",
            masked: false,
            isStoredSecret: false,
            value: "https://example.test",
          },
          {
            id: "DATABASE_PASSWORD",
            key: "DATABASE_PASSWORD",
            type: "secret",
            scope: "runtime",
            masked: true,
            isStoredSecret: true,
          },
        ],
        mounts: {
          dev: [
            {
              id: "mount-dev",
              type: "pvc",
              name: "data",
              mountPath: "/data",
              readOnly: false,
            },
          ],
          staging: [],
          prod: [],
        },
      },
    })
    expect(JSON.stringify(body)).not.toContain("old-secret")
  })

  it("preserves an existing secret when its incoming value is empty", async () => {
    const response = await json("/deploy/apps/demo/settings/env", "PATCH", {
      environmentId: "dev",
      variables: [
        {
          key: "DATABASE_PASSWORD",
          value: "",
          type: "secret",
          scope: "runtime",
        },
      ],
    })
    expect(response.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          envVarsJson: [
            {
              key: "DATABASE_PASSWORD",
              value: "old-secret",
              type: "secret",
              scope: "runtime",
              masked: true,
              isStoredSecret: true,
            },
          ],
        },
      })
    )
    const body = await response.json()
    expect(body.data.envVars[0]).not.toHaveProperty("value")
  })

  it("merges mount metadata, encrypts content, and omits content from summaries", async () => {
    const response = await json("/deploy/apps/demo/settings/mounts", "PATCH", {
      environmentId: "staging",
      mounts: [
        {
          type: "secret",
          name: "config",
          mountPath: "/etc/config",
          content: "private",
          readOnly: true,
        },
      ],
    })
    expect(response.status).toBe(200)
    const saved = mockUpdate.mock.calls.at(-1)?.[0] as {
      data: { metadataJson: Record<string, unknown> }
    }
    const metadata = saved.data.metadataJson
    expect(metadata.unrelated).toEqual({ keep: true })
    expect((metadata.storage as Record<string, unknown>).version).toBe(1)
    const savedMount = (
      (metadata.storage as Record<string, unknown>).mounts as Record<
        string,
        unknown[]
      >
    ).staging[0] as Record<string, unknown>
    expect(savedMount.contentEncrypted).toContain("cipher:private")
    const body = await response.json()
    expect(JSON.stringify(body)).not.toContain("private")
    expect(JSON.stringify(body)).not.toContain("contentEncrypted")
  })

  it("deletes a mount only from the selected environment", async () => {
    const response = await request(
      "/deploy/apps/demo/settings/mounts/mount-dev?environmentId=dev",
      { method: "DELETE" }
    )
    expect(response.status).toBe(200)
    const saved = mockUpdate.mock.calls.at(-1)?.[0] as {
      data: { metadataJson: Record<string, unknown> }
    }
    const mounts = (
      (saved.data.metadataJson.storage as Record<string, unknown>)
        .mounts as Record<string, unknown[]>
    ).dev
    expect(mounts).toEqual([])
    expect(
      (saved.data.metadataJson.storage as Record<string, unknown>).version
    ).toBe(1)
  })
  it("rejects requests without an organization", async () => {
    authState.organizationId = null
    const response = await request("/deploy/apps/demo/settings")
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({
      ok: false,
      error: "FORBIDDEN",
      message: "Organization required",
    })
  })

  it("denies manager actions to non-manager users", async () => {
    mockPlatformRole = "none"
    authState.role = "member"
    const response = await json("/deploy/apps/demo/settings/env", "PATCH", {
      environmentId: "dev",
      variables: [],
    })
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({
      ok: false,
      error: "FORBIDDEN",
      message: "Forbidden",
    })
  })

  it("returns not found when GET has no matching stack", async () => {
    mockFindUnique.mockResolvedValueOnce(null)
    const response = await request("/deploy/apps/missing/settings")
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({
      ok: false,
      error: "NOT_FOUND",
      message: "Application not found",
    })
  })

  it("returns not found when env PATCH has no matching stack", async () => {
    mockFindUnique.mockResolvedValueOnce(null)
    const response = await json("/deploy/apps/missing/settings/env", "PATCH", {
      environmentId: "dev",
      variables: [],
    })
    expect(response.status).toBe(404)
    expect((await response.json()).message).toBe("Application not found")
  })

  it("returns not found when mount PATCH has no matching stack", async () => {
    mockFindUnique.mockResolvedValueOnce(null)
    const response = await json(
      "/deploy/apps/missing/settings/mounts",
      "PATCH",
      { environmentId: "dev", mounts: [] }
    )
    expect(response.status).toBe(404)
    expect((await response.json()).message).toBe("Application not found")
  })

  it("returns not found when mount DELETE has no matching stack", async () => {
    mockFindUnique.mockResolvedValueOnce(null)
    const response = await request(
      "/deploy/apps/missing/settings/mounts/mount-dev?environmentId=dev",
      { method: "DELETE" }
    )
    expect(response.status).toBe(404)
    expect((await response.json()).message).toBe("Application not found")
  })

  it("rejects invalid environment variable keys", async () => {
    const response = await json("/deploy/apps/demo/settings/env", "PATCH", {
      environmentId: "dev",
      variables: [{ key: "bad-key", value: "value" }],
    })
    expect(response.status).toBe(422)
    expect((await response.json()).message).toContain(
      "Invalid environment variable key"
    )
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it("rejects invalid environments for settings updates", async () => {
    const response = await json("/deploy/apps/demo/settings/env", "PATCH", {
      environmentId: "qa",
      variables: [],
    })
    expect(response.status).toBe(422)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it("rejects invalid mount paths and environments", async () => {
    const invalidPath = await json(
      "/deploy/apps/demo/settings/mounts",
      "PATCH",
      {
        environmentId: "dev",
        mounts: [{ type: "pvc", name: "data", mountPath: "relative" }],
      }
    )
    expect(invalidPath.status).toBe(422)
    expect((await invalidPath.json()).message).toBe(
      "Mount path must be absolute"
    )

    const invalidEnvironment = await json(
      "/deploy/apps/demo/settings/mounts",
      "PATCH",
      { environmentId: "qa", mounts: [] }
    )
    expect(invalidEnvironment.status).toBe(422)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it("rejects DELETE without an environment and for a missing mount", async () => {
    const missingEnvironment = await request(
      "/deploy/apps/demo/settings/mounts/mount-dev",
      { method: "DELETE" }
    )
    expect(missingEnvironment.status).toBe(422)

    const missingMount = await request(
      "/deploy/apps/demo/settings/mounts/unknown?environmentId=dev",
      { method: "DELETE" }
    )
    expect(missingMount.status).toBe(404)
    expect((await missingMount.json()).message).toBe("Mount not found")
  })

  it("parses JSON-string and non-array settings safely", async () => {
    stack.envVarsJson = JSON.stringify([{ key: "PUBLIC_URL", value: "ok" }])
    stack.metadataJson = {
      storage: { mounts: { dev: JSON.stringify([]), staging: {}, prod: [] } },
    }
    const response = await request("/deploy/apps/demo/settings")
    expect(response.status).toBe(200)
    expect((await response.json()).data).toEqual({
      envVars: [
        {
          id: "PUBLIC_URL",
          key: "PUBLIC_URL",
          type: "plain",
          scope: "runtime",
          masked: false,
          isStoredSecret: false,
          value: "ok",
        },
      ],
      mounts: { dev: [], staging: [], prod: [] },
    })
  })

  it("preserves encrypted mount metadata when content is omitted", async () => {
    const encrypted = JSON.stringify({
      encrypted: "cipher:keep",
      iv: "iv",
      tag: "tag",
    })
    stack.metadataJson = {
      storage: {
        mounts: {
          dev: [
            {
              id: "mount-dev",
              type: "secret",
              name: "data",
              mountPath: "/data",
              readOnly: false,
              contentEncrypted: encrypted,
              contentSummary: "[REDACTED] bytes=4",
            },
          ],
          staging: [],
          prod: [],
        },
      },
    }
    const response = await json("/deploy/apps/demo/settings/mounts", "PATCH", {
      environmentId: "dev",
      mounts: [
        {
          id: "mount-dev",
          type: "secret",
          name: "renamed",
          mountPath: "/renamed",
        },
      ],
    })
    expect(response.status).toBe(200)
    const saved = mockUpdate.mock.calls.at(-1)?.[0] as {
      data: { metadataJson: { storage: { mounts: { dev: unknown[] } } } }
    }
    const mount = saved.data.metadataJson.storage.mounts.dev[0] as Record<
      string,
      unknown
    >
    expect(mount.contentEncrypted).toBe(encrypted)
    expect(mount.contentSummary).toBe("[REDACTED] bytes=4")
  })
})
