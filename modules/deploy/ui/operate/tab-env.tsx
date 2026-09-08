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
  stackId?: string
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
  stackId,
  sharedSecretOptions = [],
}: TabEnvProps) {
  const editorEnvVars = useMemo(
    () => toEditorEnvVars(envVars[selectedEnv]),
    [envVars, selectedEnv]
  )

  const handleEnvVarsChange = (rows: EnvVar[]) => {
    setEnvVars((current) => ({
      ...current,
      [selectedEnv]: toOperateEnvVars(rows),
    }))
  }

  return (
    <div className="space-y-6">
      <Card size="sm" className="border-border bg-card shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-base font-bold text-foreground">
              Environment Variables
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Plain configuration, Vault secrets, and managed-service references
              for the {selectedEnv} environment.
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
            sharedSecretOptions={sharedSecretOptions}
          />
        </CardContent>
      </Card>
    </div>
  )
}
