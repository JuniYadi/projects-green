import { VaultClient } from "./vault-client"
import { logger } from "@/lib/logger"

export interface VaultProbeResult {
  ok: boolean
  latencyMs: number
  targetPath?: string
  error?: string
}

/**
 * Probes HashiCorp Vault accessibility by inspecting metadata of an admin cluster integration.
 * Used for synthetic health checks, monitoring, and zero-trust migration observability.
 */
export async function probeVaultHealth(
  probePath = "admin/clusters/cmt3e4e3l00002wk9s1scy229/integrations/GITOPS",
  client?: Pick<VaultClient, "getKVMetadata">
): Promise<VaultProbeResult> {
  const vault = client ?? new VaultClient()
  const start = performance.now()

  try {
    await vault.getKVMetadata(probePath)
    const latencyMs = Math.round((performance.now() - start) * 100) / 100

    logger.debug(
      { event: "VAULT_PROBE_SUCCESS", targetPath: probePath, latencyMs },
      "Vault synthetic probe succeeded"
    )

    return {
      ok: true,
      latencyMs,
      targetPath: probePath,
    }
  } catch (error) {
    const latencyMs = Math.round((performance.now() - start) * 100) / 100
    const errorMessage = error instanceof Error ? error.message : String(error)

    logger.error(
      {
        event: "VAULT_PROBE_FAILURE",
        targetPath: probePath,
        latencyMs,
        reason: errorMessage,
      },
      "Vault synthetic probe failed"
    )

    return {
      ok: false,
      latencyMs,
      targetPath: probePath,
      error: errorMessage,
    }
  }
}
