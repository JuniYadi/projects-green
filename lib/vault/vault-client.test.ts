import { describe, expect, it, mock } from "bun:test"

import {
  VaultAuthError,
  VaultClient,
  VaultNetworkError,
  VaultSecretNotFoundError,
} from "./vault-client"
import type { VaultConfig } from "./vault-config"

const config: VaultConfig = {
  address: "https://vault.example.test:8200",
  roleId: "role-id",
  secretId: "secret-id",
  namespace: "team-a",
  mountPath: "secret",
  tokenRenewBufferSeconds: 300,
}

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })

describe("VaultClient", () => {
  it("authenticates with AppRole and writes KV v2 data", async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = []
    const fetcher = mock(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        requests.push({ url: String(input), init })
        if (requests.length === 1) {
          return response({
            auth: {
              client_token: "client-token",
              lease_duration: 3600,
              renewable: true,
            },
          })
        }
        return response({ data: { metadata: { version: 3 } } })
      }
    )
    const client = new VaultClient({ config, fetcher })

    await expect(
      client.writeKV("tenants/org-1/stacks/stack-1/prod/app-env", {
        DATABASE_URL: "postgres://secret",
      })
    ).resolves.toMatchObject({ version: 3 })

    expect(requests[0]?.url).toBe(
      "https://vault.example.test:8200/v1/auth/approle/login"
    )
    expect(JSON.parse(String(requests[0]?.init?.body))).toEqual({
      role_id: "role-id",
      secret_id: "secret-id",
    })
    expect(requests[1]?.url).toBe(
      "https://vault.example.test:8200/v1/secret/data/tenants/org-1/stacks/stack-1/prod/app-env"
    )
    expect(requests[1]?.init?.headers).toMatchObject({
      "X-Vault-Token": "client-token",
      "X-Vault-Namespace": "team-a",
    })
    expect(JSON.parse(String(requests[1]?.init?.body))).toEqual({
      data: { DATABASE_URL: "postgres://secret" },
    })
  })

  it("reuses a token and renews it inside the configured buffer", async () => {
    let now = 0
    const requests: string[] = []
    const fetcher = mock(async (input: RequestInfo | URL) => {
      requests.push(String(input))
      if (requests.length === 1) {
        return response({
          auth: {
            client_token: "token-1",
            lease_duration: 600,
            renewable: true,
          },
        })
      }
      if (requests.length === 2) {
        return response({ data: { metadata: { version: 1 } } })
      }
      if (requests.length === 3) {
        return response({ data: { data: { API_KEY: "value" } } })
      }
      if (requests.length === 4) {
        return response({
          auth: {
            client_token: "token-2",
            lease_duration: 600,
            renewable: true,
          },
        })
      }
      return response({ data: { data: { API_KEY: "value" } } })
    })
    const client = new VaultClient({ config, fetcher, now: () => now })

    await client.writeKV("tenants/org/stacks/stack/prod/app-env", {
      API_KEY: "value",
    })
    now = 100_000
    await client.readKV("tenants/org/stacks/stack/prod/app-env")
    now = 350_000
    await client.readKV("tenants/org/stacks/stack/prod/app-env")

    expect(requests).toEqual([
      "https://vault.example.test:8200/v1/auth/approle/login",
      "https://vault.example.test:8200/v1/secret/data/tenants/org/stacks/stack/prod/app-env",
      "https://vault.example.test:8200/v1/secret/data/tenants/org/stacks/stack/prod/app-env",
      "https://vault.example.test:8200/v1/auth/token/renew-self",
      "https://vault.example.test:8200/v1/secret/data/tenants/org/stacks/stack/prod/app-env",
    ])
  })

  it("supports read, delete, metadata, and list KV operations", async () => {
    const requests: string[] = []
    const fetcher = mock(async (input: RequestInfo | URL) => {
      requests.push(String(input))
      if (requests.length === 1) {
        return response({
          auth: { client_token: "token", lease_duration: 3600 },
        })
      }
      if (requests.length === 2) {
        return response({ data: { data: { API_KEY: "value" } } })
      }
      if (requests.length === 3) {
        return response({ data: { current_version: 2 } })
      }
      if (requests.length === 4) {
        return response({ data: { keys: ["app-env", "other"] } })
      }
      return response(null)
    })
    const client = new VaultClient({ config, fetcher })
    const path = "tenants/org/stacks/stack/prod/app-env"

    await expect(client.readKV(path, 2)).resolves.toEqual({ API_KEY: "value" })
    await expect(client.getKVMetadata(path)).resolves.toMatchObject({
      currentVersion: 2,
    })
    await expect(
      client.listKV("tenants/org/stacks/stack/prod")
    ).resolves.toEqual(["app-env", "other"])
    await expect(client.deleteKV(path)).resolves.toBeUndefined()

    expect(requests[1]).toContain(
      "/v1/secret/data/tenants/org/stacks/stack/prod/app-env?version=2"
    )
    expect(requests[2]).toContain(
      "/v1/secret/metadata/tenants/org/stacks/stack/prod/app-env"
    )
    expect(requests[3]).toContain(
      "/v1/secret/metadata/tenants/org/stacks/stack/prod?list=true"
    )
    expect(requests[4]).toContain(
      "/v1/secret/metadata/tenants/org/stacks/stack/prod/app-env"
    )
  })

  it("maps authentication, missing-secret, and transport failures", async () => {
    const authFailure = new VaultClient({
      config,
      fetcher: mock(async () => response({ errors: ["denied"] }, 401)),
    })
    await expect(
      authFailure.readKV("tenants/org/stacks/stack/prod/app-env")
    ).rejects.toBeInstanceOf(VaultAuthError)

    const notFound = new VaultClient({
      config,
      fetcher: mock(async (_input, init) => {
        if (init?.body) {
          return response({
            auth: { client_token: "token", lease_duration: 60 },
          })
        }
        return response({ errors: ["missing"] }, 404)
      }),
    })
    await expect(
      notFound.readKV("tenants/org/stacks/stack/prod/app-env")
    ).rejects.toBeInstanceOf(VaultSecretNotFoundError)

    const networkFailure = new VaultClient({
      config,
      fetcher: mock(async () => {
        throw new Error("offline")
      }),
    })
    await expect(
      networkFailure.readKV("tenants/org/stacks/stack/prod/app-env")
    ).rejects.toBeInstanceOf(VaultNetworkError)
  })
})
