import type { EnvVar } from "@/modules/deploy/deploy.types"

export const ENV_VAR_MAX_VALUE_SIZE = 4096

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

const SECRET_KEY_HINT_PATTERN =
  /(SECRET|TOKEN|PASSWORD|PRIVATE|APP_KEY|DB_PASSWORD)/i

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

export const inferEnvVarTypeFromKey = (key: string): "plain" | "secret" => {
  return SECRET_KEY_HINT_PATTERN.test(key) ? "secret" : "plain"
}

export const maskEnvVarValue = (value: string) => {
  const length = Math.max(8, Math.min(value.length, 16))
  return "*".repeat(length)
}

export const getEnvVarPreviewValue = (envVar: EnvVar): string => {
  const normalizedValue = envVar.value.trim()
  const isSecret = envVar.type === "secret"

  if (isSecret || envVar.masked) {
    if (normalizedValue.length > 0) {
      return maskEnvVarValue(normalizedValue)
    }

    return "********"
  }

  return envVar.value
}

export type ParsedEnvImportResult = {
  entries: Array<{ key: string; value: string }>
  errors: string[]
}

export const parseDotEnvImport = (raw: string): ParsedEnvImportResult => {
  const entries: Array<{ key: string; value: string }> = []
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

    const key = withoutExport.slice(0, equalsIndex).trim()
    const value = stripQuotedValue(withoutExport.slice(equalsIndex + 1))

    entries.push({ key, value })
  })

  return {
    entries,
    errors,
  }
}
