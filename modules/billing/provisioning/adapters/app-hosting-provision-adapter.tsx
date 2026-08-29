"use client"

import { useEffect, useState } from "react"
import { z } from "zod"

import { eden } from "@/lib/eden"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import type { ProductProvisionAdapter } from "../product-provision-adapter.types"

export const APP_HOSTING_DEPENDENCIES = [
  "POSTGRESQL",
  "MYSQL",
  "REDIS",
] as const

export type AppHostingDependency = (typeof APP_HOSTING_DEPENDENCIES)[number]

export const appHostingDependencySchema = z.enum(APP_HOSTING_DEPENDENCIES)

export type AppHostingPlanConfig = {
  clusterIds: string[]
  cpu: number
  memory: number
  storage: number
  maxCustomDomains: number
  wildcard: boolean
  requiredDependencies: AppHostingDependency[]
}

export const DEFAULT_APP_HOSTING_PLAN_CONFIG: AppHostingPlanConfig = {
  clusterIds: [],
  cpu: 1000,
  memory: 1024,
  storage: 20,
  maxCustomDomains: 3,
  wildcard: false,
  requiredDependencies: [],
}
export const DEFAULT_APP_HOSTING_BLUEPRINT = DEFAULT_APP_HOSTING_PLAN_CONFIG

const appHostingPlanConfigSchema = z.object({
  clusterIds: z.array(z.string().trim().min(1)).default([]),
  cpu: z.number().finite().int().min(1).default(1000),
  memory: z.number().finite().int().min(128).default(1024),
  storage: z.number().finite().int().min(1).default(20),
  maxCustomDomains: z.number().finite().int().min(0).default(3),
  wildcard: z.boolean().default(false),
  requiredDependencies: z.array(appHostingDependencySchema).default([]),
})

export function parseAppHostingPlanConfig(
  value: unknown
): AppHostingPlanConfig {
  const raw = value as { provisioning?: unknown } | null | undefined
  const parsed = appHostingPlanConfigSchema.safeParse(raw?.provisioning ?? raw)
  return parsed.success ? parsed.data : DEFAULT_APP_HOSTING_PLAN_CONFIG
}
export const parseAppHostingBlueprint = parseAppHostingPlanConfig

export function validateAppHostingPlanConfig(value: unknown) {
  const raw = value as { provisioning?: unknown } | null | undefined
  const parsed = appHostingPlanConfigSchema.safeParse(raw?.provisioning ?? raw)
  if (!parsed.success) {
    return {
      valid: false,
      errors: zodErrors(parsed.error),
    }
  }
  return { valid: true as const }
}

function zodErrors(error: z.ZodError): Record<string, string> {
  return Object.fromEntries(
    error.issues.map((issue) => [
      String(issue.path[0] ?? "config"),
      issue.message,
    ])
  )
}

