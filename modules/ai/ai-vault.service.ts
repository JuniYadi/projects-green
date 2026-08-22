import { VaultClient } from "@/lib/vault/vault-client"

let cachedVaultClient: VaultClient | null = null

function getVaultClient(): VaultClient {
  if (!cachedVaultClient) {
    cachedVaultClient = new VaultClient()
  }
  return cachedVaultClient
}

/**
 * Builds the canonical HashiCorp Vault path for a tenant AI provider API key.
 * Pattern: `tenants/${orgId}/ai/providers/${providerId}`
 */
export function buildProviderVaultPath(
  organizationId: string,
  providerId: string
): string {
  return `tenants/${organizationId}/ai/providers/${providerId}`
}

export type SaveApiKeyInput = {
  organizationId: string
  providerId: string
  apiKey: string
  vaultKey?: string
}

export type GetApiKeyInput = {
  organizationId: string
  providerId: string
  vaultKey?: string
}

export type DeleteApiKeyInput = {
  organizationId: string
  providerId: string
}

/**
 * Saves a tenant's LLM API key securely into HashiCorp Vault KV v2.
 * Never stores plaintext API keys in PostgreSQL.
 */
export async function saveProviderApiKey(
  input: SaveApiKeyInput,
  vaultClient: VaultClient = getVaultClient()
): Promise<{ vaultPath: string; vaultKey: string }> {
  const vaultPath = buildProviderVaultPath(
    input.organizationId,
    input.providerId
  )
  const vaultKey = input.vaultKey || "API_KEY"

  await vaultClient.writeKV(vaultPath, {
    [vaultKey]: input.apiKey.trim(),
    updatedAt: new Date().toISOString(),
    organizationId: input.organizationId,
    providerId: input.providerId,
  })

  return {
    vaultPath,
    vaultKey,
  }
}

/**
 * Retrieves the tenant's API key ephemerally in memory at execution time.
 * Returns null if secret is not configured or not found.
 */
export async function getProviderApiKey(
  input: GetApiKeyInput,
  vaultClient: VaultClient = getVaultClient()
): Promise<string | null> {
  const vaultPath = buildProviderVaultPath(
    input.organizationId,
    input.providerId
  )
  const vaultKey = input.vaultKey || "API_KEY"

  try {
    const data = await vaultClient.readKV(vaultPath)
    if (!data || typeof data !== "object") {
      return null
    }

    const secretValue = data[vaultKey]
    if (typeof secretValue === "string" && secretValue.trim().length > 0) {
      return secretValue.trim()
    }

    return null
  } catch (error) {
    console.error(
      `[ai-vault] Failed to read API key from Vault at ${vaultPath}:`,
      error
    )
    return null
  }
}

/**
 * Deletes the tenant's API key from Vault when a provider is removed.
 */
export async function deleteProviderApiKey(
  input: DeleteApiKeyInput,
  vaultClient: VaultClient = getVaultClient()
): Promise<boolean> {
  const vaultPath = buildProviderVaultPath(
    input.organizationId,
    input.providerId
  )

  try {
    await vaultClient.deleteKV(vaultPath)
    return true
  } catch (error) {
    console.error(
      `[ai-vault] Failed to delete API key from Vault at ${vaultPath}:`,
      error
    )
    return false
  }
}
