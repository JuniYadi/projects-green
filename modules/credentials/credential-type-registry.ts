import {
  CloudflareApiTokenDef,
  type CloudflareApiTokenSecrets,
} from "./types/cloudflare-api-token"
import {
  CloudflareLegacyTokenDef,
  type CloudflareLegacyTokenSecrets,
} from "./types/cloudflare-legacy-token"
import {
  GithubAppDef,
  type GithubAppSecrets,
} from "./types/github-app"
import {
  GithubTokenDef,
  type GithubTokenSecrets,
} from "./types/github-token"
import type { AppCredentialType }   from "@prisma/client"
import type { z }                   from "zod"

export const credentialTypeRegistry = {
  CLOUDFLARE_API_TOKEN:    CloudflareApiTokenDef,
  CLOUDFLARE_LEGACY_TOKEN: CloudflareLegacyTokenDef,
  GITHUB_APP:              GithubAppDef,
  GITHUB_TOKEN:            GithubTokenDef,
} as const

export type CredentialTypeKey = keyof typeof credentialTypeRegistry

export type CredentialMetadata<T extends AppCredentialType> =
  z.infer<(typeof credentialTypeRegistry)[T]["metadataSchema"]>

export type CredentialSecrets<T extends AppCredentialType> =
  z.infer<(typeof credentialTypeRegistry)[T]["secretsSchema"]>
export type AnyCredentialSecrets =
  | CloudflareApiTokenSecrets
  | CloudflareLegacyTokenSecrets
  | GithubAppSecrets
  | GithubTokenSecrets

export function getCredentialTypeDef(type: AppCredentialType) {
  const def = credentialTypeRegistry[type as CredentialTypeKey]
  if (!def) throw new Error(`Unknown credential type: ${type}`)
  return def
}

/** Narrow by credential type so callers pass typed secrets, never `unknown`. */
export function buildMaskedPreview(
  type: AppCredentialType,
  secrets: AnyCredentialSecrets
): string {
  switch (type) {
    case "CLOUDFLARE_API_TOKEN":
      return CloudflareApiTokenDef.buildMaskedPreview(
        secrets as CloudflareApiTokenSecrets
      )
    case "CLOUDFLARE_LEGACY_TOKEN":
      return CloudflareLegacyTokenDef.buildMaskedPreview(
        secrets as CloudflareLegacyTokenSecrets
      )
    case "GITHUB_APP":
      return GithubAppDef.buildMaskedPreview(
        secrets as GithubAppSecrets
      )
    case "GITHUB_TOKEN":
      return GithubTokenDef.buildMaskedPreview(
        secrets as GithubTokenSecrets
      )
    default:
      throw new Error(`Unknown credential type: ${type}`)
  }
}
