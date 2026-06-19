import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  EnvVariablesMutationError,
} from "@/modules/deploy/api/environment-variables.contract"
import {
  ENV_VAR_MAX_VALUE_SIZE,
  LARAVEL_ENV_PRESETS,
  getEnvVarPreviewValue,
  inferEnvVarTypeFromKey,
} from "@/modules/deploy/environment-vars"
import { isValidEnvVarKey } from "@/modules/deploy/deploy.schema"
import type { EnvVar } from "@/modules/deploy/deploy.types"

type EnvVarsEditorProps = {
  envVars: EnvVar[]
  environmentId?: string
  onChange: (envVars: EnvVar[]) => void
}

type EditorMode = "create" | "edit" | "import"

type EnvVarFormState = {
  id: string | null
  key: string
  value: string
  type: "plain" | "secret"
  scope: "all" | "build" | "runtime"
}

type InlineToast = {
  id: string
  variant: "success" | "error"
  message: string
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

const toEnvVarFromForm = (form: EnvVarFormState): EnvVar => {
  return {
    id: form.id ?? `env-${Math.random().toString(36).slice(2, 10)}`,
    key: form.key.trim().toUpperCase(),
    value: form.type === "secret" ? "" : form.value,
    type: form.type,
    scope: form.scope,
    masked: form.type === "secret",
    isStoredSecret: form.type === "secret",
    lastUpdatedAt: new Date().toISOString(),
  }
}

const createEmptyForm = (): EnvVarFormState => {
  return {
    id: null,
    key: "",
    value: "",
    type: "plain",
    scope: "runtime",
  }
}

const createFormFromEnvVar = (envVar: EnvVar): EnvVarFormState => {
  return {
    id: envVar.id,
    key: envVar.key,
    value: envVar.type === "secret" ? "" : envVar.value,
    type: envVar.type ?? "plain",
    scope: envVar.scope ?? "runtime",
  }
}

const normalizeRows = (rows: EnvVar[]) => {
  return rows.map((row) => {
    return {
      ...row,
      type: row.type ?? inferEnvVarTypeFromKey(row.key),
      scope: row.scope ?? "runtime",
      masked: row.type === "secret" ? true : Boolean(row.masked),
      isStoredSecret:
        row.type === "secret" ? Boolean(row.isStoredSecret ?? true) : false,
    }
  })
}

export function EnvVarsEditor({
  envVars,
  environmentId = "staging",
  onChange,
}: EnvVarsEditorProps) {
  const apiClient = useMemo(() => createEnvironmentVariablesClient(), [])

  const [searchQuery, setSearchQuery] = useState("")
  const [sheetOpen, setSheetOpen] = useState(false)
  const [mode, setMode] = useState<EditorMode>("create")
  const [formState, setFormState] = useState<EnvVarFormState>(createEmptyForm())
  const [importRaw, setImportRaw] = useState("")
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [visibilityById, setVisibilityById] = useState<Record<string, boolean>>(
    {}
  )
  const [toasts, setToasts] = useState<InlineToast[]>([])
  const [activities, setActivities] = useState<EnvVariableActivity[]>([])

  const normalizedRows = useMemo(() => normalizeRows(envVars), [envVars])

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    if (!query) {
      return normalizedRows
    }

    return normalizedRows.filter((row) => {
      return (
        row.key.toLowerCase().includes(query) ||
        (row.scope ?? "runtime").toLowerCase().includes(query) ||
        (row.type ?? "plain").toLowerCase().includes(query)
      )
    })
  }, [normalizedRows, searchQuery])

  const pushToast = (variant: "success" | "error", message: string) => {
    const nextToast = {
      id: createToastId(),
      variant,
      message,
    }

    setToasts((current) => {
      const next = [nextToast, ...current]
      return next.slice(0, 4)
    })
  }

  const pushActivity = (activity: EnvVariableActivity) => {
    setActivities((current) => {
      const next = [activity, ...current]
      return next.slice(0, 8)
    })
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

  const openCreatePanel = () => {
    setMode("create")
    setFormState(createEmptyForm())
    setFormError(null)
    setSheetOpen(true)
  }

  const openEditPanel = (envVar: EnvVar) => {
    setMode("edit")
    setFormState(createFormFromEnvVar(envVar))
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

    if (state.value.length > ENV_VAR_MAX_VALUE_SIZE) {
      return `Environment value cannot exceed ${ENV_VAR_MAX_VALUE_SIZE} characters.`
    }

    const editingSecretWithoutValue =
      mode === "edit" &&
      state.type === "secret" &&
      state.value.trim().length === 0

    if (!editingSecretWithoutValue && state.value.trim().length === 0) {
      return "Environment value is required."
    }

    return null
  }

  const saveVariable = async () => {
    const validationMessage = validateFormState(formState)
    if (validationMessage) {
      setFormError(validationMessage)
      pushToast("error", validationMessage)
      pushValidationActivity(validationMessage)
      return
    }

    setIsSubmitting(true)

    if (mode === "edit" && formState.id) {
      const response = await apiClient.update({
        environmentId,
        variableId: formState.id,
        key: formState.key,
        value: formState.value.trim().length > 0 ? formState.value : undefined,
        type: formState.type,
        scope: formState.scope,
      })

      setIsSubmitting(false)

      if (!response.ok) {
        if (response.error === "NOT_FOUND") {
          const fallbackRow = toEnvVarFromForm(formState)
          const fallbackRows = normalizedRows.map((row) => {
            if (row.id !== fallbackRow.id) {
              return row
            }

            return fallbackRow
          })

          onChange(normalizeRows(fallbackRows))
          setFormError(null)
          setSheetOpen(false)
          pushToast("success", `Variable ${fallbackRow.key} updated.`)
          pushActivity({
            id: createActivityId(),
            action: "updated",
            message: `Updated ${fallbackRow.key}.`,
            occurredAt: fallbackRow.lastUpdatedAt ?? new Date().toISOString(),
          })
          return
        }

        applyMutationError(response)
        return
      }

      const updated = response.item ? [response.item] : []
      const nextRows = normalizedRows.map((row) => {
        const match = updated.find((item) => item.id === row.id)

        if (!match) {
          return row
        }

        return match
      })

      onChange(normalizeRows(nextRows))
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
    })

    setIsSubmitting(false)

    if (!response.ok) {
      applyMutationError(response)
      return
    }

    const nextRows = response.item
      ? [response.item, ...normalizedRows]
      : normalizedRows

    onChange(normalizeRows(nextRows))
    setFormError(null)
    setSheetOpen(false)
    pushToast("success", response.message)
    pushActivity(response.activity)
  }

  const deleteVariable = async (row: EnvVar) => {
    setIsSubmitting(true)

    const response = await apiClient.remove({
      environmentId,
      variableId: row.id,
    })

    setIsSubmitting(false)

    if (!response.ok) {
      if (response.error === "NOT_FOUND") {
        const nextRows = normalizedRows.filter((item) => item.id !== row.id)

        onChange(nextRows)
        pushToast("success", `Variable ${row.key} deleted.`)
        pushActivity({
          id: createActivityId(),
          action: "deleted",
          message: `Deleted ${row.key}.`,
          occurredAt: new Date().toISOString(),
        })
        return
      }

      applyMutationError(response)
      return
    }

    const nextRows = normalizedRows.filter((item) => item.id !== row.id)

    onChange(nextRows)
    pushToast("success", response.message)
    pushActivity(response.activity)
  }

  const importVariables = async () => {
    if (!importRaw.trim()) {
      const message = "Paste .env lines before importing."
      setFormError(message)
      pushToast("error", message)
      pushValidationActivity(message)
      return
    }

    setIsSubmitting(true)

    const response = await apiClient.import({
      environmentId,
      raw: importRaw,
      scope: "runtime",
    })

    if (!response.ok) {
      setIsSubmitting(false)
      applyMutationError(response)
      return
    }

    const latest = await apiClient.list(environmentId)

    setIsSubmitting(false)
    onChange(normalizeRows(latest))
    setFormError(null)
    setSheetOpen(false)
    pushToast("success", response.message)
    pushActivity(response.activity)
  }

  const addPreset = (key: string) => {
    setMode("create")
    setFormState({
      id: null,
      key,
      value: "",
      type: inferEnvVarTypeFromKey(key),
      scope: "runtime",
    })
    setFormError(null)
    setSheetOpen(true)
  }

  const toggleMask = (row: EnvVar) => {
    if (row.type === "secret") {
      const message = `${row.key} is stored as a secret and cannot be revealed after save.`
      pushToast("error", message)
      pushValidationActivity(message)
      return
    }

    setVisibilityById((current) => {
      return {
        ...current,
        [row.id]: !current[row.id],
      }
    })
  }

  return (
    <div className="space-y-3">
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
            Import .env
          </Button>
          <Button type="button" size="sm" onClick={openCreatePanel}>
            Add variable
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {LARAVEL_ENV_PRESETS.map((preset) => {
          return (
            <button
              key={preset}
              type="button"
              className="rounded-md border border-border bg-muted/40 px-2 py-1 text-xs hover:bg-muted"
              onClick={() => addPreset(preset)}
            >
              {preset}
            </button>
          )
        })}
      </div>

      <div className="overflow-x-auto border border-border">
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
                  className="px-3 py-4 text-xs text-muted-foreground"
                  colSpan={6}
                >
                  No variables match the current filters.
                </td>
              </tr>
            ) : null}
            {filteredRows.map((row) => {
              const shownValue = visibilityById[row.id]
                ? row.value
                : getEnvVarPreviewValue(row)

              return (
                <tr key={row.id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{row.key}</td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {shownValue || "********"}
                  </td>
                  <td className="px-3 py-2 text-xs uppercase">{row.type}</td>
                  <td className="px-3 py-2 text-xs uppercase">{row.scope}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {formatUpdatedAt(row.lastUpdatedAt)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleMask(row)}
                      >
                        {visibilityById[row.id] ? "Hide" : "Show"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditPanel(row)}
                      >
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
        <div className="space-y-1" aria-label="Environment toasts">
          {toasts.map((toast) => {
            return (
              <p
                key={toast.id}
                className={
                  toast.variant === "success"
                    ? "border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-700"
                    : "border border-destructive/30 bg-destructive/10 px-2 py-1 text-xs text-destructive"
                }
              >
                {toast.message}
              </p>
            )
          })}
        </div>
      ) : null}

      <div className="space-y-2 border border-border bg-muted/30 p-3">
        <p className="text-xs font-medium">Activity timeline</p>
        {activities.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No variable activity yet.
          </p>
        ) : (
          <ul className="space-y-1 text-xs text-muted-foreground">
            {activities.map((activity) => {
              return (
                <li key={activity.id}>
                  {formatUpdatedAt(activity.occurredAt)} - {activity.message}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Key format: <code>UPPER_SNAKE_CASE</code>. Duplicate keys are blocked
        per environment ({environmentId}).
      </p>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="overflow-y-auto">
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
                ? "Paste .env content to import variables safely."
                : "Set key, value, type, and scope for this variable."}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-3 px-4">
            {mode === "import" ? (
              <label className="space-y-1">
                <span className="text-xs font-medium">.env payload</span>
                <textarea
                  aria-label=".env payload"
                  className="min-h-48 w-full rounded-md border border-input bg-transparent p-2 text-xs"
                  value={importRaw}
                  onChange={(event) => setImportRaw(event.target.value)}
                />
              </label>
            ) : (
              <>
                <label className="space-y-1">
                  <span className="text-xs font-medium">Key</span>
                  <Input
                    aria-label="Variable key"
                    value={formState.key}
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

                <label className="space-y-1">
                  <span className="text-xs font-medium">Value</span>
                  <Input
                    aria-label="Variable value"
                    value={formState.value}
                    placeholder={
                      mode === "edit" && formState.type === "secret"
                        ? "Enter a new value to rotate"
                        : "Set variable value"
                    }
                    onChange={(event) => {
                      setFormState((current) => {
                        return {
                          ...current,
                          value: event.target.value,
                        }
                      })
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum {ENV_VAR_MAX_VALUE_SIZE} characters.
                  </p>
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-medium">Type</span>
                  <select
                    aria-label="Variable type"
                    className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                    value={formState.type}
                    onChange={(event) => {
                      const nextType = event.target.value as "plain" | "secret"
                      setFormState((current) => {
                        return {
                          ...current,
                          type: nextType,
                        }
                      })
                    }}
                  >
                    <option value="plain">Plain</option>
                    <option value="secret">Secret</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-medium">Scope</span>
                  <select
                    aria-label="Variable scope"
                    className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                    value={formState.scope}
                    onChange={(event) => {
                      setFormState((current) => {
                        return {
                          ...current,
                          scope: event.target.value as
                            | "all"
                            | "build"
                            | "runtime",
                        }
                      })
                    }}
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
              disabled={isSubmitting}
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
