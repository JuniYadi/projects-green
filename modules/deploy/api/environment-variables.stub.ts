import {
  ENV_VAR_MAX_VALUE_SIZE,
  inferEnvVarTypeFromKey,
  parseDotEnvImport,
} from "@/modules/deploy/environment-vars"
import { isValidEnvVarKey } from "@/modules/deploy/deploy.schema"
import type {
  EnvVariableActivity,
  EnvVariableRecord,
  EnvVariableScope,
  EnvVariableType,
  EnvVariablesMutationError,
  EnvVariablesMutationResponse,
} from "@/modules/deploy/api/environment-variables.contract"

type EnvironmentVariablesStore = Map<string, EnvVariableRecord[]>

const nowIso = () => new Date().toISOString()

const createId = () => `var-${Math.random().toString(36).slice(2, 10)}`

const createActivity = (
  action: EnvVariableActivity["action"],
  message: string
): EnvVariableActivity => {
  return {
    id: `activity-${Math.random().toString(36).slice(2, 10)}`,
    action,
    message,
    occurredAt: nowIso(),
  }
}

const createSeedData = (): EnvVariableRecord[] => {
  return [
    {
      id: "var-app-env",
      key: "APP_ENV",
      value: "staging",
      type: "plain",
      scope: "all",
      masked: false,
      isStoredSecret: false,
      lastUpdatedAt: "2026-05-19T08:30:00.000Z",
    },
    {
      id: "var-app-key",
      key: "APP_KEY",
      value: "",
      type: "secret",
      scope: "runtime",
      masked: true,
      isStoredSecret: true,
      lastUpdatedAt: "2026-05-19T08:40:00.000Z",
    },
  ]
}

const memoryStore: EnvironmentVariablesStore = new Map([
  ["staging", []],
])

const getEnvironmentRows = (
  environmentId: string,
  store: EnvironmentVariablesStore
) => {
  if (!store.has(environmentId)) {
    store.set(environmentId, [])
  }

  return store.get(environmentId) ?? []
}

const normalizeScope = (scope: string | undefined): EnvVariableScope => {
  if (scope === "build" || scope === "runtime" || scope === "all") {
    return scope
  }

  return "runtime"
}

const toValidationError = (
  error: EnvVariablesMutationError["error"],
  message: string,
  details?: string[]
): EnvVariablesMutationResponse => {
  return {
    ok: false,
    error,
    message,
    details,
  }
}

const ensureKeyIsValid = (key: string) => {
  const normalizedKey = key.trim()

  if (!normalizedKey) {
    return toValidationError("INVALID_KEY", "Environment key is required.")
  }

  if (!isValidEnvVarKey(normalizedKey)) {
    return toValidationError(
      "INVALID_KEY",
      "Key must match ^[A-Z][A-Z0-9_]*$."
    )
  }

  return null
}

const ensureValueIsValid = (value: string) => {
  if (value.length > ENV_VAR_MAX_VALUE_SIZE) {
    return toValidationError(
      "VALUE_TOO_LARGE",
      `Environment value cannot exceed ${ENV_VAR_MAX_VALUE_SIZE} characters.`
    )
  }

  return null
}

const hasDuplicateKey = (
  envRows: EnvVariableRecord[],
  key: string,
  excludedId?: string
) => {
  const normalized = key.trim().toLowerCase()

  return envRows.some((row) => {
    if (excludedId && row.id === excludedId) {
      return false
    }

    return row.key.trim().toLowerCase() === normalized
  })
}

export const listEnvironmentVariables = (
  environmentId: string,
  store: EnvironmentVariablesStore = memoryStore
): EnvVariableRecord[] => {
  return [...getEnvironmentRows(environmentId, store)]
}

export const createEnvironmentVariable = (
  input: {
    environmentId: string
    key: string
    value: string
    type?: EnvVariableType
    scope?: EnvVariableScope
  },
  store: EnvironmentVariablesStore = memoryStore
): EnvVariablesMutationResponse => {
  const envRows = getEnvironmentRows(input.environmentId, store)
  const keyError = ensureKeyIsValid(input.key)
  if (keyError) {
    return keyError
  }

  const normalizedKey = input.key.trim().toUpperCase()
  const valueError = ensureValueIsValid(input.value)
  if (valueError) {
    return valueError
  }

  if (input.value.trim().length === 0) {
    return toValidationError("VALIDATION_ERROR", "Environment value is required.")
  }

  if (hasDuplicateKey(envRows, normalizedKey)) {
    return toValidationError(
      "DUPLICATE_KEY",
      `Variable ${normalizedKey} already exists in ${input.environmentId}.`
    )
  }

  const type = input.type ?? inferEnvVarTypeFromKey(normalizedKey)
  const now = nowIso()

  const row: EnvVariableRecord = {
    id: createId(),
    key: normalizedKey,
    value: type === "secret" ? "" : input.value,
    type,
    scope: input.scope ?? "runtime",
    masked: type === "secret",
    isStoredSecret: type === "secret",
    lastUpdatedAt: now,
  }

  envRows.unshift(row)

  return {
    ok: true,
    item: row,
    message: `Variable ${normalizedKey} saved.`,
    activity: createActivity("created", `Created ${normalizedKey}.`),
  }
}

