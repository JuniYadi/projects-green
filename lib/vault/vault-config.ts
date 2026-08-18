import { z } from "zod"

const emptyStringToUndefined = (value: unknown) => {
  if (typeof value === "string" && value.trim().length === 0) {
    return undefined
  }

  return value
}

const vaultAddressSchema = z
  .string()
  .trim()
  .url("VAULT_ADDR must be a valid URL")
  .refine(
    (value) => value.startsWith("http://") || value.startsWith("https://"),
    "VAULT_ADDR must use http or https"
  )

const vaultMountPathSchema = z
  .string()
  .trim()
  .min(1, "VAULT_MOUNT_PATH cannot be empty")
  .refine(
    (value) => !value.includes("/") && value !== "." && value !== "..",
    "VAULT_MOUNT_PATH must be a single Vault mount segment"
  )

export const vaultConfigSchema = z.object({
  address: vaultAddressSchema,
  roleId: z.string().trim().min(1, "VAULT_ROLE_ID is required"),
  secretId: z.string().trim().min(1, "VAULT_SECRET_ID is required"),
  namespace: z.preprocess(emptyStringToUndefined, z.string().trim().optional()),
  mountPath: vaultMountPathSchema.default("secret"),
  tokenRenewBufferSeconds: z.coerce
    .number()
    .int("VAULT_TOKEN_RENEW_BUFFER_SECONDS must be an integer")
    .min(0, "VAULT_TOKEN_RENEW_BUFFER_SECONDS cannot be negative")
    .default(300),
})

export type VaultConfig = z.infer<typeof vaultConfigSchema>
export type VaultEnvironment = Record<string, string | undefined>

export class VaultConfigError extends Error {
  readonly issues: z.ZodIssue[]

  constructor(error: z.ZodError) {
    super(error.issues.map((issue) => issue.message).join("; "))
    this.name = "VaultConfigError"
    this.issues = error.issues
  }
}

export const parseVaultConfig = (
  environment: VaultEnvironment = process.env
): VaultConfig => {
  const result = vaultConfigSchema.safeParse({
    address: environment.VAULT_ADDR,
    roleId: environment.VAULT_ROLE_ID,
    secretId: environment.VAULT_SECRET_ID,
    namespace: environment.VAULT_NAMESPACE,
    mountPath: environment.VAULT_MOUNT_PATH ?? "secret",
    tokenRenewBufferSeconds:
      environment.VAULT_TOKEN_RENEW_BUFFER_SECONDS ?? "300",
  })

  if (!result.success) {
    throw new VaultConfigError(result.error)
  }

  return {
    ...result.data,
    address: result.data.address.replace(/\/+$/, ""),
  }
}

export const getVaultConfig = (): VaultConfig => parseVaultConfig(process.env)

export const loadVaultConfig = parseVaultConfig
