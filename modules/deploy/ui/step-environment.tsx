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
import type { EnvVar, ResourcePlanId } from "@/modules/deploy/deploy.types"

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
}: StepEnvironmentProps) {
  const targetDomain = useGeneratedSubdomain
    ? generatedSubdomain
    : customDomain.trim()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Environment</CardTitle>
        <CardDescription>
          Configure domain mode, secrets, and compute package.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3 border border-border p-3">
          <p className="text-sm font-medium">Domain mode</p>
          <p className="text-xs text-muted-foreground">
            Choose a managed subdomain for launch, or bring your own custom
            domain.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <label
              className={cn(
                "block cursor-pointer border p-3",
                useGeneratedSubdomain
                  ? "border-primary bg-primary/10"
                  : "border-border bg-background"
              )}
            >
              <input
                type="radio"
                className="sr-only"
                name="domain-mode"
                checked={useGeneratedSubdomain}
                onChange={() => onDomainToggleChange(true)}
              />
              <p className="text-sm font-medium">Managed subdomain</p>
              <p className="text-xs text-muted-foreground">
                Use a generated <code>*.pfn.app</code> domain for immediate
                launch.
              </p>
            </label>

            <label
              className={cn(
                "block cursor-pointer border p-3",
                !useGeneratedSubdomain
                  ? "border-primary bg-primary/10"
                  : "border-border bg-background"
              )}
            >
              <input
                type="radio"
                className="sr-only"
                name="domain-mode"
                checked={!useGeneratedSubdomain}
                onChange={() => onDomainToggleChange(false)}
              />
              <p className="text-sm font-medium">Custom domain</p>
              <p className="text-xs text-muted-foreground">
                Point your own domain after launch, for example{" "}
                <code>app.example.com</code>.
              </p>
            </label>
          </div>

          <p className="border border-border bg-muted/40 p-2 text-xs">
            {useGeneratedSubdomain
              ? `Preview domain: ${generatedSubdomain}`
              : "Custom domain will be used as the primary app URL."}
          </p>

          <label className="space-y-1">
            <span className="text-xs font-medium">Custom domain</span>
            <Input
              aria-label="Custom domain"
              aria-invalid={hasMissingCustomDomain || hasInvalidCustomDomain}
              value={customDomain}
              disabled={useGeneratedSubdomain}
              className={cn(
                (hasMissingCustomDomain || hasInvalidCustomDomain) &&
                  "border-destructive focus-visible:ring-destructive"
              )}
              placeholder="app.example.com"
              onChange={(event) => onCustomDomainChange(event.target.value)}
            />
          </label>
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

        <div className="space-y-3 border border-border p-3">
          <p className="text-sm font-medium">Environment variables</p>
          <EnvVarsEditor
            envVars={envVars}
            environmentId={environmentId}
            onChange={onEnvVarsChange}
          />
        </div>

        <div className="space-y-3 border border-border p-3">
          <p className="text-sm font-medium">Resource plan</p>
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
              ? "Pay As You Go: scale resources as you need."
              : resourcePlanId === "starter"
                ? "Starter plan selected: suitable for demos and low traffic."
                : "Pro plan selected: suitable for production workloads."}
          </p>
        </div>

        <div className="space-y-2 border border-dashed border-border p-3">
          <p className="text-sm font-medium">Attached resources</p>
          <p className="text-xs text-muted-foreground">
            No databases attached. You can add Postgres or Redis after
            deployment.
          </p>
        </div>

        {validationMessages.length > 0 ? (
          <div
            className="space-y-1 border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive"
            role="alert"
          >
            <p className="font-medium">Environment settings need attention</p>
            <ul className="list-disc pl-4">
              {validationMessages.map((message) => {
                return <li key={message}>{message}</li>
              })}
            </ul>
          </div>
        ) : (
          <p className="border border-border bg-muted/40 p-3 text-xs text-foreground">
            Ready: deploy to <code>{targetDomain}</code> with {envVars.length}{" "}
            environment variable{envVars.length === 1 ? "" : "s"} on the{" "}
            {resourcePlanId === "starter" ? "Starter" : "Pro"} plan.
          </p>
        )}
      </CardContent>
      <div className="flex items-center justify-between border-t p-4">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button type="button" onClick={onDeploy} disabled={!canDeploy}>
          Deploy
        </Button>
      </div>
    </Card>
  )
}
