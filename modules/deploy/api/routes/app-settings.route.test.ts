import { beforeEach, describe, expect, it, mock } from "bun:test"

const authState: {
  user: { id: string } | null
  organizationId: string | null
} = {
  user: { id: "user-1" },
  organizationId: "org-1",
}

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
  getPlatformRoleForUser: mock(async () => "super_admin"),
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
})
