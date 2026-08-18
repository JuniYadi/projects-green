import { describe, expect, it, mock } from "bun:test"

mock.module("@/lib/prisma", () => ({ prisma: {} }))

const { createVaultSecretsRoutes } = await import("./index")

const request = (
  path: string,
  init: { method?: string; body?: unknown } = {}
) =>
  new Request(`http://localhost${path}`, {
    method: init.method ?? (init.body === undefined ? "GET" : "POST"),
    headers: { "content-type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })

const actor = {
  userId: "user-1",
  organizationId: "org-1",
  platformRole: "none" as const,
  tenantRole: "admin" as const,
}

const service = {
  writeSecrets: mock(async () => ({
    environment: "prod",
    vaultPath: "tenants/org-1/stacks/stack-1/prod/app-env",
    version: 2,
    updatedAt: "2026-08-18T12:00:00.000Z",
    references: [
      {
        key: "API_KEY",
        type: "secret_ref" as const,
        environment: "prod",
        vaultPath: "tenants/org-1/stacks/stack-1/prod/app-env",
        vaultKey: "API_KEY",
        version: 2,
        updatedAt: "2026-08-18T12:00:00.000Z",
      },
    ],
  })),
  getSecretMetadata: mock(async () => ({
    environment: "prod",
    vaultPath: "tenants/org-1/stacks/stack-1/prod/app-env",
    references: [],
  })),
  revealSecret: mock(async () => ({
    environment: "prod",
    key: "API_KEY",
    value: "secret-value",
    version: 2,
    vaultPath: "tenants/org-1/stacks/stack-1/prod/app-env",
  })),
}

describe("vaultSecretsRoutes", () => {
  it("rejects unauthenticated and member requests", async () => {
    const unauthenticated = createVaultSecretsRoutes({
      requireActor: async (set) => {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Unauthorized" }
      },
      service: service as never,
    })
    expect(
      (
        await unauthenticated.handle(
          request("/stacks/stack-1/secrets/", {
            method: "POST",
            body: { environment: "prod", secrets: { API_KEY: "value" } },
          })
        )
      ).status
    ).toBe(401)

    const member = createVaultSecretsRoutes({
      requireActor: async () => ({ ...actor, tenantRole: "member" as const }),
      service: service as never,
    })
    expect(
      (
        await member.handle(
          request("/stacks/stack-1/secrets/", {
            method: "POST",
            body: { environment: "prod", secrets: { API_KEY: "value" } },
          })
        )
      ).status
    ).toBe(403)
  })

  it("writes secrets without returning plaintext and supports metadata/reveal", async () => {
    service.writeSecrets.mockClear()
    service.getSecretMetadata.mockClear()
    service.revealSecret.mockClear()
    const app = createVaultSecretsRoutes({
      requireActor: async () => actor,
      service: service as never,
    })

    const writeResponse = await app.handle(
      request("/stacks/stack-1/secrets/", {
        method: "POST",
        body: {
          environment: "prod",
          secrets: { API_KEY: "secret-value" },
        },
      })
    )
    const writeBody = (await writeResponse.json()) as Record<string, unknown>
    expect(writeResponse.status).toBe(200)
    expect(JSON.stringify(writeBody)).not.toContain("secret-value")
    expect(service.writeSecrets).toHaveBeenCalledWith({
      organizationId: "org-1",
      stackId: "stack-1",
      environment: "prod",
      secrets: { API_KEY: "secret-value" },
    })

    const metadataResponse = await app.handle(
      request("/stacks/stack-1/secrets/metadata?environment=prod")
    )
    expect(metadataResponse.status).toBe(200)
    expect(service.getSecretMetadata).toHaveBeenCalledWith({
      organizationId: "org-1",
      stackId: "stack-1",
      environment: "prod",
    })

    const revealResponse = await app.handle(
      request("/stacks/stack-1/secrets/reveal", {
        method: "POST",
        body: { environment: "prod", key: "API_KEY" },
      })
    )
    expect(revealResponse.status).toBe(200)
    expect(await revealResponse.json()).toMatchObject({
      ok: true,
      data: { key: "API_KEY", value: "secret-value" },
    })
    expect(service.revealSecret).toHaveBeenCalledWith({
      organizationId: "org-1",
      stackId: "stack-1",
      environment: "prod",
      key: "API_KEY",
      workosUserId: "user-1",
    })
  })
})
