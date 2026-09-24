import type { EnvVar, EnvVarType } from "@/modules/deploy/deploy.types"

export const ENV_VAR_MAX_VALUE_SIZE = 4096
export const MASKED_ENV_VAR_VALUE = "••••••••"
export const ENV_VAR_KEY_PATTERN = /^[A-Z][A-Z0-9_]*$/

export const LARAVEL_ENV_PRESETS = [
  "APP_ENV",
  "APP_KEY",
  "APP_DEBUG",
  "APP_URL",
  "DB_CONNECTION",
  "DB_HOST",
  "DB_PORT",
  "DB_DATABASE",
  "DB_USERNAME",
  "DB_PASSWORD",
  "CACHE_STORE",
  "QUEUE_CONNECTION",
] as const

export const NODE_ENV_PRESETS = [
  "PORT",
  "NODE_ENV",
  "APP_URL",
  "JWT_SECRET",
  "DATABASE_URL",
  "REDIS_URL",
] as const

export const GENERIC_ENV_PRESETS = [
  "PORT",
  "APP_ENV",
  "APP_URL",
  "SECRET_KEY",
  "DATABASE_URL",
] as const

export const getEnvPresets = (
  framework?: string | null,
  templateName?: string | null
): readonly string[] => {
  const target = `${framework ?? ""} ${templateName ?? ""}`.toLowerCase()
  if (target.includes("laravel") || target.includes("php")) {
    return LARAVEL_ENV_PRESETS
  }
  if (
    target.includes("node") ||
    target.includes("next") ||
    target.includes("express") ||
    target.includes("nest") ||
    target.includes("router") ||
    target.includes("js") ||
    target.includes("ts")
  ) {
    return NODE_ENV_PRESETS
  }
  return GENERIC_ENV_PRESETS
}

export const isSecretEnvVarType = (_type: EnvVarType | undefined): boolean => {
  return true
}

const stripQuotedValue = (value: string) => {
  const trimmed = value.trim()

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1)
  }

  return trimmed
}

export const inferEnvVarTypeFromKey = (_key: string): "secret_ref" => {
  return "secret_ref"
}

export const maskEnvVarValue = (_value: string) => {
  return MASKED_ENV_VAR_VALUE
}

export const getEnvVarPreviewValue = (_envVar: EnvVar): string => {
  return MASKED_ENV_VAR_VALUE
}

export type ParsedEnvImportResult = {
  entries: Array<{
    key: string
    value: string
    type: "secret_ref"
  }>
  errors: string[]
}

export const parseDotEnvImport = (raw: string): ParsedEnvImportResult => {
  const entries: ParsedEnvImportResult["entries"] = []
  const errors: string[] = []

  const lines = raw.split(/\r?\n/)

  lines.forEach((line, index) => {
    const trimmed = line.trim()

    if (!trimmed || trimmed.startsWith("#")) {
      return
    }

    const withoutExport = trimmed.startsWith("export ")
      ? trimmed.slice(7).trim()
      : trimmed

    const equalsIndex = withoutExport.indexOf("=")

    if (equalsIndex <= 0) {
      errors.push(`Line ${index + 1} is not a valid KEY=VALUE entry.`)
      return
    }

    const key = withoutExport.slice(0, equalsIndex).trim().toUpperCase()
    const value = stripQuotedValue(withoutExport.slice(equalsIndex + 1))

    if (!ENV_VAR_KEY_PATTERN.test(key)) {
      errors.push(
        `Line ${index + 1} has an invalid key. Use uppercase letters, numbers, and underscores.`
      )
      return
    }

    if (value.length > ENV_VAR_MAX_VALUE_SIZE) {
      errors.push(
        `Line ${index + 1} value cannot exceed ${ENV_VAR_MAX_VALUE_SIZE} characters.`
      )
      return
    }

    entries.push({ key, value, type: "secret_ref" })
  })

  return {
    entries,
    errors,
  }
}

export function generateRandomLaravelAppKey(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.getRandomValues === "function"
  ) {
    const bytes = new Uint8Array(32)
    crypto.getRandomValues(bytes)
    if (typeof Buffer !== "undefined") {
      return `base64:${Buffer.from(bytes).toString("base64")}`
    }
    const binStr = Array.from(bytes, (byte) => String.fromCharCode(byte)).join(
      ""
    )
    if (typeof btoa === "function") {
      return `base64:${btoa(binStr)}`
    }
  }

  throw new Error(
    "Cryptographically secure PRNG is unavailable for generating Laravel APP_KEY."
  )
}

export type SeedEnvVar = {
  key: string
  value: string
  isSecret: boolean
}

export function getSeedEnvVarsForFramework(
  framework?: string | null
): SeedEnvVar[] {
  const normalized = (framework ?? "").toLowerCase().trim()
  if (normalized.includes("laravel") || normalized.includes("php")) {
    return [
      { key: "APP_ENV", value: "production", isSecret: false },
      { key: "APP_DEBUG", value: "false", isSecret: false },
      { key: "APP_KEY", value: generateRandomLaravelAppKey(), isSecret: true },
      { key: "CONTAINER_ROLE", value: "app", isSecret: false },
      { key: "PHP_UPLOAD_MAX_FILESIZE", value: "64M", isSecret: false },
      { key: "PHP_POST_MAX_SIZE", value: "64M", isSecret: false },
      { key: "PHP_MEMORY_LIMIT", value: "256M", isSecret: false },
    ]
  }

  if (normalized.includes("bun")) {
    return [
      { key: "BUN_ENV", value: "production", isSecret: false },
      { key: "PORT", value: "8080", isSecret: false },
    ]
  }

  if (
    normalized.includes("node") ||
    normalized.includes("next") ||
    normalized.includes("express") ||
    normalized.includes("nest") ||
    normalized.includes("router") ||
    normalized.includes("js") ||
    normalized.includes("ts")
  ) {
    return [
      { key: "NODE_ENV", value: "production", isSecret: false },
      { key: "PORT", value: "8080", isSecret: false },
    ]
  }

  return [
    { key: "NODE_ENV", value: "production", isSecret: false },
    { key: "PORT", value: "8080", isSecret: false },
  ]
}
