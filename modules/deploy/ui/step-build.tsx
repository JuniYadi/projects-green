import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  MANUAL_FRAMEWORK_OPTIONS,
  MANUAL_LANGUAGE_OPTIONS,
} from "@/modules/deploy/deploy.constants"
import { ConfidenceBadge } from "@/modules/deploy/ui/confidence-badge"
import { RepositorySummaryBar } from "@/modules/deploy/ui/repository-summary-bar"
import type { Branch, DetectionResult, Owner, Repository } from "@/modules/deploy/deploy.types"

type StepBuildProps = {
  owner: Owner | null
  repository: Repository | null
  branch: Branch | null
  rootDirectory: string
  detectionResult: DetectionResult | null
  language: string
  framework: string
  buildCommand: string
  useDockerfile: boolean
  manualOverrideRequired: boolean
  canProceed: boolean
  onBack: () => void
  onNext: () => void
  onBuildFieldChange: (
    field: "language" | "framework" | "buildCommand" | "useDockerfile",
    value: string | boolean
  ) => void
}

export function StepBuild({
  owner,
  repository,
  branch,
  rootDirectory,
  detectionResult,
  language,
  framework,
  buildCommand,
  useDockerfile,
  manualOverrideRequired,
  canProceed,
  onBack,
  onNext,
  onBuildFieldChange,
}: StepBuildProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Build Settings</CardTitle>
        <CardDescription>
          We detected your build setup. Confirm or adjust it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <RepositorySummaryBar
          owner={owner}
          repository={repository}
          branch={branch}
          rootDirectory={rootDirectory}
        />

        <div className="space-y-2 border border-border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">Detection result</p>
            <ConfidenceBadge detectionResult={detectionResult} />
          </div>
          <p className="text-xs text-muted-foreground">
            {detectionResult?.language && detectionResult?.framework
              ? `${detectionResult.language} with ${detectionResult.framework}`
              : "We could not confidently detect your runtime."}
          </p>
          <p className="text-xs text-muted-foreground">
            Detected build command: {detectionResult?.buildCommand ?? "None"}
          </p>
        </div>

        <div className="space-y-3 border border-border p-3">
          <p className="text-sm font-medium">Manual override</p>
          <p className="text-xs text-muted-foreground">
            {manualOverrideRequired
              ? "Manual setup is required before continuing."
              : "Optional: adjust settings if the detection is not exact."}
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs font-medium">Language</p>
              <select
                aria-label="Language selector"
                className="h-8 w-full border border-input bg-transparent px-2.5 text-xs"
                value={language}
                onChange={(event) => {
                  onBuildFieldChange("language", event.target.value)
                }}
              >
                <option value="">Select language</option>
                {MANUAL_LANGUAGE_OPTIONS.map((option) => {
                  return (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  )
                })}
              </select>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium">Framework</p>
              <select
                aria-label="Framework selector"
                className="h-8 w-full border border-input bg-transparent px-2.5 text-xs"
                value={framework}
                onChange={(event) => {
                  onBuildFieldChange("framework", event.target.value)
                }}
              >
                <option value="">Select framework</option>
                {MANUAL_FRAMEWORK_OPTIONS.map((option) => {
                  return (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  )
                })}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium">Build command</p>
            <Input
              aria-label="Build command"
              value={buildCommand}
              placeholder="npm run build"
              onChange={(event) => {
                onBuildFieldChange("buildCommand", event.target.value)
              }}
            />
          </div>

          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={useDockerfile}
              onChange={(event) => {
                onBuildFieldChange("useDockerfile", event.target.checked)
              }}
            />
            Use Dockerfile instead
          </label>
        </div>
      </CardContent>
      <div className="flex items-center justify-between border-t p-4">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button type="button" onClick={onNext} disabled={!canProceed}>
          Next
        </Button>
      </div>
    </Card>
  )
}
