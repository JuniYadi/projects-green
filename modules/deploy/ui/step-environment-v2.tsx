import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { EnvVarsEditor } from "@/modules/deploy/ui/env-vars-editor"
import { ResourcePlanSelector } from "@/modules/deploy/ui/resource-plan-selector"
import type {
  EnvVar,
  ResourcePlanId,
  DeployBuildState,
  DeploySourceType,
} from "@/modules/deploy/deploy.types"
import {
  Gear,
  FileCode,
  ArrowLeft,
  ArrowRight,
  Globe,
} from "@/components/ui/phosphor-icons"

type StepEnvironmentV2Props = {
  generatedSubdomain: string
  useGeneratedSubdomain: boolean
  customDomain: string
  environmentId: string
  envVars: EnvVar[]
  resourcePlanId: ResourcePlanId
  cpu?: number
  memory?: number
  hasMissingCustomDomain: boolean
  hasInvalidCustomDomain: boolean
  validationMessages: string[]
  canDeploy: boolean
  isSubmitting: boolean
  submitError: string | null
  onBack: () => void
  onDeploy: () => void
  onDomainToggleChange: (useGenerated: boolean) => void
  onCustomDomainChange: (value: string) => void
  onEnvVarsChange: (envVars: EnvVar[]) => void
  onResourcePlanChange: (planId: ResourcePlanId) => void
  onCpuChange: (cpu: number) => void
  onMemoryChange: (memory: number) => void
  sourceType?: DeploySourceType
  buildState?: DeployBuildState
  onEditBuildSettings?: () => void
  recommendedPlanId?: ResourcePlanId | null
}

