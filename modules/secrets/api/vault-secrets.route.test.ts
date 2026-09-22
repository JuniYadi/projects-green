import { describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"

mock.module("server-only", () => ({}))
mock.module("@/lib/prisma", () => ({ prisma: {} }))

const { createVaultSecretsRoutes } = await import("./index")
const {
  VaultSecretValidationError,
  VaultStackNotFoundError,
} = await import("../vault-secrets.service")

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
  it("mounts the browser API path without a 404", async () => {
    const mounted = createVaultSecretsRoutes({
      requireActor: async () => actor,
      service: service as never,
    })
    const app = new Elysia({ prefix: "/api" }).use(mounted)
    const response = await app.handle(
      request("/api/stacks/stack-1/secrets/reveal", {
        method: "POST",
        body: { environment: "prod", key: "API_KEY" },
      })
    )

    expect(response.status).not.toBe(404)
    expect(service.revealSecret).toHaveBeenCalledWith(
      expect.objectContaining({ stackId: "stack-1" })
    )
  })

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

    const foreignTenant = createVaultSecretsRoutes({
      requireActor: async () => ({ ...actor, organizationId: "org-foreign" }),
      service: {
        ...service,
        revealSecret: mock(async () => {
          throw new VaultStackNotFoundError("Stack not found")
        }),
      } as never,
    })
    const foreignResponse = await foreignTenant.handle(
      request("/stacks/stack-1/secrets/reveal", {
        method: "POST",
        body: { environment: "prod", key: "API_KEY" },
      })
    )
    expect(foreignResponse.status).toBe(404)
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
    const revealBody = await revealResponse.json()
    expect(revealBody).toMatchObject({
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

    const subtle = crypto.subtle
    const keypair = (await subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveBits"]
    )) as CryptoKeyPair
    const clientPublicKey = await subtle.exportKey("jwk", keypair.publicKey)

    const failedWrite = mock(async () => {
      throw new Error("write must not run during reveal failure")
    })
    const failedReveal = createVaultSecretsRoutes({
      requireActor: async () => actor,
      service: {
        ...service,
        revealSecret: mock(async () => {
          throw new VaultSecretValidationError(
            "Vault returned an empty secret. Set a non-empty value and try again."
          )
        }),
        writeSecrets: failedWrite,
      } as never,
    })
    const failedResponse = await failedReveal.handle(
      request("/stacks/stack-1/secrets/reveal", {
        method: "POST",
        body: { environment: "prod", key: "API_KEY" },
      })
    )
    expect(failedResponse.status).toBe(422)
    expect(await failedResponse.json()).toMatchObject({ ok: false })
    expect(failedWrite).not.toHaveBeenCalled()

    // Envelope reveal test with client ephemeral public key
    const envelopeResponse = await app.handle(
      request("/stacks/stack-1/secrets/reveal", {
        method: "POST",
        body: { environment: "prod", key: "API_KEY", clientPublicKey },
      })
    )
    expect(envelopeResponse.status).toBe(200)
    const envelopeJson = (await envelopeResponse.json()) as {
      ok: boolean
      data: { envelope?: { encrypted: boolean; ciphertext: string } }
    }
    expect(envelopeJson.ok).toBe(true)
    expect(envelopeJson.data.envelope?.encrypted).toBe(true)
    expect(typeof envelopeJson.data.envelope?.ciphertext).toBe("string")
    expect(JSON.stringify(envelopeJson)).not.toContain("secret-value")

    const invalidEnvelopeResponse = await app.handle(
      request("/stacks/stack-1/secrets/reveal", {
        method: "POST",
        body: {
          environment: "prod",
          key: "API_KEY",
          clientPublicKey: { kty: "RSA" },
        },
      })
    )
    expect(invalidEnvelopeResponse.status).toBe(422)
  })
})