function NumberField({
  id,
  label,
  value,
  min,
  onChange,
  error,
  disabled,
}: Readonly<{
  id: string
  label: string
  value: number
  min: number
  onChange: (value: number) => void
  error?: string
  disabled?: boolean
}>) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={min}
        step={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        disabled={disabled}
        aria-invalid={Boolean(error)}
      />
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

const DEPENDENCY_OPTIONS: Array<{
  id: AppHostingDependency
  label: string
  description: string
}> = [
  {
    id: "POSTGRESQL",
    label: "PostgreSQL",
    description: "Managed relational database engine with extensions.",
  },
  {
    id: "MYSQL",
    label: "MySQL",
    description: "Managed relational database engine for standard workloads.",
  },
  {
    id: "REDIS",
    label: "Redis",
    description: "In-memory key-value data store for cache and queues.",
  },
]

type ClusterItem = {
  id: string
  code: string
  name: string
  region: string
  status: string
  isDefault: boolean
}

export function AppHostingPlanConfigComponent({
  value,
  onChange,
  disabled,
  errors,
}: Readonly<{
  value: AppHostingPlanConfig
  onChange: (config: AppHostingPlanConfig) => void
  disabled?: boolean
  errors?: Record<string, string>
}>) {
  const [clusters, setClusters] = useState<ClusterItem[]>([])
  const [loadingClusters, setLoadingClusters] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    async function fetchClusters() {
      try {
        const { data: payload } = await eden.api.admin[
          "app-hosting"
        ].clusters.get({
          $query: { page: 1, limit: 50 },
        })
        if (mounted && payload?.ok && Array.isArray(payload.data)) {
          setClusters(
            (payload.data as ClusterItem[]).filter(
              (c: ClusterItem) => c.status === "ACTIVE"
            )
          )
        }
      } catch (err) {
        if (mounted) {
          setLoadError(
            err instanceof Error ? err.message : "Failed to load clusters."
          )
        }
      } finally {
        if (mounted) setLoadingClusters(false)
      }
    }
    fetchClusters()
    return () => {
      mounted = false
    }
  }, [])

  const toggleCluster = (clusterId: string, checked: boolean) => {
    const nextClusterIds = checked
      ? [...new Set([...(value.clusterIds ?? []), clusterId])]
      : (value.clusterIds ?? []).filter((id) => id !== clusterId)

    onChange({
      ...value,
      clusterIds: nextClusterIds,
    })
  }

  const toggleDependency = (
    dependency: AppHostingDependency,
    checked: boolean
  ) => {
    const nextDependencies = checked
      ? [...new Set([...value.requiredDependencies, dependency])]
      : value.requiredDependencies.filter((dep) => dep !== dependency)

    onChange({
      ...value,
      requiredDependencies: nextDependencies,
    })
  }
  return (
    <section className="space-y-4 rounded-md border p-4">
      <div>
        <h3 className="font-medium">App Hosting provisioning</h3>
        <p className="text-sm text-muted-foreground">
          Set target clusters, compute specs, and template dependencies for this
          plan.
        </p>
      </div>

      {/* Cluster Selection Section */}
      <div className="space-y-3 border-b pb-4">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium">
              Allowed Target Clusters
            </Label>
            <p className="text-xs text-muted-foreground">
              Select Kubernetes clusters where this plan can be deployed. Leave
              empty to allow all active clusters.
            </p>
          </div>
          {clusters.length > 0 && (
            <Badge variant="outline" className="text-xs">
              {(value.clusterIds?.length ?? 0) === 0
                ? "All Active Clusters"
                : `${value.clusterIds.length} of ${clusters.length} Selected`}
            </Badge>
          )}
        </div>

        {loadingClusters ? (
          <div className="rounded-md border p-3 text-xs text-muted-foreground">
            Loading active clusters...
          </div>
        ) : loadError ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
            {loadError}
          </div>
        ) : clusters.length === 0 ? (
          <div className="rounded-md border p-3 text-xs text-muted-foreground">
            No active clusters found. Configure clusters under App Hosting
            inventory.
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {clusters.map((cluster) => {
              const isChecked = (value.clusterIds ?? []).includes(cluster.id)
              return (
                <label
                  key={cluster.id}
                  htmlFor={`cluster-${cluster.id}`}
                  className="flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors hover:bg-muted/40"
                >
                  <Checkbox
                    id={`cluster-${cluster.id}`}
                    checked={isChecked}
                    onCheckedChange={(checked) =>
                      toggleCluster(cluster.id, Boolean(checked))
                    }
                    disabled={disabled}
                    aria-label={cluster.name}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm leading-none font-medium">
                        {cluster.name}
                      </span>
                      {cluster.isDefault && (
                        <Badge
                          variant="secondary"
                          className="h-4 px-1 text-[10px]"
                        >
                          Default
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Code: <span className="font-mono">{cluster.code}</span> ·
                      Region: {cluster.region || "Global"}
                    </p>
                  </div>
                </label>
              )
            })}
          </div>
        )}
        {errors?.clusterIds && (
          <p className="text-xs text-destructive" role="alert">
            {errors.clusterIds}
          </p>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <NumberField
          id="app-hosting-cpu"
          label="CPU (mCPU)"
          value={value.cpu}
          min={1}
          onChange={(cpu) => onChange({ ...value, cpu })}
          error={errors?.cpu}
          disabled={disabled}
        />
        <NumberField
          id="app-hosting-memory"
          label="Memory (MB)"
          value={value.memory}
          min={128}
          onChange={(memory) => onChange({ ...value, memory })}
          error={errors?.memory}
          disabled={disabled}
        />
        <NumberField
          id="app-hosting-storage"
          label="Storage (GB)"
          value={value.storage}
          min={1}
          onChange={(storage) => onChange({ ...value, storage })}
          error={errors?.storage}
          disabled={disabled}
        />
      </div>
      <NumberField
        id="app-hosting-max-domains"
        label="Max custom domains"
        value={value.maxCustomDomains}
        min={0}
        onChange={(maxCustomDomains) =>
          onChange({ ...value, maxCustomDomains })
        }
        error={errors?.maxCustomDomains}
        disabled={disabled}
      />
      <div className="flex items-center justify-between gap-4 border-t pt-3">
        <div>
          <Label htmlFor="app-hosting-wildcard">Wildcard domains</Label>
          <p className="text-xs text-muted-foreground">
            Allow wildcard domains for this plan.
          </p>
        </div>
        <Switch
          id="app-hosting-wildcard"
          checked={value.wildcard}
          onCheckedChange={(wildcard) => onChange({ ...value, wildcard })}
          disabled={disabled}
        />
      </div>
      <div className="space-y-3 border-t pt-3">
        <div>
          <Label>Required database dependencies</Label>
          <p className="text-xs text-muted-foreground">
            Select database dependencies required by this template.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {DEPENDENCY_OPTIONS.map((option) => {
            const isChecked = value.requiredDependencies.includes(option.id)
            return (
              <label
                key={option.id}
                htmlFor={`app-hosting-dep-${option.id.toLowerCase()}`}
                className="flex cursor-pointer items-start gap-3 rounded-md border p-3"
              >
                <Checkbox
                  id={`app-hosting-dep-${option.id.toLowerCase()}`}
                  checked={isChecked}
                  onCheckedChange={(checked) =>
                    toggleDependency(option.id, Boolean(checked))
                  }
                  disabled={disabled}
                  aria-label={option.label}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">
                    {option.label}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {option.description}
                  </span>
                </span>
              </label>
            )
          })}
        </div>
        {errors?.requiredDependencies && (
          <p
            id="app-hosting-dependencies-error"
            className="text-xs text-destructive"
            role="alert"
          >
            {errors.requiredDependencies}
          </p>
        )}
      </div>
    </section>
  )
}

export const AppHostingProvisionAdapter: ProductProvisionAdapter<AppHostingPlanConfig> =
  {
    id: "APP_HOSTING",
    name: "App Hosting",
    description: "Provision compute resources and template dependencies.",
    defaultConfig: DEFAULT_APP_HOSTING_PLAN_CONFIG,
    defaultBlueprint: DEFAULT_APP_HOSTING_PLAN_CONFIG,
    parsePlanConfig: parseAppHostingPlanConfig,
    parseBlueprint: parseAppHostingBlueprint,
    PlanConfigComponent: AppHostingPlanConfigComponent,
    validatePlanConfig: validateAppHostingPlanConfig,
  }