export function StepEnvironmentV2({
  generatedSubdomain,
  useGeneratedSubdomain,
  customDomain,
  environmentId,
  envVars,
  resourcePlanId,
  cpu,
  memory,
  hasMissingCustomDomain,
  hasInvalidCustomDomain,
  validationMessages,
  canDeploy,
  isSubmitting,
  submitError,
  onBack,
  onDeploy,
  onDomainToggleChange,
  onCustomDomainChange,
  onEnvVarsChange,
  onResourcePlanChange,
  onCpuChange,
  onMemoryChange,
  sourceType,
  buildState,
  onEditBuildSettings,
  recommendedPlanId,
}: StepEnvironmentV2Props) {
  const targetDomain = useGeneratedSubdomain
    ? generatedSubdomain
    : customDomain.trim()

  const showBuildSummary = Boolean(sourceType && buildState)
  const isTemplate = sourceType === "template"
  const hiddenValidationMessages = validationMessages.filter((message) => {
    return (
      message !==
        "Custom domain is required when generated subdomain is off." &&
      message !== "Enter a valid domain such as app.example.com."
    )
  })
  const hasHiddenFieldValidation = hiddenValidationMessages.length > 0
  const [advancedSettingsOpen, setAdvancedSettingsOpen] = useState(false)

  return (
    <div className="flex flex-col">
      <div className="space-y-6 p-6">
        <section className="space-y-3 rounded-xl border border-border p-4">
          <div>
            <p className="text-sm font-semibold text-foreground">Web address</p>
            <p className="text-xs text-muted-foreground">
              Choose a free address or use one you already own.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label
              className={cn(
                "block cursor-pointer rounded-lg border p-3.5 transition-all",
                useGeneratedSubdomain
                  ? "border-primary bg-primary/[0.02] ring-1 ring-primary/30"
                  : "border-border bg-background hover:bg-muted/[0.02]"
              )}
            >
              <input
                type="radio"
                className="sr-only"
                name="domain-mode"
                checked={useGeneratedSubdomain}
                onChange={() => onDomainToggleChange(true)}
              />
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">
                  Use a free pfn.app address
                </p>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  Recommended
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Use a generated address for immediate launch.
              </p>
            </label>

            <label
              className={cn(
                "block cursor-pointer rounded-lg border p-3.5 transition-all",
                !useGeneratedSubdomain
                  ? "border-primary bg-primary/[0.02] ring-1 ring-primary/30"
                  : "border-border bg-background hover:bg-muted/[0.02]"
              )}
            >
              <input
                type="radio"
                className="sr-only"
                name="domain-mode"
                checked={!useGeneratedSubdomain}
                onChange={() => onDomainToggleChange(false)}
              />
              <p className="text-sm font-semibold text-foreground">
                Use my own address
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Point your own domain, for example <code>app.example.com</code>.
              </p>
            </label>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-3 text-xs text-foreground">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <span>
              {useGeneratedSubdomain
                ? `Preview domain: ${generatedSubdomain}`
                : "Custom domain will be configured as the primary app URL."}
            </span>
          </div>

          {!useGeneratedSubdomain && (
            <label className="block space-y-1 pt-1">
              <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Custom domain
              </span>
              <Input
                aria-label="Custom domain"
                aria-invalid={hasMissingCustomDomain || hasInvalidCustomDomain}
                value={customDomain}
                className={cn(
                  "h-9 border-border text-xs",
                  (hasMissingCustomDomain || hasInvalidCustomDomain) &&
                    "border-destructive focus-visible:ring-destructive"
                )}
                placeholder="app.example.com"
                onChange={(event) => onCustomDomainChange(event.target.value)}
              />
            </label>
          )}
          {hasMissingCustomDomain ? (
            <p className="text-xs text-destructive">
              Custom domain is required when generated subdomain is off.
            </p>
          ) : null}
          {hasInvalidCustomDomain ? (
            <p className="text-xs text-destructive">
              Enter a valid domain such as <code>app.example.com</code>.
            </p>
          ) : null}
        </section>

        <section className="space-y-3 rounded-xl border border-border p-4">
          <p className="text-sm font-semibold text-foreground">Hosting plan</p>
          <ResourcePlanSelector
            selectedPlanId={resourcePlanId}
            recommendedPlanId={recommendedPlanId}
            onChange={onResourcePlanChange}
            onCpuChange={onCpuChange}
            onMemoryChange={onMemoryChange}
          />
          <p className="text-xs text-muted-foreground">
            {resourcePlanId === "payg"
              ? "Pay As You Go: scale resources dynamically as you need."
              : resourcePlanId === "starter"
                ? "Starter plan selected: suitable for demos, side projects, and low traffic."
                : "Pro plan selected: suitable for production workloads requiring high availability."}
          </p>
        </section>

        <details
          open={hasHiddenFieldValidation || advancedSettingsOpen}
          onToggle={(event) => {
            if (!hasHiddenFieldValidation) {
              setAdvancedSettingsOpen(event.currentTarget.open)
            }
          }}
          className="rounded-xl border border-border"
        >
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-foreground">
            Advanced settings
          </summary>
          <div className="space-y-4 border-t border-border p-4">
            {hiddenValidationMessages.length > 0 ? (
              <div
                className="space-y-1 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive"
                role="alert"
              >
                <p className="font-semibold">
                  Environment settings need attention
                </p>
                <ul className="list-disc space-y-0.5 pl-4">
                  {hiddenValidationMessages.map((message) => {
                    return <li key={message}>{message}</li>
                  })}
                </ul>
              </div>
            ) : null}

            {showBuildSummary && buildState ? (
              <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div>
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                      <FileCode className="h-4.5 w-4.5 text-primary" />
                      Build Configuration
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {isTemplate
                        ? "Pre-configured template deployment settings."
                        : "Current build configuration for this deployment."}
                    </p>
                  </div>
                  {!isTemplate && onEditBuildSettings && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 border-border text-xs font-semibold shadow-sm"
                      onClick={onEditBuildSettings}
                    >
                      <Gear className="mr-1 h-3.5 w-3.5" />
                      Edit Build Settings
                    </Button>
                  )}
                </div>

                <div className="grid gap-4 rounded-lg border border-border/80 bg-background p-3 text-xs shadow-inner sm:grid-cols-3">
                  <div className="space-y-1">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase">
                      Language
                    </span>
                    <span className="block font-semibold text-foreground">
                      {buildState.language || "N/A"}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase">
                      Framework
                    </span>
                    <span className="block font-semibold text-foreground">
                      {buildState.framework || "N/A"}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase">
                      Build Mode
                    </span>
                    <span className="block font-semibold text-foreground">
                      {buildState.useDockerfile
                        ? "Dockerfile"
                        : buildState.buildCommand
                          ? `Command (${buildState.buildCommand})`
                          : "None"}
                    </span>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="space-y-3 rounded-xl border border-border p-4">
              <p className="text-sm font-semibold text-foreground">
                Environment Variables
              </p>
              <EnvVarsEditor
                envVars={envVars}
                environmentId={environmentId}
                onChange={onEnvVarsChange}
              />
            </div>

            {resourcePlanId === "payg" ? (
              <div className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-foreground">
                    CPU (millicores)
                  </span>
                  <Input
                    type="number"
                    min={100}
                    max={2000}
                    value={cpu ?? 100}
                    onChange={(event) =>
                      onCpuChange(Number(event.target.value))
                    }
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-foreground">
                    Memory (MiB)
                  </span>
                  <Input
                    type="number"
                    min={256}
                    max={4096}
                    value={memory ?? 256}
                    onChange={(event) =>
                      onMemoryChange(Number(event.target.value))
                    }
                  />
                </label>
              </div>
            ) : null}

            <div className="space-y-2 rounded-xl border border-dashed border-border bg-muted/10 p-4">
              <p className="text-sm font-semibold text-foreground">
                Attached Resources
              </p>
              <p className="text-xs text-muted-foreground">
                No databases attached. You can provision and attach PostgreSQL
                or Redis in one click after deployment.
              </p>
            </div>
          </div>
        </details>

        {validationMessages.length === 0 ? (
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-foreground">
            <p>
              Ready to publish at <code>{targetDomain}</code>.
            </p>
            <p className="mt-1 text-muted-foreground">
              {envVars.length} environment variable
              {envVars.length === 1 ? "" : "s"} on the{" "}
              {resourcePlanId === "starter"
                ? "Starter"
                : resourcePlanId === "pro"
                  ? "Pro"
                  : "Pay-As-You-Go"}{" "}
              plan.
            </p>
          </div>
        ) : null}

        {submitError ? (
          <div
            className="space-y-1 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive"
            role="alert"
          >
            <p className="font-semibold">Unable to start deployment</p>
            <p>{submitError}</p>
          </div>
        ) : null}
      </div>
      <div className="flex items-center justify-between border-t p-4">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="flex h-9 items-center gap-1 border-border px-4 text-xs font-semibold shadow-sm"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </Button>
        <Button
          type="button"
          onClick={onDeploy}
          disabled={!canDeploy || isSubmitting}
          className="flex h-9 items-center gap-1 bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
        >
          {isSubmitting ? "Publishing site…" : "Publish site"}
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
