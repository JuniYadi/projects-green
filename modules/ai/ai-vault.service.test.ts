import { beforeEach, describe, expect, it, mock, type Mock } from "bun:test"

import {
  buildProviderVaultPath,
  saveProviderApiKey,
  getProviderApiKey,
  deleteProviderApiKey,
} from "./ai-vault.service"
import type { VaultClient } from "@/lib/vault/vault-client"

describe("aiVaultService", () => {
  let mockWriteKV: Mock<
    (path: string, data: Record<string, string>) => Promise<unknown>
  >
  let mockReadKV: Mock<(path: string) => Promise<Record<string, string>>>
  let mockDeleteKV: Mock<(path: string) => Promise<void>>
  let mockVaultClient: VaultClient

  beforeEach(() => {
    mockWriteKV = mock(async () => ({
      version: 1,
      createdTime: new Date().toISOString(),
      deletionTime: null,
      destroyed: false,
    }))
    mockReadKV = mock(async () => ({
      API_KEY: "not-a-real-api-key",
      organizationId: "org_1",
      providerId: "prov_1",
    }))
    mockDeleteKV = mock(async () => {})

    mockVaultClient = {
      writeKV: mockWriteKV,
      readKV: mockReadKV,
      deleteKV: mockDeleteKV,
    } as unknown as VaultClient
  })

  it("builds canonical provider vault path with tenant namespace", () => {
    const path = buildProviderVaultPath("org_abc123", "prov_openai")
    expect(path).toBe("tenants/org_abc123/ai/providers/prov_openai")
  })

  it("saves API key securely into HashiCorp Vault KV v2", async () => {
    const result = await saveProviderApiKey(
      {
        organizationId: "org_1",
        providerId: "prov_1",
        apiKey: "not-a-real-api-key",
      },
      mockVaultClient
    )

    expect(result.vaultPath).toBe("tenants/org_1/ai/providers/prov_1")
    expect(result.vaultKey).toBe("API_KEY")
    expect(mockWriteKV).toHaveBeenCalledTimes(1)
    const [pathArg, dataArg] = mockWriteKV.mock.calls[0] as [
      string,
      Record<string, string>,
    ]
    expect(pathArg).toBe("tenants/org_1/ai/providers/prov_1")
    expect(dataArg.API_KEY).toBe("not-a-real-api-key")
  })

  it("reads API key in memory from Vault successfully", async () => {
    const key = await getProviderApiKey(
      {
        organizationId: "org_1",
        providerId: "prov_1",
      },
      mockVaultClient
    )

    expect(key).toBe("not-a-real-api-key")
    expect(mockReadKV).toHaveBeenCalledWith("tenants/org_1/ai/providers/prov_1")
  })

  it("returns null when secret is not found or empty", async () => {
    mockReadKV.mockResolvedValueOnce({} as Record<string, string>)

    const key = await getProviderApiKey(
      {
        organizationId: "org_1",
        providerId: "prov_missing",
      },
      mockVaultClient
    )

    expect(key).toBeNull()
  })

  it("deletes API key from Vault when provider is removed", async () => {
    const deleted = await deleteProviderApiKey(
      {
        organizationId: "org_1",
        providerId: "prov_1",
      },
      mockVaultClient
    )

    expect(deleted).toBe(true)
    expect(mockDeleteKV).toHaveBeenCalledWith(
      "tenants/org_1/ai/providers/prov_1"
    )
  })
})
