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
  ArrowLeft,
  ArrowRight,
  Globe,
  FileCode,
} from "@phosphor-icons/react"
import { useParams } from "next/navigation"
import { getMessagesForMaybeLocale } from "@/lib/i18n/messages"
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
  const params = useParams<{ lang?: string }>()
  const lang = params?.lang || "en"
  const messages =
    getMessagesForMaybeLocale(lang).console.app.deployWizard.environment
  const targetDomain = useGeneratedSubdomain
    ? generatedSubdomain
    : customDomain.trim()

  const showBuildSummary = sourceType && buildState
  const isTemplate = sourceType === "template"

  return (
    <Card className="border border-border bg-card shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl font-bold">
          {messages.settingsTitle}
        </CardTitle>
        <CardDescription>{messages.settingsDesc}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Build Configuration Summary (Only visible if source & build state are passed) */}
        {showBuildSummary && (
          <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <FileCode className="h-4.5 w-4.5 text-primary" />
                  {messages.buildConfiguration}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isTemplate
                    ? messages.templateBuildDescription
                    : messages.buildDescription}
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
                  {messages.editBuildSettings}
                </Button>
              )}
            </div>

            <div className="grid gap-4 rounded-lg border border-border/80 bg-background p-3 text-xs shadow-inner sm:grid-cols-3">
              <div className="space-y-1">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">
                  {messages.language}
                </span>
                <span className="block font-semibold text-foreground">
                  {buildState.language || "N/A"}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">
                  {messages.framework}
                </span>
                <span className="block font-semibold text-foreground">
                  {buildState.framework || "N/A"}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">
                  {messages.buildMode}
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
          <p className="text-sm font-semibold text-foreground">
            {messages.domainMode}
          </p>
          <p className="text-xs text-muted-foreground">
            {messages.domainDescription}
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
                {messages.managedSubdomain}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {messages.managedSubdomainDescription}
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
                {messages.customDomain}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {messages.customDomainDescription}
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
                {messages.customDomain}
              </span>
              <Input
                aria-label={messages.customDomain}
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
              {messages.customDomainRequired}
            </p>
          ) : null}
          {hasInvalidCustomDomain ? (
            <p className="text-xs text-destructive">{messages.invalidDomain}</p>
          ) : null}
        </div>

        {/* Environment Variables */}
        <div className="space-y-3 rounded-xl border border-border p-4">
          <p className="text-sm font-semibold text-foreground">
            {messages.environmentVariables}
          </p>
          <EnvVarsEditor
            envVars={envVars}
            environmentId={environmentId}
            onChange={onEnvVarsChange}
          />
        </div>

        <div className="space-y-3 rounded-xl border border-border p-4">
          <p className="text-sm font-semibold text-foreground">
            {messages.resourcePlan}
          </p>
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
            {messages.attachedResources}
          </p>
          <p className="text-xs text-muted-foreground">
            {messages.noDatabases}
          </p>
        </div>

        {/* Validation Errors & Deploy Status */}
        {validationMessages.length > 0 ? (
          <div
            className="space-y-1 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive"
            role="alert"
          >
            <p className="font-semibold">{messages.validationHeading}</p>
            <ul className="list-disc space-y-0.5 pl-4">
              {validationMessages.map((message) => {
                return <li key={message}>{message}</li>
              })}
            </ul>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-foreground">
            {messages.readySummary} <code>{targetDomain}</code> (
            {envVars.length}{" "}
            {envVars.length === 1
              ? messages.variableSingular
              : messages.variablePlural}{" "}
            -{" "}
            {resourcePlanId === "starter"
              ? messages.planStarter
              : resourcePlanId === "pro"
                ? messages.planPro
                : messages.planPayg}
            )
          </div>
        )}

        {submitError ? (
          <div
            className="space-y-1 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive"
            role="alert"
          >
            <p className="font-semibold">{messages.submitHeading}</p>
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
          {messages.back}
        </Button>
        <Button
          type="button"
          onClick={onDeploy}
          disabled={!canDeploy || isSubmitting}
          className="flex h-9 items-center gap-1 bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
        >
          {isSubmitting ? "Starting deploy…" : "Deploy"}
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </Card>
  )
}
