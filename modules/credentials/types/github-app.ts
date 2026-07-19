import { z } from "zod"

export const githubAppMetadataSchema = z.object({
  githubInstallationId: z.number().int().positive(),
  accountLogin:         z.string().min(1),
  accountType:          z.string().optional(),
  targetType:           z.string().optional(),
  permissions:          z.array(z.string()).default([]),
  events:               z.array(z.string()).default([]),
})
export type GithubAppMetadata = z.infer<typeof githubAppMetadataSchema>

export const githubAppSecretsSchema = z.object({
  cachedInstallationToken: z.string().optional(),
  cachedTokenExpiresAt:    z.string().datetime().optional(),
})
export type GithubAppSecrets = z.infer<typeof githubAppSecretsSchema>

export const GithubAppDef = {
  type: "GITHUB_APP" as const,
  label: "GitHub App",
  icon: "GithubLogo",
  metadataFields: [
    { key: "accountLogin",         label: "Organization",     primary: true },
    { key: "githubInstallationId", label: "Installation ID" },
    { key: "accountType",          label: "Account Type" },
  ] as const,
  metadataSchema: githubAppMetadataSchema,
  secretsSchema:  githubAppSecretsSchema,
  buildMaskedPreview(secrets: GithubAppSecrets): string {
    const token = secrets.cachedInstallationToken ?? ""
    return token ? `ghs_***…${token.slice(-4)}` : "ghs_???…"
  },
} as const
