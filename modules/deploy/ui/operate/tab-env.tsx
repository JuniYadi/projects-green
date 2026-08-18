"use client"

import { useMemo, useState } from "react"
import { ArrowsLeftRight } from "@phosphor-icons/react"

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
  const [trustProxy, setTrustProxy] = useState(false)
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
    <div className="grid gap-6 md:grid-cols-3">
      <Card
        size="sm"
        className="col-span-2 border-white/[0.08] bg-[#0A0A0C]/50 shadow-xl backdrop-blur-md"
      >
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-base font-bold text-white">
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

      <Card
        size="sm"
        className="col-span-1 border-white/[0.08] bg-[#0A0A0C]/50 shadow-xl backdrop-blur-md"
      >
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-bold text-white">
            <ArrowsLeftRight size={18} className="text-primary" /> Reverse Proxy
            Ingress
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Trust proxy headers to capture authentic client metadata
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-xs leading-relaxed">
          <div className="flex flex-col gap-3.5 rounded-xl border border-white/[0.06] bg-black/40 p-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-white">
                Trust Forwarded Headers
              </span>
              <button
                type="button"
                onClick={() => setTrustProxy((value) => !value)}
                className={
                  trustProxy
                    ? "relative inline-flex items-center gap-2 rounded-full bg-primary px-3 py-1 text-[10px] font-bold text-white transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    : "relative inline-flex items-center gap-2 rounded-full border border-white/5 bg-neutral-800 px-3 py-1 text-[10px] font-bold text-muted-foreground transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                }
              >
                <span
                  className={
                    trustProxy
                      ? "inline-block size-1.5 animate-pulse rounded-full bg-white"
                      : "inline-block size-1.5 rounded-full bg-neutral-500"
                  }
                />
                {trustProxy ? "TRUST ACTIVE" : "DISABLED"}
              </button>
            </div>
            <p className="text-[11px] leading-normal text-muted-foreground">
              Configures nginx and the application setting{" "}
              <code className="rounded bg-white/5 px-1 py-0.5 font-mono text-[10px] text-white">
                TRUST_PROXIES=*
              </code>
              .
            </p>
          </div>

          <div className="flex flex-col gap-2 border-l-2 border-blue-500/40 pl-3">
            <h4 className="text-xs leading-tight font-bold text-white">
              User IP Resolution
            </h4>
            <p className="text-[11px] leading-normal text-muted-foreground">
              When deployed behind Cloudflare, an ALB, or an Ingress, client
              requests can otherwise show internal cluster IPs in application
              logs.
            </p>
            <p className="text-[11px] leading-normal font-medium text-muted-foreground">
              Trusting forwarded headers lets the application read the
              client&apos;s{" "}
              <code className="font-mono text-white/90">X-Forwarded-For</code>{" "}
              value.
            </p>
            {trustProxy ? (
              <span className="text-[11px] font-semibold text-emerald-400">
                Trust proxies is active. Real client IPs will be available to
                application code.
              </span>
            ) : (
              <span className="text-[11px] font-semibold text-amber-400">
                Currently disabled. Client IP may register as an internal
                cluster IP.
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
