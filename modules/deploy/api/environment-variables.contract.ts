import type { EnvVarType } from "@/modules/deploy/deploy.types"

export type EnvVariableType = EnvVarType
export type EnvVariableScope = "all" | "build" | "runtime"

export type EnvVariableRecord = {
  id: string
  key: string
  value: string
  type: EnvVariableType
  scope: EnvVariableScope
  masked: boolean
  isStoredSecret: boolean
  lastUpdatedAt: string
  source?: "vault" | "managed_service"
  serviceCredentialId?: string
  vaultPath?: string
  vaultKey?: string
  version?: number
  referenceLabel?: string
}

export type EnvVariableActivity = {
  id: string
  action: "created" | "updated" | "deleted" | "imported" | "validation_error"
  message: string
  occurredAt: string
}

export type EnvVariablesListResponse = {
  ok: true
  items: EnvVariableRecord[]
}

export type EnvVariablesMutationError = {
  ok: false
  error:
    | "UNAUTHORIZED"
    | "FORBIDDEN"
    | "NOT_FOUND"
    | "INVALID_KEY"
    | "DUPLICATE_KEY"
    | "VALUE_TOO_LARGE"
    | "VALIDATION_ERROR"
  message: string
  details?: string[]
}

export type EnvVariablesMutationSuccess = {
  ok: true
  item?: EnvVariableRecord
  deletedId?: string
  importedCount?: number
  activity: EnvVariableActivity
  message: string
}

export type EnvVariablesMutationResponse =
  | EnvVariablesMutationError
  | EnvVariablesMutationSuccess