export const updateEnvironmentVariable = (
  input: {
    environmentId: string
    variableId: string
    key: string
    value?: string
    type?: EnvVariableType
    scope?: EnvVariableScope
  },
  store: EnvironmentVariablesStore = memoryStore
): EnvVariablesMutationResponse => {
  const envRows = getEnvironmentRows(input.environmentId, store)
  const rowIndex = envRows.findIndex((row) => row.id === input.variableId)

  if (rowIndex < 0) {
    return toValidationError("NOT_FOUND", "Environment variable was not found.")
  }

  const keyError = ensureKeyIsValid(input.key)
  if (keyError) {
    return keyError
  }

  const normalizedKey = input.key.trim().toUpperCase()

  if (hasDuplicateKey(envRows, normalizedKey, input.variableId)) {
    return toValidationError(
      "DUPLICATE_KEY",
      `Variable ${normalizedKey} already exists in ${input.environmentId}.`
    )
  }

  const current = envRows[rowIndex]
  const nextType = input.type ?? current.type
  const nextValue = input.value ?? current.value
  const valueError = ensureValueIsValid(nextValue)
  if (valueError) {
    return valueError
  }

  if (
    nextType === "plain" &&
    (input.value ?? current.value).trim().length === 0
  ) {
    return toValidationError(
      "VALIDATION_ERROR",
      "Environment value is required for plain variables."
    )
  }

  const next: EnvVariableRecord = {
    ...current,
    key: normalizedKey,
    scope: normalizeScope(input.scope ?? current.scope),
    type: nextType,
    value: nextType === "secret" ? "" : nextValue,
    masked: nextType === "secret" ? true : current.masked,
    isStoredSecret:
      nextType === "secret" ? true : false,
    lastUpdatedAt: nowIso(),
  }

  envRows[rowIndex] = next

  return {
    ok: true,
    item: next,
    message: `Variable ${normalizedKey} updated.`,
    activity: createActivity("updated", `Updated ${normalizedKey}.`),
  }
}

export const deleteEnvironmentVariable = (
  input: {
    environmentId: string
    variableId: string
  },
  store: EnvironmentVariablesStore = memoryStore
): EnvVariablesMutationResponse => {
  const envRows = getEnvironmentRows(input.environmentId, store)
  const rowIndex = envRows.findIndex((row) => row.id === input.variableId)

  if (rowIndex < 0) {
    return toValidationError("NOT_FOUND", "Environment variable was not found.")
  }

  const [removed] = envRows.splice(rowIndex, 1)

  return {
    ok: true,
    deletedId: removed.id,
    message: `Variable ${removed.key} deleted.`,
    activity: createActivity("deleted", `Deleted ${removed.key}.`),
  }
}

export const importEnvironmentVariables = (
  input: {
    environmentId: string
    raw: string
    scope?: EnvVariableScope
  },
  store: EnvironmentVariablesStore = memoryStore
): EnvVariablesMutationResponse => {
  const envRows = getEnvironmentRows(input.environmentId, store)
  const parsed = parseDotEnvImport(input.raw)

  if (parsed.errors.length > 0) {
    return toValidationError(
      "VALIDATION_ERROR",
      "Import failed due to invalid .env syntax.",
      parsed.errors
    )
  }

  if (parsed.entries.length === 0) {
    return toValidationError("VALIDATION_ERROR", "No variables found to import.")
  }

  const duplicateKeys = new Set<string>()
  const seen = new Set<string>()

  for (const entry of parsed.entries) {
    const keyError = ensureKeyIsValid(entry.key)
    if (keyError) {
      return keyError
    }

    const normalizedKey = entry.key.trim().toUpperCase()
    const valueError = ensureValueIsValid(entry.value)
    if (valueError) {
      return valueError
    }

    if (seen.has(normalizedKey)) {
      duplicateKeys.add(normalizedKey)
    }

    if (hasDuplicateKey(envRows, normalizedKey)) {
      duplicateKeys.add(normalizedKey)
    }

    seen.add(normalizedKey)
  }

  if (duplicateKeys.size > 0) {
    return toValidationError(
      "DUPLICATE_KEY",
      "Import blocked because duplicate keys were detected.",
      [...duplicateKeys].sort()
    )
  }

  const now = nowIso()

  for (const entry of parsed.entries) {
    const key = entry.key.trim().toUpperCase()
    const type = inferEnvVarTypeFromKey(key)

    envRows.unshift({
      id: createId(),
      key,
      value: type === "secret" ? "" : entry.value,
      type,
      scope: normalizeScope(input.scope),
      masked: type === "secret",
      isStoredSecret: type === "secret",
      lastUpdatedAt: now,
    })
  }

  return {
    ok: true,
    importedCount: parsed.entries.length,
    message: `Imported ${parsed.entries.length} variables from .env.`,
    activity: createActivity(
      "imported",
      `Imported ${parsed.entries.length} variables from .env.`
    ),
  }
}

export const __testables = {
  createSeedData,
  resetStore: () => {
    memoryStore.clear()
    memoryStore.set("staging", [])
  },
}
