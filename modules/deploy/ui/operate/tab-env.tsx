"use client"

import { useMemo } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { EnvVarsEditor } from "@/modules/deploy/ui/env-vars-editor"
import { RuntimeQuickTuningCard } from "@/modules/deploy/ui/runtime-quick-tuning-card"
import { isSecretEnvVarType } from "@/modules/deploy/environment-vars"
import type { EnvVar, SharedSecretOption } from "@/modules/deploy/deploy.types"
import type {
  EnvVar as OperateEnvVar,
  K8sEnvironmentId,
} from "@/modules/deploy/operate.types"

type TabEnvProps = {
  selectedEnv: K8sEnvironmentId
  envVars: Record<K8sEnvironmentId, OperateEnvVar[]>
  setEnvVars: React.Dispatch<
    React.SetStateAction<Record<K8sEnvironmentId, OperateEnvVar[]>>
  >
  onPersist?: (rows: OperateEnvVar[]) => Promise<void>
  stackId?: string
  framework?: string | null
  templateName?: string | null
  sharedSecretOptions?: SharedSecretOption[]
}

const toEditorEnvVars = (rows: OperateEnvVar[]): EnvVar[] => {
  return rows.map((row) => {
    const type = row.type ?? (row.isSecret ? "secret_ref" : "plain")

    return {
      id: row.id,
      key: row.key,
      value: row.value,
      type,
      scope: row.scope ?? "runtime",
      masked: row.masked ?? row.isSecret,
      isStoredSecret: row.isStoredSecret ?? row.isSecret,
      lastUpdatedAt: row.updatedAt,
      source: row.source,
      serviceCredentialId: row.serviceCredentialId,
      vaultPath: row.vaultPath,
      vaultKey: row.vaultKey,
      version: row.version,
      referenceLabel: row.referenceLabel,
    }
  })
}

const toOperateEnvVars = (rows: EnvVar[]): OperateEnvVar[] => {
  return rows.map((row) => {
    const isSecret = isSecretEnvVarType(row.type)

    return {
      id: row.id,
      key: row.key,
      value: isSecret ? "" : row.value,
      isSecret,
      updatedAt: row.lastUpdatedAt ?? new Date().toISOString(),
      type: row.type,
      scope: row.scope,
      masked: row.masked,
      isStoredSecret: row.isStoredSecret,
      source: row.source,
      serviceCredentialId: row.serviceCredentialId,
      vaultPath: row.vaultPath,
      vaultKey: row.vaultKey,
      version: row.version,
      referenceLabel: row.referenceLabel,
    }
  })
}

export function TabEnv({
  selectedEnv,
  envVars,
  setEnvVars,
  onPersist,
  stackId,
  framework,
  templateName,
  sharedSecretOptions = [],
}: TabEnvProps) {
  const editorEnvVars = useMemo(
    () => toEditorEnvVars(envVars[selectedEnv]),
    [envVars, selectedEnv]
  )

  const handleEnvVarsChange = (rows: EnvVar[]) => {
    const nextRows = toOperateEnvVars(rows)
    setEnvVars((current) => ({
      ...current,
      [selectedEnv]: nextRows,
    }))
    void onPersist?.(nextRows)
  }

  const handleApplyEnvVar = (key: string, value: string) => {
    const currentRows = [...editorEnvVars]
    const idx = currentRows.findIndex((r) => r.key === key)
    if (idx >= 0) {
      currentRows[idx] = {
        ...currentRows[idx],
        value,
        lastUpdatedAt: new Date().toISOString(),
      }
    } else {
      currentRows.push({
        id: `env-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        key,
        value,
        type: "plain",
        scope: "runtime",
        lastUpdatedAt: new Date().toISOString(),
      })
    }
    handleEnvVarsChange(currentRows)
  }

  const handleApplyBatch = (updates: Record<string, string>) => {
    const currentRows = [...editorEnvVars]
    for (const [key, value] of Object.entries(updates)) {
      const idx = currentRows.findIndex((r) => r.key === key)
      if (idx >= 0) {
        currentRows[idx] = {
          ...currentRows[idx],
          value,
          lastUpdatedAt: new Date().toISOString(),
        }
      } else {
        currentRows.push({
          id: `env-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          key,
          value,
          type: "plain",
          scope: "runtime",
          lastUpdatedAt: new Date().toISOString(),
        })
      }
    }
    handleEnvVarsChange(currentRows)
  }

  return (
    <div className="space-y-6">
      <RuntimeQuickTuningCard
        framework={framework}
        envVars={editorEnvVars}
        onApplyEnvVar={handleApplyEnvVar}
        onApplyBatch={handleApplyBatch}
      />
      <Card size="sm" className="border-border bg-card shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-base font-bold text-foreground">
              Environment Variables
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Manage configuration and secrets for the {selectedEnv}{" "}
              environment.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <EnvVarsEditor
            envVars={editorEnvVars}
            environmentId={selectedEnv}
            onChange={handleEnvVarsChange}
            persistence="local"
            stackId={stackId}
            framework={framework}
            templateName={templateName}
            sharedSecretOptions={sharedSecretOptions}
          />
        </CardContent>
      </Card>
    </div>
  )
}
