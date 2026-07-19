import { z } from "zod"

export const cloudflareApiTokenMetadataSchema = z.object({
  accountId:   z.string().optional(),
  accountName: z.string().optional(),
  tokenFormat: z.enum(["v1", "v2"]).default("v2"),
})
export type CloudflareApiTokenMetadata = z.infer<typeof cloudflareApiTokenMetadataSchema>

export const cloudflareApiTokenSecretsSchema = z.object({
  token: z.string().min(10),
})
export type CloudflareApiTokenSecrets = z.infer<typeof cloudflareApiTokenSecretsSchema>

export const CloudflareApiTokenDef = {
  type: "CLOUDFLARE_API_TOKEN" as const,
  label: "Cloudflare API Token",
  icon: "Key",
  metadataFields: [
    { key: "accountName", label: "Account",      primary: true },
    { key: "accountId",   label: "Account ID" },
    { key: "tokenFormat", label: "Token Format" },
  ] as const,
  metadataSchema: cloudflareApiTokenMetadataSchema,
  secretsSchema:  cloudflareApiTokenSecretsSchema,
  buildMaskedPreview(secrets: CloudflareApiTokenSecrets): string {
    return `cf…${secrets.token.slice(-4)}`
  },
} as const
