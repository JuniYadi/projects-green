import { describe, expect, it, mock } from "bun:test"

mock.module("@/lib/prisma", () => ({ prisma: {} }))

const { VaultSecretNotFoundError } = await import("@/lib/vault/vault-client")
const { VaultSecretsService, VaultStackNotFoundError } =
  await import("./vault-secrets.service")

const stack = (envVarsJson: unknown = []) => ({
  id: "stack-1",
  organizationId: "org-1",
  envVarsJson,
})

const createDependencies = (envVarsJson: unknown = []) => {
  const db = {
    applicationStack: {
      findFirst: mock(async (_input: unknown) => stack(envVarsJson)),
      update: mock(async (_input: unknown) => undefined),
    },
  }
  const client = {
    writeKV: mock(async () => ({ version: 4 })),
    readKV: mock(async () => ({ DATABASE_URL: "postgres://secret" })),
    deleteKV: mock(async () => undefined),
    getKVMetadata: mock(async () => ({ currentVersion: 4 })),
    listKV: mock(async () => []),
  }
  const auditLogger = mock(async () => undefined)

  return { db, client, auditLogger }
}

describe("VaultSecretsService", () => {
  it("writes to the tenant path and stores metadata without secret values", async () => {
    const dependencies = createDependencies([
      { key: "APP_ENV", type: "plain", value: "production" },
      {
        key: "DATABASE_URL",
        type: "secret",
        value: "old-secret",
        environment: "dev",
      },
      {
        key: "DEV_ONLY",
        type: "secret",
        value: "old-dev-secret",
        environment: "dev",
      },
    ])
    const service = new VaultSecretsService({
      ...dependencies,
      now: () => new Date("2026-08-18T12:00:00.000Z"),
    } as never)

    const result = await service.writeSecrets({
      organizationId: "org-1",
      stackId: "stack-1",
      environment: "prod",
      secrets: { DATABASE_URL: "postgres://new-secret" },
    })

    expect(dependencies.client.writeKV).toHaveBeenCalledWith(
      "tenants/org-1/stacks/stack-1/prod/app-env",
      { DATABASE_URL: "postgres://new-secret" }
    )
    expect(result.references).toEqual([
      {
        key: "DATABASE_URL",
        type: "secret_ref",
        environment: "prod",
        vaultPath: "tenants/org-1/stacks/stack-1/prod/app-env",
        vaultKey: "DATABASE_URL",
        version: 4,
        updatedAt: "2026-08-18T12:00:00.000Z",
      },
    ])

    const update = dependencies.db.applicationStack.update.mock
      .calls[0]?.[0] as { data?: { envVarsJson?: unknown } } | undefined
    const stored = JSON.stringify(update?.data?.envVarsJson)
    expect(stored).toContain("production")
    expect(stored).toContain("secret_ref")
    expect(stored).not.toContain("old-secret")
    expect(stored).not.toContain("old-dev-secret")
    expect(stored).not.toContain("postgres://new-secret")
  })

  it("returns metadata only and audits successful reveals", async () => {
    const dependencies = createDependencies([
      {
        key: "DATABASE_URL",
        type: "secret_ref",
        environment: "prod",
        vaultPath: "tenants/org-1/stacks/stack-1/prod/app-env",
        vaultKey: "DATABASE_URL",
        version: 4,
        updatedAt: "2026-08-18T12:00:00.000Z",
      },
    ])
    const service = new VaultSecretsService(dependencies as never)

    const metadata = await service.getSecretMetadata({
      organizationId: "org-1",
      stackId: "stack-1",
      environment: "prod",
    })
    expect(metadata.references).toHaveLength(1)
    expect(metadata).not.toHaveProperty("value")

    await expect(
      service.revealSecret({
        organizationId: "org-1",
        stackId: "stack-1",
        environment: "prod",
        key: "DATABASE_URL",
        workosUserId: "user-1",
      })
    ).resolves.toMatchObject({
      key: "DATABASE_URL",
      value: "postgres://secret",
    })
    expect(dependencies.auditLogger).toHaveBeenCalledWith({
      organizationId: "org-1",
      stackId: "stack-1",
      workosUserId: "user-1",
      environment: "prod",
      secretKey: "DATABASE_URL",
    })
  })

  it("does not reveal an unreferenced key", async () => {
    const dependencies = createDependencies([])
    const service = new VaultSecretsService(dependencies as never)

    await expect(
      service.revealSecret({
        organizationId: "org-1",
        stackId: "stack-1",
        environment: "prod",
        key: "DATABASE_URL",
        workosUserId: "user-1",
      })
    ).rejects.toBeInstanceOf(VaultSecretNotFoundError)
    expect(dependencies.client.readKV).not.toHaveBeenCalled()
  })

  it("scopes stack lookup to the organization", async () => {
    const dependencies = createDependencies([])
    dependencies.db.applicationStack.findFirst.mockResolvedValue(null as never)
    const service = new VaultSecretsService(dependencies as never)

    await expect(
      service.getSecretMetadata({
        organizationId: "org-2",
        stackId: "stack-1",
        environment: "prod",
      })
    ).rejects.toBeInstanceOf(VaultStackNotFoundError)
    expect(dependencies.db.applicationStack.findFirst).toHaveBeenCalledWith({
      where: { id: "stack-1", organizationId: "org-2" },
      select: { id: true, organizationId: true, envVarsJson: true },
    })
  })
})
