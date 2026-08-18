import {
  ENV_VAR_MAX_VALUE_SIZE,
  inferEnvVarTypeFromKey,
  isSecretEnvVarType,
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
      type: "secret_ref",
      scope: "runtime",
      masked: true,
      isStoredSecret: true,
      lastUpdatedAt: "2026-05-19T08:40:00.000Z",
    },
  ]
}

const memoryStore: EnvironmentVariablesStore = new Map([["staging", []]])

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
    return toValidationError("INVALID_KEY", "Key must match ^[A-Z][A-Z0-9_]*$.")
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
    serviceCredentialId?: string
    vaultPath?: string
    vaultKey?: string
    referenceLabel?: string
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

  const type =
    input.type === "secret"
      ? "secret_ref"
      : (input.type ?? inferEnvVarTypeFromKey(normalizedKey))

  if (
    (type === "plain" || type === "secret_ref") &&
    input.value.trim().length === 0
  ) {
    return toValidationError(
      "VALIDATION_ERROR",
      "Environment value is required."
    )
  }

  if (type === "secret_shared_ref" && !input.serviceCredentialId) {
    return toValidationError(
      "VALIDATION_ERROR",
      "Choose a managed service secret reference."
    )
  }

  if (hasDuplicateKey(envRows, normalizedKey)) {
    return toValidationError(
      "DUPLICATE_KEY",
      `Variable ${normalizedKey} already exists in ${input.environmentId}.`
    )
  }

  const now = nowIso()

  const row: EnvVariableRecord = {
    id: createId(),
    key: normalizedKey,
    value: isSecretEnvVarType(type) ? "" : input.value,
    type,
    scope: input.scope ?? "runtime",
    masked: isSecretEnvVarType(type),
    isStoredSecret: isSecretEnvVarType(type),
    lastUpdatedAt: now,
    ...(type === "secret_shared_ref"
      ? {
          source: "managed_service" as const,
          serviceCredentialId: input.serviceCredentialId,
          vaultPath: input.vaultPath,
          vaultKey: input.vaultKey,
          referenceLabel: input.referenceLabel,
        }
      : {}),
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
    serviceCredentialId?: string
    vaultPath?: string
    vaultKey?: string
    referenceLabel?: string
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
  const nextType =
    input.type === "secret"
      ? "secret_ref"
      : (input.type ??
        (current.type === "secret" ? "secret_ref" : current.type))
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
    value: isSecretEnvVarType(nextType) ? "" : nextValue,
    masked: isSecretEnvVarType(nextType) ? true : current.masked,
    isStoredSecret: isSecretEnvVarType(nextType) ? true : false,
    lastUpdatedAt:
      nextType === "secret_ref" &&
      current.type === "secret_ref" &&
      input.value === undefined
        ? current.lastUpdatedAt
        : nowIso(),
    ...(nextType === "secret_shared_ref"
      ? {
          source: "managed_service" as const,
          serviceCredentialId:
            input.serviceCredentialId ?? current.serviceCredentialId,
          vaultPath: input.vaultPath ?? current.vaultPath,
          vaultKey: input.vaultKey ?? current.vaultKey,
          referenceLabel: input.referenceLabel ?? current.referenceLabel,
        }
      : nextType === "secret_ref"
        ? {
            source:
              current.type === "secret_ref"
                ? (current.source ?? "vault")
                : "vault",
            serviceCredentialId: undefined,
            ...(current.type === "secret_ref"
              ? {
                  vaultPath: current.vaultPath,
                  vaultKey: current.vaultKey,
                  version: current.version,
                }
              : {
                  vaultPath: undefined,
                  vaultKey: undefined,
                  version: undefined,
                }),
            referenceLabel: undefined,
          }
        : {
            source: undefined,
            serviceCredentialId: undefined,
            vaultPath: undefined,
            vaultKey: undefined,
            referenceLabel: undefined,
            version: undefined,
          }),
  }

  if (nextType === "secret_shared_ref" && !next.serviceCredentialId) {
    return toValidationError(
      "VALIDATION_ERROR",
      "Choose a managed service secret reference."
    )
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
    return toValidationError(
      "VALIDATION_ERROR",
      "No variables found to import."
    )
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
    const type = entry.type

    envRows.unshift({
      id: createId(),
      key,
      value: isSecretEnvVarType(type) ? "" : entry.value,
      type,
      scope: normalizeScope(input.scope),
      masked: isSecretEnvVarType(type),
      isStoredSecret: isSecretEnvVarType(type),
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
