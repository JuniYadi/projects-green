"use client"

import { useState } from "react"
import { z } from "zod"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import type { ProductProvisionAdapter } from "../product-provision-adapter.types"

export type AppHostingPlanConfig = {
  cpu: number
  memory: number
  storage: number
  maxCustomDomains: number
  wildcard: boolean
  requiredDependencies: string[]
}

export const DEFAULT_APP_HOSTING_PLAN_CONFIG: AppHostingPlanConfig = {
  cpu: 1,
  memory: 512,
  storage: 10,
  maxCustomDomains: 1,
  wildcard: false,
  requiredDependencies: [],
}
export const DEFAULT_APP_HOSTING_BLUEPRINT = DEFAULT_APP_HOSTING_PLAN_CONFIG

const appHostingPlanConfigSchema = z.object({
  cpu: z.number().finite().int().min(1).default(1),
  memory: z.number().finite().int().min(128).default(512),
  storage: z.number().finite().int().min(1).default(10),
  maxCustomDomains: z.number().finite().int().min(0).default(1),
  wildcard: z.boolean().default(false),
  requiredDependencies: z.array(z.string().trim().min(1)).default([]),
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
  const [dependenciesText, setDependenciesText] = useState(
    value.requiredDependencies.join(", ")
  )

  const updateDependencies = (text: string) => {
    setDependenciesText(text)
    onChange({
      ...value,
      requiredDependencies: text
        .split(",")
        .map((dependency) => dependency.trim())
        .filter(Boolean),
    })
  }

  return (
    <section className="space-y-4 rounded-md border p-4">
      <div>
        <h3 className="font-medium">App Hosting provisioning</h3>
        <p className="text-sm text-muted-foreground">
          Set the resources and template dependencies for this plan.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <NumberField
          id="app-hosting-cpu"
          label="CPU (vCPU)"
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
      <div className="space-y-2 border-t pt-3">
        <Label htmlFor="app-hosting-dependencies">
          Required dependencies for template
        </Label>
        <Input
          id="app-hosting-dependencies"
          value={dependenciesText}
          onChange={(event) => updateDependencies(event.target.value)}
          placeholder="e.g. node, postgres"
          disabled={disabled}
          aria-describedby={
            errors?.requiredDependencies
              ? "app-hosting-dependencies-error"
              : undefined
          }
        />
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
