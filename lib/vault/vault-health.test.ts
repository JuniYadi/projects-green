import { describe, it, expect, mock } from "bun:test"
import { probeVaultHealth } from "./vault-health"

describe("probeVaultHealth", () => {
  it("returns ok true and latency when getKVMetadata succeeds", async () => {
    const mockClient = {
      getKVMetadata: mock(async () => ({
        createdTime: "2026-09-10T00:00:00Z",
        updatedTime: "2026-09-10T00:00:00Z",
        currentVersion: 1,
        oldestVersion: 1,
        maxVersions: null,
        casRequired: null,
        deleteVersionAfter: null,
      })),
    }

    const result = await probeVaultHealth(
      "admin/clusters/test/integrations/GITOPS",
      mockClient
    )

    expect(result.ok).toBe(true)
    expect(result.targetPath).toBe("admin/clusters/test/integrations/GITOPS")
    expect(result.latencyMs).toBeGreaterThanOrEqual(0)
    expect(result.error).toBeUndefined()
    expect(mockClient.getKVMetadata).toHaveBeenCalledWith(
      "admin/clusters/test/integrations/GITOPS"
    )
  })

  it("returns ok false and error message when getKVMetadata fails", async () => {
    const mockClient = {
      getKVMetadata: mock(async () => {
        throw new Error("Vault network timeout")
      }),
    }

    const result = await probeVaultHealth(
      "admin/clusters/test/integrations/GITOPS",
      mockClient
    )

    expect(result.ok).toBe(false)
    expect(result.error).toBe("Vault network timeout")
    expect(result.latencyMs).toBeGreaterThanOrEqual(0)
  })
})
