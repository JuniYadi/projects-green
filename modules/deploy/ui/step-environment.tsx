import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { EnvVarsEditor } from "@/modules/deploy/ui/env-vars-editor"
import { ResourcePlanSelector } from "@/modules/deploy/ui/resource-plan-selector"
import type { EnvVar, ResourcePlanId } from "@/modules/deploy/deploy.types"

type StepEnvironmentProps = {
  useGeneratedSubdomain: boolean
  customDomain: string
  envVars: EnvVar[]
  resourcePlanId: ResourcePlanId
  hasDuplicateEnvKeys: boolean
  canDeploy: boolean
  onBack: () => void
  onDeploy: () => void
  onDomainToggleChange: (value: boolean) => void
  onCustomDomainChange: (value: string) => void
  onAddEnvVar: () => void
  onUpdateEnvVar: (id: string, field: "key" | "value", value: string) => void
  onRemoveEnvVar: (id: string) => void
  onResourcePlanChange: (value: ResourcePlanId) => void
}

export function StepEnvironment({
  useGeneratedSubdomain,
  customDomain,
  envVars,
  resourcePlanId,
  hasDuplicateEnvKeys,
  canDeploy,
  onBack,
  onDeploy,
  onDomainToggleChange,
  onCustomDomainChange,
  onAddEnvVar,
  onUpdateEnvVar,
  onRemoveEnvVar,
  onResourcePlanChange,
}: StepEnvironmentProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Environment</CardTitle>
        <CardDescription>
          Configure domain, secrets, and compute package.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3 border border-border p-3">
          <p className="text-sm font-medium">Domain</p>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={useGeneratedSubdomain}
              onChange={(event) => onDomainToggleChange(event.target.checked)}
            />
            Use generated subdomain (for example `my-app.pfn.app`)
          </label>
          <Input
            aria-label="Custom domain"
            value={customDomain}
            disabled={useGeneratedSubdomain}
            placeholder="app.example.com"
            onChange={(event) => onCustomDomainChange(event.target.value)}
          />
        </div>

        <div className="space-y-3 border border-border p-3">
          <p className="text-sm font-medium">Environment variables</p>
          <EnvVarsEditor
            envVars={envVars}
            hasDuplicateKeys={hasDuplicateEnvKeys}
            onAdd={onAddEnvVar}
            onUpdate={onUpdateEnvVar}
            onRemove={onRemoveEnvVar}
          />
        </div>

        <div className="space-y-3 border border-border p-3">
          <p className="text-sm font-medium">Resource package</p>
          <ResourcePlanSelector
            selectedPlanId={resourcePlanId}
            onChange={onResourcePlanChange}
          />
        </div>

        <div className="space-y-2 border border-dashed border-border p-3">
          <p className="text-sm font-medium">Attached resources</p>
          <p className="text-xs text-muted-foreground">
            No databases attached. You can add Postgres or Redis after
            deployment.
          </p>
        </div>
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
