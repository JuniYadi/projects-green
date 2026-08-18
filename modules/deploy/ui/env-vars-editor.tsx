"use client"

import { useMemo, useState } from "react"
import {
  Eye,
  EyeOff,
  KeyRound,
  Link2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { createEnvironmentVariablesClient } from "@/modules/deploy/api/environment-variables.client"
import type {
  EnvVariableActivity,
  EnvVariableRecord,
  EnvVariablesMutationError,
} from "@/modules/deploy/api/environment-variables.contract"
import {
  ENV_VAR_MAX_VALUE_SIZE,
  LARAVEL_ENV_PRESETS,
  getEnvVarPreviewValue,
  inferEnvVarTypeFromKey,
  isSecretEnvVarType,
  MASKED_ENV_VAR_VALUE,
  parseDotEnvImport,
} from "@/modules/deploy/environment-vars"
import { isValidEnvVarKey } from "@/modules/deploy/deploy.schema"
import type {
  EnvVar,
  EnvVarType,
  SharedSecretOption,
} from "@/modules/deploy/deploy.types"

type EnvVarsEditorProps = {
  envVars: EnvVar[]
  environmentId?: string
  onChange: (envVars: EnvVar[]) => void
  /** Use local controlled state for settings surfaces without a mutation API. */
  persistence?: "api" | "local"
  /** Existing stack id enables the audited Vault write/reveal endpoints. */
  stackId?: string
  sharedSecretOptions?: SharedSecretOption[]
  onRevealSecret?: (envVar: EnvVar) => Promise<string>
}

type EditorMode = "create" | "edit" | "import"
type EditableEnvVarType = Exclude<EnvVarType, "secret">

type EnvVarFormState = {
  id: string | null
  key: string
  value: string
  type: EditableEnvVarType
  scope: "all" | "build" | "runtime"
  sharedSecretOptionId: string
  valueVisible: boolean
}

type InlineToast = {
  id: string
  variant: "success" | "error"
  message: string
}

type VaultSecretReferenceResponse = {
  key: string
  type: "secret_ref"
  vaultPath: string
  vaultKey: string
  version: number
  updatedAt: string
}

type VaultWriteResponse = {
  ok?: boolean
  data?: {
    references?: VaultSecretReferenceResponse[]
  }
  message?: string
}

const createToastId = () => {
  return `toast-${Math.random().toString(36).slice(2, 10)}`
}

const createActivityId = () => {
  return `local-activity-${Math.random().toString(36).slice(2, 10)}`
}

const formatUpdatedAt = (value: string | undefined) => {
  if (!value) {
    return "-"
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return "-"
  }

  return date.toLocaleString()
}

const normalizeType = (type: EnvVarType | undefined): EditableEnvVarType => {
  if (type === "secret") {
    return "secret_ref"
  }

  return type ?? "plain"
}

const getTypeLabel = (type: EnvVarType | undefined) => {
  switch (normalizeType(type)) {
    case "secret_ref":
      return "Secret (Vault)"
    case "secret_shared_ref":
      return "Shared secret"
    default:
      return "Plain"
  }
}

const createEmptyForm = (): EnvVarFormState => {
  return {
    id: null,
    key: "",
    value: "",
    type: "plain",
    scope: "runtime",
    sharedSecretOptionId: "",
    valueVisible: false,
  }
}

const createFormFromEnvVar = (
  envVar: EnvVar,
  sharedSecretOptions: SharedSecretOption[]
): EnvVarFormState => {
  const type = normalizeType(envVar.type)
  const sharedSecretOption = sharedSecretOptions.find((option) => {
    return (
      option.id === envVar.serviceCredentialId ||
      option.serviceCredentialId === envVar.serviceCredentialId
    )
  })

  return {
    id: envVar.id,
    key: envVar.key,
    value: isSecretEnvVarType(type) ? "" : envVar.value,
    type,
    scope: envVar.scope ?? "runtime",
    sharedSecretOptionId:
      sharedSecretOption?.id ?? envVar.serviceCredentialId ?? "",
    valueVisible: false,
  }
}

const normalizeRows = (rows: EnvVar[]): EnvVar[] => {
  return rows.map((row) => {
    const type = normalizeType(row.type)
    return {
      ...row,
      type,
      scope: row.scope ?? "runtime",
      masked: isSecretEnvVarType(type) || Boolean(row.masked),
      isStoredSecret: isSecretEnvVarType(type)
        ? Boolean(row.isStoredSecret ?? true)
        : false,
    }
  })
}

const toEnvVarFromForm = (
  form: EnvVarFormState,
  sharedSecretOption: SharedSecretOption | undefined
): EnvVar => {
  const isSecret = isSecretEnvVarType(form.type)
  const isSharedReference = form.type === "secret_shared_ref"

  return {
    id: form.id ?? `env-${Math.random().toString(36).slice(2, 10)}`,
    key: form.key.trim().toUpperCase(),
    value: isSecret ? "" : form.value,
    type: form.type,
    scope: form.scope,
    masked: isSecret,
    isStoredSecret: isSecret,
    lastUpdatedAt: new Date().toISOString(),
    ...(form.type === "secret_ref" ? { source: "vault" as const } : {}),
    ...(isSharedReference && sharedSecretOption
      ? {
          source: "managed_service" as const,
          serviceCredentialId: sharedSecretOption.serviceCredentialId,
          vaultPath: sharedSecretOption.vaultPath,
          vaultKey: sharedSecretOption.vaultKey,
          referenceLabel: sharedSecretOption.label,
        }
      : {}),
  }
}

const preserveStoredSecretMetadata = (
  current: EnvVar | undefined,
  next: EnvVar,
  form: EnvVarFormState
): EnvVar => {
  if (!current || form.type !== "secret_ref" || form.value.trim()) {
    return next
  }

  return {
    ...next,
    source: current.source ?? next.source,
    vaultPath: current.vaultPath ?? next.vaultPath,
    vaultKey: current.vaultKey ?? next.vaultKey,
    version: current.version ?? next.version,
    referenceLabel: current.referenceLabel ?? next.referenceLabel,
    lastUpdatedAt: current.lastUpdatedAt ?? next.lastUpdatedAt,
  }
}

const toEnvVarFromApiRecord = (record: EnvVariableRecord): EnvVar => {
  return normalizeRows([record])[0]
}

const readResponse = async (response: Response) => {
  try {
    return (await response.json()) as VaultWriteResponse
  } catch {
    return null
  }
}

const writeVaultSecrets = async (input: {
  stackId: string
  environmentId: string
  secrets: Record<string, string>
}) => {
  const response = await fetch(`/api/stacks/${input.stackId}/secrets`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      environment: input.environmentId,
      secrets: input.secrets,
    }),
  })
  const payload = await readResponse(response)

  if (!response.ok || !payload?.ok || !payload.data?.references) {
    throw new Error(payload?.message ?? "Unable to save secrets to Vault.")
  }

  return payload.data.references
}

