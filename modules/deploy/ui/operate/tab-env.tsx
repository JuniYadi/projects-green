"use client"

import { useMemo } from "react"
import { usePathname } from "next/navigation"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
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

const applyEnvVarUpdates = (
  currentRows: EnvVar[],
  updates: Record<string, string>
): EnvVar[] => {
  const nextRows = [...currentRows]
  for (const [key, value] of Object.entries(updates)) {
    const idx = nextRows.findIndex((r) => r.key === key)
    if (idx >= 0) {
      nextRows[idx] = {
        ...nextRows[idx],
        value,
        lastUpdatedAt: new Date().toISOString(),
      }
    } else {
      nextRows.push({
        id: `env-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        key,
        value,
        type: "plain",
        scope: "runtime",
        lastUpdatedAt: new Date().toISOString(),
      })
    }
  }
  return nextRows
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
    handleEnvVarsChange(applyEnvVarUpdates(editorEnvVars, { [key]: value }))
  }

  const handleApplyBatch = (updates: Record<string, string>) => {
    handleEnvVarsChange(applyEnvVarUpdates(editorEnvVars, updates))
  }

  const pathname = usePathname()
  const locale = resolveLocaleOrDefault(pathname)
  const messages = getMessages(locale).console.deploy.tabEnv

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
              {messages.title}
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              {messages.description.replace("{env}", selectedEnv)}
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
