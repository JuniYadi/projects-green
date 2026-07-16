import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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

type StepEnvironmentProps = {
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
  isSubmitting?: boolean
  submitError?: string | null
  onBack: () => void
  onDeploy: () => void
  onDomainToggleChange: (value: boolean) => void
  onCustomDomainChange: (value: string) => void
  onEnvVarsChange: (envVars: EnvVar[]) => void
  onResourcePlanChange: (value: ResourcePlanId) => void
  onCpuChange: (value: number) => void
  onMemoryChange: (value: number) => void
  sourceType?: DeploySourceType
  buildState?: DeployBuildState
  onEditBuildSettings?: () => void
  recommendedPlanId?: ResourcePlanId | null
}

export function StepEnvironment({
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
}: StepEnvironmentProps) {
  const targetDomain = useGeneratedSubdomain
    ? generatedSubdomain
    : customDomain.trim()

  const showBuildSummary = sourceType && buildState
  const isTemplate = sourceType === "template"

  return (
    <Card className="border border-border bg-card shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl font-bold">
          Environment Settings
        </CardTitle>
        <CardDescription>
          Configure domain mode, environment variables, and compute allocation.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Build Configuration Summary (Only visible if source & build state are passed) */}
        {showBuildSummary && (
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
        )}

        {/* Domain Mode Selector */}
        <div className="space-y-3 rounded-xl border border-border p-4">
          <p className="text-sm font-semibold text-foreground">Domain Mode</p>
          <p className="text-xs text-muted-foreground">
            Choose a managed subdomain for immediate launch, or point your
            custom domain.
          </p>

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
              <p className="text-sm font-semibold text-foreground">
                Managed subdomain
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Use a generated <code>*.pfn.app</code> domain for immediate
                launch.
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
                Custom domain
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
        </div>

        {/* Environment Variables */}
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

        <div className="space-y-3 rounded-xl border border-border p-4">
          <p className="text-sm font-semibold text-foreground">Resource Plan</p>
          <ResourcePlanSelector
            selectedPlanId={resourcePlanId}
            cpu={cpu}
            memory={memory}
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
        </div>

        {/* Attached Resources */}
        <div className="space-y-2 rounded-xl border border-dashed border-border bg-muted/10 p-4">
          <p className="text-sm font-semibold text-foreground">
            Attached Resources
          </p>
          <p className="text-xs text-muted-foreground">
            No databases attached. You can provision and attach PostgreSQL or
            Redis in one click after deployment.
          </p>
        </div>

        {/* Validation Errors & Deploy Status */}
        {validationMessages.length > 0 ? (
          <div
            className="space-y-1 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive"
            role="alert"
          >
            <p className="font-semibold">Environment settings need attention</p>
            <ul className="list-disc space-y-0.5 pl-4">
              {validationMessages.map((message) => {
                return <li key={message}>{message}</li>
              })}
            </ul>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-foreground">
            Ready to deploy to <code>{targetDomain}</code> with {envVars.length}{" "}
            environment variable{envVars.length === 1 ? "" : "s"} on the{" "}
            {resourcePlanId === "starter"
              ? "Starter"
              : resourcePlanId === "pro"
                ? "Pro"
                : "Pay-As-You-Go"}{" "}
            plan.
          </div>
        )}

        {submitError ? (
          <div
            className="space-y-1 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive"
            role="alert"
          >
            <p className="font-semibold">Unable to start deployment</p>
            <p>{submitError}</p>
          </div>
        ) : null}
      </CardContent>
      <div className="flex items-center justify-between rounded-b-xl border-t border-border bg-muted/10 p-4">
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
          {isSubmitting ? "Starting deploy…" : "Deploy Application"}
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </Card>
  )
}