const revealVaultSecret = async (input: {
  stackId: string
  environmentId: string
  key: string
}) => {
  const response = await fetch(`/api/stacks/${input.stackId}/secrets/reveal`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      environment: input.environmentId,
      key: input.key,
    }),
  })
  const payload = (await readResponse(response)) as
    | (VaultWriteResponse & { data?: { value?: string } })
    | null

  if (!response.ok || !payload?.ok || typeof payload.data?.value !== "string") {
    throw new Error(payload?.message ?? "Unable to reveal this Vault secret.")
  }

  return payload.data.value
}

const createRowFromVaultReference = (
  form: EnvVarFormState,
  reference: VaultSecretReferenceResponse
): EnvVar => {
  return {
    ...toEnvVarFromForm(form, undefined),
    type: "secret_ref",
    value: "",
    source: "vault",
    vaultPath: reference.vaultPath,
    vaultKey: reference.vaultKey,
    version: reference.version,
    lastUpdatedAt: reference.updatedAt,
  }
}

export function EnvVarsEditor({
  envVars,
  environmentId = "staging",
  onChange,
  persistence = "api",
  stackId,
  sharedSecretOptions = [],
  onRevealSecret,
}: EnvVarsEditorProps) {
  const apiClient = useMemo(() => createEnvironmentVariablesClient(), [])
  const sharedSecretById = useMemo(() => {
    return new Map(sharedSecretOptions.map((option) => [option.id, option]))
  }, [sharedSecretOptions])

  const [searchQuery, setSearchQuery] = useState("")
  const [sheetOpen, setSheetOpen] = useState(false)
  const [mode, setMode] = useState<EditorMode>("create")
  const [formState, setFormState] = useState<EnvVarFormState>(createEmptyForm)
  const [importRaw, setImportRaw] = useState("")
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [visibilityById, setVisibilityById] = useState<Record<string, boolean>>(
    {}
  )
  const [revealedValuesById, setRevealedValuesById] = useState<
    Record<string, string>
  >({})
  const [revealingById, setRevealingById] = useState<Record<string, boolean>>(
    {}
  )
  const [toasts, setToasts] = useState<InlineToast[]>([])
  const [activities, setActivities] = useState<EnvVariableActivity[]>([])

  const normalizedRows = useMemo(() => normalizeRows(envVars), [envVars])
  const parsedImport = useMemo(() => parseDotEnvImport(importRaw), [importRaw])

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    if (!query) {
      return normalizedRows
    }

    return normalizedRows.filter((row) => {
      return (
        row.key.toLowerCase().includes(query) ||
        (row.scope ?? "runtime").toLowerCase().includes(query) ||
        getTypeLabel(row.type).toLowerCase().includes(query) ||
        (row.referenceLabel ?? "").toLowerCase().includes(query)
      )
    })
  }, [normalizedRows, searchQuery])

  const pushToast = (variant: InlineToast["variant"], message: string) => {
    const nextToast = { id: createToastId(), variant, message }
    setToasts((current) => [nextToast, ...current].slice(0, 4))
  }

  const pushActivity = (activity: EnvVariableActivity) => {
    setActivities((current) => [activity, ...current].slice(0, 8))
  }

  const pushValidationActivity = (message: string) => {
    pushActivity({
      id: createActivityId(),
      action: "validation_error",
      message,
      occurredAt: new Date().toISOString(),
    })
  }

  const applyMutationError = (error: EnvVariablesMutationError) => {
    pushToast("error", error.message)
    const detailSuffix = error.details?.length
      ? ` ${error.details.join(", ")}`
      : ""
    pushValidationActivity(`${error.message}${detailSuffix}`)
    setFormError(error.message)
  }

  const commitRows = (rows: EnvVar[]) => {
    onChange(normalizeRows(rows))
    setVisibilityById({})
    setRevealedValuesById({})
  }

  const openCreatePanel = () => {
    setMode("create")
    setFormState(createEmptyForm())
    setFormError(null)
    setSheetOpen(true)
  }

  const openEditPanel = (envVar: EnvVar) => {
    setMode("edit")
    setFormState(createFormFromEnvVar(envVar, sharedSecretOptions))
    setFormError(null)
    setSheetOpen(true)
  }

  const openImportPanel = () => {
    setMode("import")
    setImportRaw("")
    setFormError(null)
    setSheetOpen(true)
  }

  const validateFormState = (state: EnvVarFormState) => {
    const normalizedKey = state.key.trim().toUpperCase()
    const currentRow = state.id
      ? normalizedRows.find((row) => row.id === state.id)
      : undefined

    if (!normalizedKey) {
      return "Environment key is required."
    }

    if (!isValidEnvVarKey(normalizedKey)) {
      return "Key must match ^[A-Z][A-Z0-9_]*$."
    }

    const duplicate = normalizedRows.some((row) => {
      if (state.id && row.id === state.id) {
        return false
      }

      return row.key.trim().toUpperCase() === normalizedKey
    })

    if (duplicate) {
      return `Variable ${normalizedKey} already exists in ${environmentId}.`
    }

    if (
      currentRow &&
      normalizeType(currentRow.type) === "secret_ref" &&
      state.type === "secret_ref" &&
      state.value.trim().length === 0 &&
      currentRow.key.trim().toUpperCase() !== normalizedKey
    ) {
      return "Enter a new value before changing the key for a stored Vault secret."
    }

    if (state.value.length > ENV_VAR_MAX_VALUE_SIZE) {
      return `Environment value cannot exceed ${ENV_VAR_MAX_VALUE_SIZE} characters.`
    }

    if (state.type === "secret_shared_ref") {
      if (
        !state.sharedSecretOptionId ||
        !sharedSecretById.has(state.sharedSecretOptionId)
      ) {
        return "Choose a managed service secret reference."
      }
      return null
    }

    const editingStoredSecretWithoutValue =
      mode === "edit" &&
      state.type === "secret_ref" &&
      state.value.trim().length === 0

    if (!editingStoredSecretWithoutValue && state.value.trim().length === 0) {
      return "Environment value is required."
    }

    return null
  }

  const saveLocally = (form: EnvVarFormState) => {
    const current = form.id
      ? normalizedRows.find((item) => item.id === form.id)
      : undefined
    const row = preserveStoredSecretMetadata(
      current,
      toEnvVarFromForm(form, sharedSecretById.get(form.sharedSecretOptionId)),
      form
    )
    const nextRows =
      mode === "edit"
        ? normalizedRows.map((current) =>
            current.id === row.id ? row : current
          )
        : [row, ...normalizedRows]

    commitRows(nextRows)
    setFormError(null)
    setSheetOpen(false)
    pushToast(
      "success",
      `Variable ${row.key} ${mode === "edit" ? "updated" : "saved"}.`
    )
    pushActivity({
      id: createActivityId(),
      action: mode === "edit" ? "updated" : "created",
      message: `${mode === "edit" ? "Updated" : "Created"} ${row.key}.`,
      occurredAt: row.lastUpdatedAt ?? new Date().toISOString(),
    })
  }

  const saveVaultSecret = async (form: EnvVarFormState) => {
    if (!stackId || form.type !== "secret_ref" || !form.value.trim()) {
      return false
    }

    const references = await writeVaultSecrets({
      stackId,
      environmentId,
      secrets: { [form.key.trim().toUpperCase()]: form.value },
    })
    const reference = references.find(
      (item) => item.key === form.key.trim().toUpperCase()
    )

    if (!reference) {
      throw new Error("Vault did not return metadata for the saved secret.")
    }

    const row = createRowFromVaultReference(form, reference)
    const nextRows =
      mode === "edit"
        ? normalizedRows.map((current) =>
            current.id === row.id ? row : current
          )
        : [row, ...normalizedRows]

    commitRows(nextRows)
    setFormError(null)
    setSheetOpen(false)
    pushToast(
      "success",
      `Variable ${row.key} ${mode === "edit" ? "updated" : "saved"}.`
    )
    pushActivity({
      id: createActivityId(),
      action: mode === "edit" ? "updated" : "created",
      message: `${mode === "edit" ? "Updated" : "Created"} ${row.key} in Vault.`,
      occurredAt: row.lastUpdatedAt ?? new Date().toISOString(),
    })
    return true
  }

  const saveVariable = async () => {
    const validationMessage = validateFormState(formState)
    if (validationMessage) {
      setFormError(validationMessage)
      pushToast("error", validationMessage)
      pushValidationActivity(validationMessage)
      return
    }

    if (persistence === "local") {
      try {
        if (await saveVaultSecret(formState)) {
          return
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to save this secret."
        setFormError(message)
        pushToast("error", message)
        pushValidationActivity(message)
        return
      }
      saveLocally(formState)
      return
    }

    setIsSubmitting(true)

    try {
      const sharedSecretOption =
        formState.type === "secret_shared_ref"
          ? sharedSecretById.get(formState.sharedSecretOptionId)
          : undefined

      if (await saveVaultSecret(formState)) {
        return
      }

      if (mode === "edit" && formState.id) {
        const response = await apiClient.update({
          environmentId,
          variableId: formState.id,
          key: formState.key,
          value:
            formState.value.trim().length > 0 ? formState.value : undefined,
          type: formState.type,
          scope: formState.scope,
          serviceCredentialId: sharedSecretOption?.serviceCredentialId,
          vaultPath: sharedSecretOption?.vaultPath,
          vaultKey: sharedSecretOption?.vaultKey,
          referenceLabel: sharedSecretOption?.label,
        })

        if (!response.ok) {
          if (response.error === "NOT_FOUND") {
            saveLocally(formState)
            return
          }
          applyMutationError(response)
          return
        }

        const nextRows = normalizedRows.map((row) => {
          if (row.id !== formState.id || !response.item) {
            return row
          }
          return toEnvVarFromApiRecord(response.item)
        })

        commitRows(nextRows)
        setFormError(null)
        setSheetOpen(false)
        pushToast("success", response.message)
        pushActivity(response.activity)
        return
      }

      const response = await apiClient.create({
        environmentId,
        key: formState.key,
        value: formState.value,
        type: formState.type,
        scope: formState.scope,
        serviceCredentialId: sharedSecretOption?.serviceCredentialId,
        vaultPath: sharedSecretOption?.vaultPath,
        vaultKey: sharedSecretOption?.vaultKey,
        referenceLabel: sharedSecretOption?.label,
      })

      if (!response.ok) {
        applyMutationError(response)
        return
      }

      const nextRows = response.item
        ? [toEnvVarFromApiRecord(response.item), ...normalizedRows]
        : normalizedRows

      commitRows(nextRows)
      setFormError(null)
      setSheetOpen(false)
      pushToast("success", response.message)
      pushActivity(response.activity)
    } finally {
      setIsSubmitting(false)
    }
  }

  const validateImportEntries = () => {
    const duplicateKeys = new Set<string>()
    const oversizedKeys = new Set<string>()
    const invalidKeys = new Set<string>()
    const existingKeys = new Set(
      normalizedRows.map((row) => row.key.trim().toUpperCase())
    )
    const seenKeys = new Set<string>()

    for (const entry of parsedImport.entries) {
      const key = entry.key.trim().toUpperCase()

      if (!isValidEnvVarKey(key)) {
        invalidKeys.add(key)
      }
      if (entry.value.length > ENV_VAR_MAX_VALUE_SIZE) {
        oversizedKeys.add(key)
      }
      if (seenKeys.has(key) || existingKeys.has(key)) {
        duplicateKeys.add(key)
      }

      seenKeys.add(key)
    }

    const errors: string[] = []
    if (invalidKeys.size > 0) {
      errors.push(`Invalid keys: ${[...invalidKeys].sort().join(", ")}.`)
    }
    if (oversizedKeys.size > 0) {
      errors.push(
        `Values exceed ${ENV_VAR_MAX_VALUE_SIZE} characters: ${[
          ...oversizedKeys,
        ]
          .sort()
          .join(", ")}.`
      )
    }
    if (duplicateKeys.size > 0) {
      errors.push(
        `Import contains duplicate keys: ${[...duplicateKeys]
          .sort()
          .join(", ")}.`
      )
    }

    return errors
  }

  const importLocally = () => {
    const errors = validateImportEntries()

    if (errors.length > 0) {
      const message = errors.join(" ")
      setFormError(message)
      pushToast("error", message)
      pushValidationActivity(message)
      return
    }

    const now = new Date().toISOString()
    const rows = parsedImport.entries.map((entry) => ({
      id: `env-${Math.random().toString(36).slice(2, 10)}`,
      key: entry.key,
      value: entry.type === "plain" ? entry.value : "",
      type: entry.type,
      scope: "runtime" as const,
      masked: entry.type === "secret_ref",
      isStoredSecret: entry.type === "secret_ref",
      lastUpdatedAt: now,
      ...(entry.type === "secret_ref" ? { source: "vault" as const } : {}),
    }))

    commitRows([...rows, ...normalizedRows])
    setImportRaw("")
    setFormError(null)
    setSheetOpen(false)
    pushToast("success", `Imported ${rows.length} variables from .env.`)
    pushActivity({
      id: createActivityId(),
      action: "imported",
      message: `Imported ${rows.length} variables from .env.`,
      occurredAt: now,
    })
  }

  const importVariables = async () => {
    if (!importRaw.trim()) {
      const message = "Paste .env lines before importing."
      setFormError(message)
      pushToast("error", message)
      pushValidationActivity(message)
      return
    }

    if (parsedImport.errors.length > 0) {
      const message = "Fix invalid .env lines before importing."
      setFormError(`${message} ${parsedImport.errors.join(" ")}`)
      pushToast("error", message)
      pushValidationActivity(message)
      return
    }

    if (parsedImport.entries.length === 0) {
      const message = "No variables found to import."
      setFormError(message)
      pushToast("error", message)
      pushValidationActivity(message)
      return
    }

    const importValidationErrors = validateImportEntries()
    if (importValidationErrors.length > 0) {
      const message = importValidationErrors.join(" ")
      setFormError(message)
      pushToast("error", message)
      pushValidationActivity(message)
      return
    }

    if (persistence === "local") {
      if (stackId) {
        const secretEntries = parsedImport.entries.filter(
          (entry) => entry.type === "secret_ref"
        )
        if (secretEntries.length > 0) {
          setIsSubmitting(true)
          try {
            const references = await writeVaultSecrets({
              stackId,
              environmentId,
              secrets: Object.fromEntries(
                secretEntries.map((entry) => [entry.key, entry.value])
              ),
            })
            const referenceByKey = new Map(
              references.map((reference) => [reference.key, reference])
            )
            const now = new Date().toISOString()
            const rows = parsedImport.entries.map((entry) => {
              if (entry.type === "plain") {
                return {
                  id: `env-${Math.random().toString(36).slice(2, 10)}`,
                  key: entry.key,
                  value: entry.value,
                  type: "plain" as const,
                  scope: "runtime" as const,
                  masked: false,
                  isStoredSecret: false,
                  lastUpdatedAt: now,
                }
              }
              const reference = referenceByKey.get(entry.key)
              return reference
                ? createRowFromVaultReference(
                    {
                      ...createEmptyForm(),
                      key: entry.key,
                      value: "",
                      type: "secret_ref",
                      scope: "runtime",
                    },
                    reference
                  )
                : toEnvVarFromForm(
                    {
                      ...createEmptyForm(),
                      key: entry.key,
                      value: "",
                      type: "secret_ref",
                      scope: "runtime",
                    },
                    undefined
                  )
            })
            commitRows([...rows, ...normalizedRows])
            setImportRaw("")
            setFormError(null)
            setSheetOpen(false)
            pushToast("success", `Imported ${rows.length} variables from .env.`)
            pushActivity({
              id: createActivityId(),
              action: "imported",
              message: `Imported ${rows.length} variables from .env into Vault.`,
              occurredAt: now,
            })
          } catch (error) {
            const message =
              error instanceof Error
                ? error.message
                : "Unable to import secrets into Vault."
            setFormError(message)
            pushToast("error", message)
            pushValidationActivity(message)
          } finally {
            setIsSubmitting(false)
          }
          return
        }
      }
      importLocally()
      return
    }

    setIsSubmitting(true)
    try {
      const response = await apiClient.import({
        environmentId,
        raw: importRaw,
        scope: "runtime",
      })

      if (!response.ok) {
        applyMutationError(response)
        return
      }

      const latest = await apiClient.list(environmentId)
      commitRows(latest)
      setImportRaw("")
      setFormError(null)
      setSheetOpen(false)
      pushToast("success", response.message)
      pushActivity(response.activity)
    } finally {
      setIsSubmitting(false)
    }
  }

  const addPreset = (key: string) => {
    setMode("create")
    setFormState({
      ...createEmptyForm(),
      key,
      type: inferEnvVarTypeFromKey(key),
    })
    setFormError(null)
    setSheetOpen(true)
  }

  const revealSecret = async (row: EnvVar) => {
    if (row.type === "secret_shared_ref") {
      const message = `${row.key} is a shared reference and cannot be copied from this screen.`
      pushToast("error", message)
      pushValidationActivity(message)
      return
    }

    if (revealedValuesById[row.id] !== undefined) {
      setRevealedValuesById((current) => {
        const next = { ...current }
        delete next[row.id]
        return next
      })
      setVisibilityById((current) => ({ ...current, [row.id]: false }))
      return
    }

    setRevealingById((current) => ({ ...current, [row.id]: true }))
    try {
      const value = onRevealSecret
        ? await onRevealSecret(row)
        : stackId
          ? await revealVaultSecret({
              stackId,
              environmentId,
              key: row.key,
            })
          : null

      if (value === null) {
        throw new Error(
          "Vault reveal is available after this application has been saved."
        )
      }

      setRevealedValuesById((current) => ({ ...current, [row.id]: value }))
      setVisibilityById((current) => ({ ...current, [row.id]: true }))
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to reveal this secret."
      pushToast("error", message)
      pushValidationActivity(message)
    } finally {
      setRevealingById((current) => ({ ...current, [row.id]: false }))
    }
  }

  const togglePlainVisibility = (row: EnvVar) => {
    setVisibilityById((current) => ({
      ...current,
      [row.id]: !current[row.id],
    }))
  }

  const deleteVariable = async (row: EnvVar) => {
    if (persistence === "local") {
      commitRows(normalizedRows.filter((item) => item.id !== row.id))
      pushToast("success", `Variable ${row.key} deleted.`)
      pushActivity({
        id: createActivityId(),
        action: "deleted",
        message: `Deleted ${row.key}.`,
        occurredAt: new Date().toISOString(),
      })
      return
    }

    setIsSubmitting(true)
    try {
      const response = await apiClient.remove({
        environmentId,
        variableId: row.id,
      })

      if (!response.ok) {
        if (response.error === "NOT_FOUND") {
          commitRows(normalizedRows.filter((item) => item.id !== row.id))
          pushToast("success", `Variable ${row.key} deleted.`)
          return
        }
        applyMutationError(response)
        return
      }

      commitRows(normalizedRows.filter((item) => item.id !== row.id))
      pushToast("success", response.message)
      pushActivity(response.activity)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Input
          aria-label="Search environment variables"
          value={searchQuery}
          placeholder="Search key, type, or scope"
          onChange={(event) => setSearchQuery(event.target.value)}
        />
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={openImportPanel}
          >
            <KeyRound data-icon="inline-start" />
            Import .env
          </Button>
          <Button type="button" size="sm" onClick={openCreatePanel}>
            <Plus data-icon="inline-start" />
            Add variable
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Quick start:</span>
        {LARAVEL_ENV_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            className="rounded-full border border-border bg-muted/40 px-2 py-1 font-mono text-[11px] hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => addPreset(preset)}
          >
            {preset}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Key</th>
              <th className="px-3 py-2 font-medium">Value</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Scope</th>
              <th className="px-3 py-2 font-medium">Last updated</th>
              <th className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td
                  className="px-3 py-8 text-center text-xs text-muted-foreground"
                  colSpan={6}
                >
                  No variables match the current filters.
                </td>
              </tr>
            ) : null}
            {filteredRows.map((row) => {
              const isSecret = isSecretEnvVarType(row.type)
              const isSharedReference = row.type === "secret_shared_ref"
              const revealedValue = revealedValuesById[row.id]
              const isVisible = Boolean(visibilityById[row.id])
              const shownValue = isSecret
                ? isVisible && revealedValue !== undefined
                  ? revealedValue
                  : MASKED_ENV_VAR_VALUE
                : isVisible
                  ? row.value
                  : getEnvVarPreviewValue(row)

              return (
                <tr key={row.id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">
                    <span className="font-mono text-xs">{row.key}</span>
                    {row.referenceLabel ? (
                      <span className="mt-1 block text-[11px] text-muted-foreground">
                        {row.referenceLabel}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {shownValue || MASKED_ENV_VAR_VALUE}
                  </td>
                  <td className="px-3 py-2">
                    <Badge
                      variant={
                        isSharedReference
                          ? "outline"
                          : isSecret
                            ? "warning"
                            : "secondary"
                      }
                    >
                      {isSharedReference ? (
                        <Link2 data-icon="inline-start" />
                      ) : null}
                      {getTypeLabel(row.type)}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-xs uppercase">
                    {row.scope ?? "runtime"}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {formatUpdatedAt(row.lastUpdatedAt)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {!isSharedReference ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (isSecret) {
                              void revealSecret(row)
                            } else {
                              togglePlainVisibility(row)
                            }
                          }}
                          disabled={Boolean(revealingById[row.id])}
                        >
                          {isSecret ? (
                            isVisible ? (
                              <EyeOff data-icon="inline-start" />
                            ) : (
                              <Eye data-icon="inline-start" />
                            )
                          ) : isVisible ? (
                            <EyeOff data-icon="inline-start" />
                          ) : (
                            <Eye data-icon="inline-start" />
                          )}
                          {revealingById[row.id]
                            ? "Revealing..."
                            : isSecret
                              ? isVisible
                                ? "Hide"
                                : "Reveal"
                              : isVisible
                                ? "Hide"
                                : "Show"}
                        </Button>
                      ) : (
                        <span className="px-2 py-1 text-[11px] text-muted-foreground">
                          Reference only
                        </span>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditPanel(row)}
                      >
                        <Pencil data-icon="inline-start" />
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          void deleteVariable(row)
                        }}
                      >
                        <Trash2 data-icon="inline-start" />
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {toasts.length > 0 ? (
        <div className="flex flex-col gap-1" aria-label="Environment toasts">
          {toasts.map((toast) => (
            <p
              key={toast.id}
              className={
                toast.variant === "success"
                  ? "rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700"
                  : "rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
              }
            >
              {toast.message}
            </p>
          ))}
        </div>
      ) : null}

      <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/30 p-3">
        <p className="text-xs font-medium">Activity timeline</p>
        {activities.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No variable activity yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
            {activities.map((activity) => (
              <li key={activity.id}>
                {formatUpdatedAt(activity.occurredAt)} - {activity.message}
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Key format: <code>UPPER_SNAKE_CASE</code>. Duplicate keys are blocked
        per environment ({environmentId}).
      </p>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>
              {mode === "import"
                ? "Import environment variables"
                : mode === "edit"
                  ? "Edit variable"
                  : "Add environment variable"}
            </SheetTitle>
            <SheetDescription>
              {mode === "import"
                ? "Paste .env content, review detected types, then import."
                : "Choose where this value lives before saving it."}
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-4 px-6">
            {mode === "import" ? (
              <>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium">.env payload</span>
                  <Textarea
                    aria-label=".env payload"
                    className="min-h-48 font-mono text-xs"
                    value={importRaw}
                    placeholder={
                      "APP_ENV=staging\nDATABASE_URL=postgres://...\nREDIS_URL=redis://..."
                    }
                    onChange={(event) => setImportRaw(event.target.value)}
                  />
                </label>

                {parsedImport.errors.length > 0 ? (
                  <Alert variant="destructive">
                    <AlertDescription>
                      {parsedImport.errors.join(" ")}
                    </AlertDescription>
                  </Alert>
                ) : null}

                <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/30 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium">Import preview</p>
                    <Badge variant="secondary">
                      {parsedImport.entries.length} variable
                      {parsedImport.entries.length === 1 ? "" : "s"}
                    </Badge>
                  </div>
                  {parsedImport.entries.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Paste one `KEY=VALUE` entry per line.
                    </p>
                  ) : (
                    <div className="flex max-h-56 flex-col gap-1 overflow-y-auto">
                      {parsedImport.entries.map((entry, index) => (
                        <div
                          key={`${entry.key}-${index}`}
                          className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-background px-2 py-1.5 text-xs"
                        >
                          <span className="font-mono font-medium">
                            {entry.key}
                          </span>
                          <span className="flex items-center gap-2">
                            <span className="font-mono text-muted-foreground">
                              {entry.type === "secret_ref"
                                ? MASKED_ENV_VAR_VALUE
                                : entry.value}
                            </span>
                            <Badge
                              variant={
                                entry.type === "secret_ref"
                                  ? "warning"
                                  : "secondary"
                              }
                            >
                              {getTypeLabel(entry.type)}
                            </Badge>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <p className="text-xs text-muted-foreground">
                  Keys containing `SECRET`, `TOKEN`, `PASSWORD`, `PRIVATE`, or
                  `CREDENTIAL` are treated as Vault secrets. Secret values are
                  masked before they enter the saved row state.
                </p>
              </>
            ) : (
              <>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium">Key</span>
                  <Input
                    aria-label="Variable key"
                    value={formState.key}
                    aria-invalid={Boolean(formError)}
                    onChange={(event) => {
                      setFormState((current) => {
                        const key = event.target.value.toUpperCase()
                        return {
                          ...current,
                          key,
                          type: current.id
                            ? current.type
                            : inferEnvVarTypeFromKey(key),
                        }
                      })
                    }}
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium">Type</span>
                  <select
                    aria-label="Variable type"
                    className="h-8 w-full rounded-2xl border border-transparent bg-input/50 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
                    value={formState.type}
                    onChange={(event) => {
                      const nextType = event.target.value as EditableEnvVarType
                      setFormState((current) => ({
                        ...current,
                        type: nextType,
                        value:
                          nextType === "secret_shared_ref" ? "" : current.value,
                      }))
                    }}
                  >
                    <option value="plain">Plain (ConfigMap)</option>
                    <option value="secret_ref">Secret (Vault)</option>
                    <option value="secret_shared_ref">
                      Shared secret reference
                    </option>
                  </select>
                </label>

                {formState.type === "secret_shared_ref" ? (
                  <div className="flex flex-col gap-2">
                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium">
                        Managed service secret
                      </span>
                      <select
                        aria-label="Shared secret reference"
                        className="h-8 w-full rounded-2xl border border-transparent bg-input/50 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
                        value={formState.sharedSecretOptionId}
                        onChange={(event) =>
                          setFormState((current) => ({
                            ...current,
                            sharedSecretOptionId: event.target.value,
                          }))
                        }
                      >
                        <option value="">Choose a managed service</option>
                        {sharedSecretOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label} ({option.serviceType})
                          </option>
                        ))}
                      </select>
                    </label>
                    {sharedSecretOptions.length === 0 ? (
                      <Alert>
                        <AlertDescription>
                          No managed service secret references are available for
                          this tenant yet.
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        The selected connection string or password stays in the
                        managed service. This row stores only its reference.
                      </p>
                    )}
                  </div>
                ) : (
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium">Value</span>
                    <div className="flex items-center gap-2">
                      <Input
                        aria-label="Variable value"
                        type={
                          formState.type === "secret_ref" &&
                          !formState.valueVisible
                            ? "password"
                            : "text"
                        }
                        value={formState.value}
                        placeholder={
                          mode === "edit" && formState.type === "secret_ref"
                            ? "Enter a new value to rotate"
                            : "Set variable value"
                        }
                        onChange={(event) =>
                          setFormState((current) => ({
                            ...current,
                            value: event.target.value,
                          }))
                        }
                      />
                      {formState.type === "secret_ref" ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          aria-label={
                            formState.valueVisible ? "Hide value" : "Show value"
                          }
                          onClick={() =>
                            setFormState((current) => ({
                              ...current,
                              valueVisible: !current.valueVisible,
                            }))
                          }
                        >
                          {formState.valueVisible ? <EyeOff /> : <Eye />}
                        </Button>
                      ) : null}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Maximum {ENV_VAR_MAX_VALUE_SIZE} characters.
                    </span>
                  </label>
                )}

                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium">Scope</span>
                  <select
                    aria-label="Variable scope"
                    className="h-8 w-full rounded-2xl border border-transparent bg-input/50 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
                    value={formState.scope}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        scope: event.target.value as EnvVarFormState["scope"],
                      }))
                    }
                  >
                    <option value="runtime">Runtime</option>
                    <option value="build">Build</option>
                    <option value="all">All</option>
                  </select>
                </label>
              </>
            )}

            {formError ? (
              <p className="text-xs text-destructive" role="alert">
                {formError}
              </p>
            ) : null}
          </div>

          <SheetFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSheetOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (mode === "import") {
                  void importVariables()
                  return
                }
                void saveVariable()
              }}
              disabled={
                isSubmitting ||
                (mode === "import" &&
                  (parsedImport.entries.length === 0 ||
                    parsedImport.errors.length > 0))
              }
            >
              {isSubmitting
                ? "Saving..."
                : mode === "import"
                  ? "Import variables"
                  : mode === "edit"
                    ? "Save changes"
                    : "Save variable"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
