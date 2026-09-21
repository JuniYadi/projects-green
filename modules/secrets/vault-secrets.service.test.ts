import { describe, expect, it, mock } from "bun:test"

mock.module("@/lib/prisma", () => ({ prisma: {} }))

const { VaultSecretNotFoundError } = await import("@/lib/vault/vault-client")
const {
  VaultSecretsService,
  VaultStackNotFoundError,
  VaultSecretValidationError,
  VaultSecretsServiceError,
} = await import("./vault-secrets.service")

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
    readKV: mock<() => Promise<Record<string, string>>>(async () => ({
      DATABASE_URL: "postgres://secret",
    })),
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

  it("preserves existing secrets when incrementally writing new secrets", async () => {
    const dependencies = createDependencies([
      {
        id: "env-id-1",
        key: "EXISTING_KEY",
        type: "secret_ref",
        environment: "prod",
        vaultPath: "tenants/org-1/stacks/stack-1/prod/app-env",
        vaultKey: "EXISTING_KEY",
        version: 1,
        updatedAt: "2026-08-17T12:00:00.000Z",
        scope: "runtime",
      },
    ])
    dependencies.client.readKV = mock(async () => ({
      EXISTING_KEY: "existing-value",
    }))

    const service = new VaultSecretsService({
      ...dependencies,
      now: () => new Date("2026-08-18T12:00:00.000Z"),
    } as never)

    await service.writeSecrets({
      organizationId: "org-1",
      stackId: "stack-1",
      environment: "prod",
      secrets: { NEW_KEY: "new-value" },
    })

    expect(dependencies.client.writeKV).toHaveBeenCalledWith(
      "tenants/org-1/stacks/stack-1/prod/app-env",
      {
        EXISTING_KEY: "existing-value",
        NEW_KEY: "new-value",
      }
    )
  })

  it("preserves scope and id when updating existing secret references", async () => {
    const dependencies = createDependencies([
      {
        id: "env-id-1",
        key: "DATABASE_URL",
        type: "secret_ref",
        environment: "prod",
        vaultPath: "tenants/org-1/stacks/stack-1/prod/app-env",
        vaultKey: "DATABASE_URL",
        version: 1,
        updatedAt: "2026-08-17T12:00:00.000Z",
        scope: "runtime",
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

    expect(result.references).toEqual([
      {
        id: "env-id-1",
        key: "DATABASE_URL",
        type: "secret_ref",
        environment: "prod",
        vaultPath: "tenants/org-1/stacks/stack-1/prod/app-env",
        vaultKey: "DATABASE_URL",
        version: 4,
        updatedAt: "2026-08-18T12:00:00.000Z",
        scope: "runtime",
      },
    ])
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

  it("rejects secret reference with foreign tenant vault path", async () => {
    const dependencies = createDependencies([
      {
        type: "secret_ref",
        key: "DATABASE_URL",
        environment: "prod",
        vaultPath: "tenants/foreign-org/stacks/other-stack/prod/app-env",
        vaultKey: "DATABASE_URL",
        version: 1,
        updatedAt: "2026-08-18T12:00:00.000Z",
      },
    ])
    const service = new VaultSecretsService(dependencies as never)

    await expect(
      service.revealSecret({
        organizationId: "org-1",
        stackId: "stack-1",
        environment: "prod",
        key: "DATABASE_URL",
        workosUserId: "user-1",
      })
    ).rejects.toBeInstanceOf(VaultSecretValidationError)
    expect(dependencies.client.readKV).not.toHaveBeenCalled()
  })

  it("fails closed when audit logger throws", async () => {
    const dependencies = createDependencies([
      {
        type: "secret_ref",
        key: "DATABASE_URL",
        environment: "prod",
        vaultPath: "tenants/org-1/stacks/stack-1/prod/app-env",
        vaultKey: "DATABASE_URL",
        version: 1,
        updatedAt: "2026-08-18T12:00:00.000Z",
      },
    ])
    dependencies.auditLogger.mockRejectedValue(new Error("DB audit error"))
    const service = new VaultSecretsService(dependencies as never)

    await expect(
      service.revealSecret({
        organizationId: "org-1",
        stackId: "stack-1",
        environment: "prod",
        key: "DATABASE_URL",
        workosUserId: "user-1",
      })
    ).rejects.toBeInstanceOf(VaultSecretsServiceError)
  })
  describe("deleteSecret", () => {
    it("removes the key from Vault KV and from envVarsJson in DB", async () => {
      const envVarsJson = [
        {
          id: "var-1",
          key: "DATABASE_URL",
          type: "secret_ref",
          vaultPath: "tenants/org-1/stacks/stack-1/prod/app-env",
          vaultKey: "DATABASE_URL",
          environment: "prod",
        },
        {
          id: "var-2",
          key: "APP_ENV",
          type: "plain",
          value: "staging",
        },
      ]
      const dependencies = createDependencies(envVarsJson)
      dependencies.client.readKV = mock(async () => ({
        DATABASE_URL: "postgres://secret",
        ANOTHER_KEY: "other-value",
      }))
      const service = new VaultSecretsService(dependencies as never)

      const result = await service.deleteSecret({
        stackId: "stack-1",
        vaultPath: "tenants/org-1/stacks/stack-1/prod/app-env",
        vaultKey: "DATABASE_URL",
        variableId: "var-1",
        currentEnvVarsJson: envVarsJson,
      })

      expect(result.deleted).toBe(true)
      expect(result.vaultKey).toBe("DATABASE_URL")

      // Wrote remaining secrets back to Vault (without DATABASE_URL)
      expect(dependencies.client.writeKV).toHaveBeenCalledWith(
        "tenants/org-1/stacks/stack-1/prod/app-env",
        { ANOTHER_KEY: "other-value" }
      )

      // DB update removed the entry with id "var-1"
      const updateCall = dependencies.db.applicationStack.update.mock
        .calls[0]?.[0] as { data?: { envVarsJson?: unknown } } | undefined
      const storedItems = updateCall?.data?.envVarsJson as unknown[]
      expect(Array.isArray(storedItems)).toBe(true)
      expect(storedItems).toHaveLength(1)
      const remaining = storedItems[0] as { id: string }
      expect(remaining.id).toBe("var-2")
    })

    it("returns deleted=false when key was not in Vault KV", async () => {
      const envVarsJson = [
        {
          id: "var-1",
          key: "MISSING_KEY",
          type: "secret_ref",
          vaultPath: "tenants/org-1/stacks/stack-1/prod/app-env",
          vaultKey: "MISSING_KEY",
          environment: "prod",
        },
      ]
      const dependencies = createDependencies(envVarsJson)
      dependencies.client.readKV = mock(async () => ({
        OTHER_KEY: "other-value",
      }))
      const service = new VaultSecretsService(dependencies as never)

      const result = await service.deleteSecret({
        stackId: "stack-1",
        vaultPath: "tenants/org-1/stacks/stack-1/prod/app-env",
        vaultKey: "MISSING_KEY",
        variableId: "var-1",
        currentEnvVarsJson: envVarsJson,
      })

      // Key was not present so deleted=false
      expect(result.deleted).toBe(false)

      // writeKV was NOT called since no key to remove
      expect(dependencies.client.writeKV).not.toHaveBeenCalled()

      // DB update still happened to remove the entry
      expect(dependencies.db.applicationStack.update).toHaveBeenCalledTimes(1)
    })

    it("gracefully handles 404 from Vault (secret path not found)", async () => {
      const envVarsJson = [
        {
          id: "var-1",
          key: "GONE_KEY",
          type: "secret_ref",
          vaultPath: "tenants/org-1/stacks/stack-1/prod/app-env",
          vaultKey: "GONE_KEY",
          environment: "prod",
        },
      ]
      const dependencies = createDependencies(envVarsJson)
      dependencies.client.readKV = mock(async () => {
        throw new VaultSecretNotFoundError("not found")
      })
      const service = new VaultSecretsService(dependencies as never)

      const result = await service.deleteSecret({
        stackId: "stack-1",
        vaultPath: "tenants/org-1/stacks/stack-1/prod/app-env",
        vaultKey: "GONE_KEY",
        variableId: "var-1",
        currentEnvVarsJson: envVarsJson,
      })

      // Treat 404 from Vault as key not present
      expect(result.deleted).toBe(false)

      // DB entry was still removed
      expect(dependencies.db.applicationStack.update).toHaveBeenCalledTimes(1)
    })
  })

})
