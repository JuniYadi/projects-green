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

const SECRET_KEY_HINT_PATTERN =
  /(SECRET|TOKEN|PASSWORD|PASS|PRIVATE|CREDENTIAL|APP_KEY|DB_PASSWORD)/i

export const isSecretEnvVarType = (type: EnvVarType | undefined) => {
  return (
    type === "secret" || type === "secret_ref" || type === "secret_shared_ref"
  )
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

export const inferEnvVarTypeFromKey = (key: string): "plain" | "secret_ref" => {
  return SECRET_KEY_HINT_PATTERN.test(key) ? "secret_ref" : "plain"
}

export const maskEnvVarValue = (_value: string) => {
  return MASKED_ENV_VAR_VALUE
}

export const getEnvVarPreviewValue = (envVar: EnvVar): string => {
  if (isSecretEnvVarType(envVar.type) || envVar.masked) {
    return maskEnvVarValue(envVar.value)
  }

  return envVar.value
}

export type ParsedEnvImportResult = {
  entries: Array<{
    key: string
    value: string
    type: "plain" | "secret_ref"
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

    entries.push({ key, value, type: inferEnvVarTypeFromKey(key) })
  })

  return {
    entries,
    errors,
  }
}
