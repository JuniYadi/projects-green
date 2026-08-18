import type {
  VaultSecretMetadataResult,
  VaultSecretReference,
  VaultSecretRevealResult,
  VaultSecretWriteResult,
} from "@/modules/secrets/vault-secrets.service"

export type VaultSecretReferenceDTO = {
  key: string
  type: "secret_ref"
  environment: string
  vaultPath: string
  vaultKey: string
  version: number
  updatedAt: string
  scope?: "all" | "build" | "runtime"
  id?: string
}

export type VaultSecretMetadataDTO = {
  environment: string
  vaultPath: string
  references: VaultSecretReferenceDTO[]
}

export type VaultSecretWriteDTO = VaultSecretMetadataDTO & {
  version: number
  updatedAt: string
}

export type VaultSecretRevealDTO = {
  environment: string
  key: string
  value: string
  version: number
  vaultPath: string
}

export const toVaultSecretReferenceDTO = (
  reference: VaultSecretReference
): VaultSecretReferenceDTO => ({
  key: reference.key,
  type: reference.type,
  environment: reference.environment,
  vaultPath: reference.vaultPath,
  vaultKey: reference.vaultKey,
  version: reference.version,
  updatedAt: reference.updatedAt,
  ...(reference.scope ? { scope: reference.scope } : {}),
  ...(reference.id ? { id: reference.id } : {}),
})

export const toVaultSecretMetadataDTO = (
  result: VaultSecretMetadataResult
): VaultSecretMetadataDTO => ({
  environment: result.environment,
  vaultPath: result.vaultPath,
  references: result.references.map(toVaultSecretReferenceDTO),
})

export const toVaultSecretWriteDTO = (
  result: VaultSecretWriteResult
): VaultSecretWriteDTO => ({
  ...toVaultSecretMetadataDTO(result),
  version: result.version,
  updatedAt: result.updatedAt,
})

export const toVaultSecretRevealDTO = (
  result: VaultSecretRevealResult
): VaultSecretRevealDTO => ({
  environment: result.environment,
  key: result.key,
  value: result.value,
  version: result.version,
  vaultPath: result.vaultPath,
})
