import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { enMessages } from "@/lib/i18n/messages/en"
import type { DeployWizardMessages } from "@/lib/i18n/messages/types"
import { ResourcePlanSelector } from "@/modules/deploy/ui/resource-plan-selector"
import { EnvVarsEditor } from "@/modules/deploy/ui/env-vars-editor"
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
  messages?: DeployWizardMessages
  useGeneratedSubdomain: boolean
  generatedSubdomain: string
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
  rootDirectory?: string
  onRootDirectoryChange?: (value: string) => void
}

export function StepEnvironmentV2({
  messages: providedMessages,
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
  rootDirectory,
  onRootDirectoryChange,
  buildState,
  onEditBuildSettings,
  recommendedPlanId,
}: StepEnvironmentV2Props) {
  const messages = providedMessages ?? enMessages.console.app.deployWizard
  const environmentMessages = messages.environment
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
        {validationMessages.length > 0 ? (
          <div
            className="space-y-1 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive"
            role="alert"
          >
            <p className="font-semibold">
              {environmentMessages.validationHeading}
            </p>
            <ul className="list-disc space-y-0.5 pl-4">
              {validationMessages.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {submitError ? (
          <div
            className="space-y-1 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive"
            role="alert"
          >
            <p className="font-semibold">{environmentMessages.submitHeading}</p>
            <p>{submitError}</p>
          </div>
        ) : null}
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="w-full justify-between"
            >
              {environmentMessages.advanced}
              <span aria-hidden="true">⌄</span>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 space-y-6">
            {showBuildSummary && (
              <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div>
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                      <FileCode className="h-4.5 w-4.5 text-primary" />
                      {environmentMessages.buildConfiguration}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {isTemplate
                        ? environmentMessages.templateBuildDescription
                        : environmentMessages.buildDescription}
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
                      {environmentMessages.editBuildSettings}
                    </Button>
                  )}
                </div>
                <div className="grid gap-4 rounded-lg border border-border/80 bg-background p-3 text-xs shadow-inner sm:grid-cols-3">
                  <div className="space-y-1">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase">
                      {environmentMessages.language}
                    </span>
                    <span className="block font-semibold text-foreground">
                      {buildState?.language || environmentMessages.notAvailable}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase">
                      {environmentMessages.framework}
                    </span>
                    <span className="block font-semibold text-foreground">
                      {buildState?.framework ||
                        environmentMessages.notAvailable}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase">
                      {environmentMessages.buildMode}
                    </span>
                    <span className="block font-semibold text-foreground">
                      {buildState?.useDockerfile
                        ? environmentMessages.dockerfile
                        : buildState?.buildCommand
                          ? environmentMessages.command.replace(
                              "{command}",
                              buildState.buildCommand
                            )
                          : environmentMessages.none}
                    </span>
                  </div>
                </div>
              </div>
            )}
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-muted-foreground">
                {environmentMessages.rootDirectory}
              </span>
              <Input
                aria-label={environmentMessages.rootDirectory}
                value={rootDirectory ?? "/"}
                onChange={(event) =>
                  onRootDirectoryChange?.(event.target.value)
                }
              />
            </label>
            <div className="space-y-3 rounded-xl border border-border p-4">
              <p className="text-sm font-semibold text-foreground">
                {environmentMessages.domainMode}
              </p>
              <p className="text-xs text-muted-foreground">
                {environmentMessages.domainDescription}
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
                    {environmentMessages.managedSubdomain}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {environmentMessages.managedSubdomainDescription}
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
                    {environmentMessages.customDomain}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {environmentMessages.customDomainDescription}
                  </p>
                </label>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-3 text-xs text-foreground">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <span>
                  {useGeneratedSubdomain
                    ? environmentMessages.previewDomain.replace(
                        "{domain}",
                        generatedSubdomain
                      )
                    : environmentMessages.customDomainNotice}
                </span>
              </div>
              {!useGeneratedSubdomain && (
                <label className="block space-y-1 pt-1">
                  <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                    {environmentMessages.customDomain}
                  </span>
                  <Input
                    aria-label={environmentMessages.customDomain}
                    aria-invalid={
                      hasMissingCustomDomain || hasInvalidCustomDomain
                    }
                    value={customDomain}
                    className={cn(
                      "h-9 border-border text-xs",
                      (hasMissingCustomDomain || hasInvalidCustomDomain) &&
                        "border-destructive focus-visible:ring-destructive"
                    )}
                    placeholder={environmentMessages.customDomainPlaceholder}
                    onChange={(event) =>
                      onCustomDomainChange(event.target.value)
                    }
                  />
                </label>
              )}
              {hasMissingCustomDomain ? (
                <p className="text-xs text-destructive">
                  {environmentMessages.customDomainRequired}
                </p>
              ) : null}
              {hasInvalidCustomDomain ? (
                <p className="text-xs text-destructive">
                  {environmentMessages.invalidDomain}
                </p>
              ) : null}
            </div>
            <div className="space-y-3 rounded-xl border border-border p-4">
              <p className="text-sm font-semibold text-foreground">
                {environmentMessages.environmentVariables}
              </p>
              <EnvVarsEditor
                envVars={envVars}
                environmentId={environmentId}
                onChange={onEnvVarsChange}
              />
            </div>
            <div className="space-y-3 rounded-xl border border-border p-4">
              <p className="text-sm font-semibold text-foreground">
                {environmentMessages.resourcePlan}
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
                  ? environmentMessages.paygDescription
                  : resourcePlanId === "starter"
                    ? environmentMessages.starterDescription
                    : environmentMessages.proDescription}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-foreground">
              {environmentMessages.readySummary
                .replace("{domain}", targetDomain)
                .replace("{count}", String(envVars.length))
                .replace(
                  "{variables}",
                  envVars.length === 1
                    ? environmentMessages.variableSingular
                    : environmentMessages.variablePlural
                )
                .replace(
                  "{plan}",
                  resourcePlanId === "starter"
                    ? environmentMessages.planStarter
                    : resourcePlanId === "pro"
                      ? environmentMessages.planPro
                      : environmentMessages.planPayg
                )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
      <div className="flex items-center justify-between border-t p-4">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="flex h-9 items-center gap-1 border-border px-4 text-xs font-semibold shadow-sm"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {environmentMessages.back}
        </Button>
        <Button
          type="button"
          onClick={onDeploy}
          disabled={!canDeploy || isSubmitting}
          className="flex h-9 items-center gap-1 bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
        >
          {isSubmitting
            ? environmentMessages.deploying
            : environmentMessages.deploy}
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
