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
} from "@phosphor-icons/react"

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
}: StepEnvironmentProps) {
  const targetDomain = useGeneratedSubdomain
    ? generatedSubdomain
    : customDomain.trim()

  const showBuildSummary = sourceType && buildState
  const isTemplate = sourceType === "template"

  return (
    <Card className="border border-border bg-card shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl font-bold">Environment Settings</CardTitle>
        <CardDescription>
          Configure domain mode, environment variables, and compute allocation.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Build Configuration Summary (Only visible if source & build state are passed) */}
        {showBuildSummary && (
          <div className="space-y-3 border border-border p-4 rounded-xl bg-muted/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
                  <FileCode className="w-4.5 h-4.5 text-primary" />
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
                  className="h-8 text-xs font-semibold shadow-sm border-border"
                  onClick={onEditBuildSettings}
                >
                  <Gear className="w-3.5 h-3.5 mr-1" />
                  Edit Build Settings
                </Button>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-3 text-xs bg-background p-3 rounded-lg border border-border/80 shadow-inner">
              <div className="space-y-1">
                <span className="text-muted-foreground text-[10px] uppercase font-semibold">Language</span>
                <span className="font-semibold text-foreground block">
                  {buildState.language || "N/A"}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-muted-foreground text-[10px] uppercase font-semibold">Framework</span>
                <span className="font-semibold text-foreground block">
                  {buildState.framework || "N/A"}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-muted-foreground text-[10px] uppercase font-semibold">Build Mode</span>
                <span className="font-semibold text-foreground block">
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
        <div className="space-y-3 border border-border p-4 rounded-xl">
          <p className="text-sm font-semibold text-foreground">Domain Mode</p>
          <p className="text-xs text-muted-foreground">
            Choose a managed subdomain for immediate launch, or point your custom domain.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <label
              className={cn(
                "block cursor-pointer border p-3.5 rounded-lg transition-all",
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
              <p className="text-sm font-semibold text-foreground">Managed subdomain</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Use a generated <code>*.pfn.app</code> domain for immediate launch.
              </p>
            </label>

            <label
              className={cn(
                "block cursor-pointer border p-3.5 rounded-lg transition-all",
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
              <p className="text-sm font-semibold text-foreground">Custom domain</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Point your own domain, for example <code>app.example.com</code>.
              </p>
            </label>
          </div>

          <div className="border border-border bg-muted/40 p-3 rounded-lg text-xs flex items-center gap-2 text-foreground">
            <Globe className="w-4 h-4 text-muted-foreground" />
            <span>
              {useGeneratedSubdomain
                ? `Preview domain: ${generatedSubdomain}`
                : "Custom domain will be configured as the primary app URL."}
            </span>
          </div>

          {!useGeneratedSubdomain && (
            <label className="block space-y-1 pt-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Custom domain</span>
              <Input
                aria-label="Custom domain"
                aria-invalid={hasMissingCustomDomain || hasInvalidCustomDomain}
                value={customDomain}
                className={cn(
                  "h-9 text-xs border-border",
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
        <div className="space-y-3 border border-border p-4 rounded-xl">
          <p className="text-sm font-semibold text-foreground">Environment Variables</p>
          <EnvVarsEditor
            envVars={envVars}
            environmentId={environmentId}
            onChange={onEnvVarsChange}
          />
        </div>

        {/* Resource Plan */}
        <div className="space-y-3 border border-border p-4 rounded-xl">
          <p className="text-sm font-semibold text-foreground">Resource Plan</p>
          <ResourcePlanSelector
            selectedPlanId={resourcePlanId}
            cpu={cpu}
            memory={memory}
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
        <div className="space-y-2 border border-dashed border-border p-4 rounded-xl bg-muted/10">
          <p className="text-sm font-semibold text-foreground">Attached Resources</p>
          <p className="text-xs text-muted-foreground">
            No databases attached. You can provision and attach PostgreSQL or Redis in one click after deployment.
          </p>
        </div>

        {/* Validation Errors & Deploy Status */}
        {validationMessages.length > 0 ? (
          <div
            className="space-y-1 border border-destructive/20 bg-destructive/5 p-3 rounded-lg text-xs text-destructive"
            role="alert"
          >
            <p className="font-semibold">Environment settings need attention</p>
            <ul className="list-disc pl-4 space-y-0.5">
              {validationMessages.map((message) => {
                return <li key={message}>{message}</li>
              })}
            </ul>
          </div>
        ) : (
          <div className="border border-border bg-muted/40 p-3 rounded-lg text-xs text-foreground">
            Ready to deploy to <code>{targetDomain}</code> with {envVars.length}{" "}
            environment variable{envVars.length === 1 ? "" : "s"} on the{" "}
            {resourcePlanId === "starter" ? "Starter" : resourcePlanId === "pro" ? "Pro" : "Pay-As-You-Go"} plan.
          </div>
        )}
      </CardContent>
      <div className="flex items-center justify-between border-t border-border p-4 bg-muted/10 rounded-b-xl">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="border-border shadow-sm text-xs font-semibold px-4 h-9 flex items-center gap-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </Button>
        <Button
          type="button"
          onClick={onDeploy}
          disabled={!canDeploy}
          className="shadow-sm text-xs font-semibold px-4 h-9 bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1"
        >
          Deploy Application
          <ArrowRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    </Card>
  )
}
