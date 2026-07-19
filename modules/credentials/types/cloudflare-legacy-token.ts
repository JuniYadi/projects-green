import { z } from "zod"

export const cloudflareLegacyTokenMetadataSchema = z.object({
  tokenFormat: z.enum(["legacy"]).default("legacy"),
})
export type CloudflareLegacyTokenMetadata = z.infer<typeof cloudflareLegacyTokenMetadataSchema>

export const cloudflareLegacyTokenSecretsSchema = z.object({
  apiKey: z.string().min(1),
  email:  z.string().email(),
})
export type CloudflareLegacyTokenSecrets = z.infer<typeof cloudflareLegacyTokenSecretsSchema>

export const CloudflareLegacyTokenDef = {
  type: "CLOUDFLARE_LEGACY_TOKEN" as const,
  label: "Cloudflare Global Key (Legacy)",
  icon: "Key",
  metadataFields: [
    { key: "tokenFormat", label: "Token Format" },
  ] as const,
  metadataSchema: cloudflareLegacyTokenMetadataSchema,
  secretsSchema:  cloudflareLegacyTokenSecretsSchema,
  buildMaskedPreview(secrets: CloudflareLegacyTokenSecrets): string {
    return `cf…${secrets.apiKey.slice(-4)}`
  },
} as const
