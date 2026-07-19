import { z } from "zod"

export const githubTokenMetadataSchema = z.object({
  accountLogin: z.string().min(1),
  scopes:       z.array(z.string()).default([]),
  tokenType:    z.enum(["fine_grained", "classic"]).optional(),
})
export type GithubTokenMetadata = z.infer<typeof githubTokenMetadataSchema>

export const githubTokenSecretsSchema = z.object({
  token: z.string().min(1),
})
export type GithubTokenSecrets = z.infer<typeof githubTokenSecretsSchema>

export const GithubTokenDef = {
  type: "GITHUB_TOKEN" as const,
  label: "GitHub Personal Access Token",
  icon: "GithubLogo",
  metadataFields: [
    { key: "accountLogin", label: "Account", primary: true },
    { key: "scopes",       label: "Scopes" },
  ] as const,
  metadataSchema: githubTokenMetadataSchema,
  secretsSchema:  githubTokenSecretsSchema,
  buildMaskedPreview(secrets: GithubTokenSecrets): string {
    return `ghp_***…${secrets.token.slice(-4)}`
  },
} as const
