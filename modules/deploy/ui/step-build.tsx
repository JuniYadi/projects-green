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
import {
  MANUAL_FRAMEWORK_OPTIONS,
  MANUAL_LANGUAGE_OPTIONS,
} from "@/modules/deploy/deploy.constants"
import { ConfidenceBadge } from "@/modules/deploy/ui/confidence-badge"
import { RepositorySummaryBar } from "@/modules/deploy/ui/repository-summary-bar"
import type {
  Branch,
  DetectionResult,
  Owner,
  Repository,
} from "@/modules/deploy/deploy.types"

type StepBuildProps = {
  owner: Owner | null
  repository: Repository | null
  branch: Branch | null
  rootDirectory: string
  detectionResult: DetectionResult | null
  isDetecting: boolean
  language: string
  framework: string
  frameworkVersion: string
  buildCommand: string
  useDockerfile: boolean
  primaryEngine: string
  primaryEngineVersion: string
  secondaryEngine: string
  secondaryEngineVersion: string
  defaultPort: number
  manualOverrideRequired: boolean
  canProceed: boolean
  onBack: () => void
  onNext: () => void
  onBuildFieldChange: (
    field: "language" | "framework" | "frameworkVersion" | "buildCommand" | "useDockerfile" | "primaryEngine" | "primaryEngineVersion" | "secondaryEngine" | "secondaryEngineVersion" | "defaultPort",
    value: string | boolean | number
  ) => void
}

export function StepBuild({
  owner,
  repository,
  branch,
  rootDirectory,
  detectionResult,
  isDetecting,
  language,
  framework,
  frameworkVersion,
  buildCommand,
  useDockerfile,
  primaryEngine,
  primaryEngineVersion,
  secondaryEngine,
  secondaryEngineVersion,
  defaultPort,
  manualOverrideRequired,
  canProceed,
  onBack,
  onNext,
  onBuildFieldChange,
}: StepBuildProps) {
  const detectionStatusMessage = (() => {
    if (isDetecting) {
      return "Detecting framework..."
    }

    if (!detectionResult || detectionResult.status === "failed") {
      return "Detection failed. Add manual build settings or enable Dockerfile."
    }

    if (detectionResult.status === "low_confidence") {
      return "Detection confidence is low. Review settings before continuing."
    }

    return "Detection looks good. You can continue or override values."
  })()

  const normalizedLanguage = (language ?? "").trim()
  const normalizedFramework = (framework ?? "").trim()
  const normalizedBuildCommand = (buildCommand ?? "").trim()

  const needsManualValues = manualOverrideRequired && !useDockerfile
  const missingLanguage = normalizedLanguage.length === 0
  const missingFramework = normalizedFramework.length === 0
  const missingBuildCommand = normalizedBuildCommand.length === 0

  const validationMessages = [
    needsManualValues && missingLanguage ? "Select a language." : null,
    needsManualValues && missingFramework ? "Select a framework." : null,
    needsManualValues && missingBuildCommand ? "Enter a build command." : null,
  ].filter((message): message is string => Boolean(message))

  const showValidationErrors = validationMessages.length > 0 && !canProceed

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
            {detectionStatusMessage}
          </p>

          {isDetecting ? (
            <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              Analyzing repository structure...
            </div>
          ) : (
            <dl className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
              <div className="space-y-1">
                <dt className="font-medium text-foreground">
                  Detected language
                </dt>
                <dd>{detectionResult?.language ?? "Not detected"}</dd>
              </div>
              <div className="space-y-1">
                <dt className="font-medium text-foreground">
                  Detected framework
                </dt>
                <dd>
                  {detectionResult?.framework ?? "Not detected"}
                  {detectionResult?.frameworkVersion
                    ? ` v${detectionResult.frameworkVersion}`
                    : ""}
                </dd>
              </div>
              {detectionResult?.primaryEngine ? (
                <div className="space-y-1">
                  <dt className="font-medium text-foreground">
                    Primary engine
                  </dt>
                  <dd>
                    {detectionResult.primaryEngine}
                    {detectionResult.primaryEngineVersion
                      ? ` v${detectionResult.primaryEngineVersion}`
                      : ""}
                  </dd>
                </div>
              ) : null}
              {detectionResult?.secondaryEngine ? (
                <div className="space-y-1">
                  <dt className="font-medium text-foreground">
                    Secondary engine
                  </dt>
                  <dd>
                    {detectionResult.secondaryEngine}
                    {detectionResult.secondaryEngineVersion
                      ? ` v${detectionResult.secondaryEngineVersion}`
                      : ""}
                  </dd>
                </div>
              ) : null}
              <div className="space-y-1">
                <dt className="font-medium text-foreground">
                  Detected build command
                </dt>
                <dd>{detectionResult?.buildCommand ?? "Not detected"}</dd>
              </div>
              <div className="space-y-1">
                <dt className="font-medium text-foreground">
                  Dockerfile detected
                </dt>
                <dd>{detectionResult?.dockerfileDetected ? "Yes" : "No"}</dd>
              </div>
              <div className="space-y-1">
                <dt className="font-medium text-foreground">
                  Default port
                </dt>
                <dd>
                  {detectionResult?.defaultPort
                    ? detectionResult.defaultPort
                    : "Not detected"}
                </dd>
              </div>
            </dl>
          )}
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
                aria-invalid={needsManualValues && missingLanguage}
                className={cn(
                  "h-8 w-full border border-input bg-transparent px-2.5 text-xs",
                  needsManualValues &&
                    missingLanguage &&
                    "border-destructive focus-visible:outline-destructive"
                )}
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
                aria-invalid={needsManualValues && missingFramework}
                className={cn(
                  "h-8 w-full border border-input bg-transparent px-2.5 text-xs",
                  needsManualValues &&
                    missingFramework &&
                    "border-destructive focus-visible:outline-destructive"
                )}
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

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs font-medium">Framework version</p>
              <Input
                aria-label="Framework version"
                value={frameworkVersion}
                placeholder="e.g. 13.x"
                className="h-8 text-xs"
                onChange={(event) => {
                  onBuildFieldChange(
                    "frameworkVersion",
                    event.target.value
                  )
                }}
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium">Default port</p>
              <Input
                type="number"
                aria-label="Default port"
                value={defaultPort || ""}
                placeholder="e.g. 3000"
                className="h-8 text-xs"
                onChange={(event) => {
                  onBuildFieldChange(
                    "defaultPort",
                    Number(event.target.value)
                  )
                }}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs font-medium">Primary engine</p>
              <Input
                aria-label="Primary engine"
                value={primaryEngine}
                placeholder="e.g. node"
                className="h-8 text-xs"
                onChange={(event) => {
                  onBuildFieldChange(
                    "primaryEngine",
                    event.target.value
                  )
                }}
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium">Engine version</p>
              <Input
                aria-label="Primary engine version"
                value={primaryEngineVersion}
                placeholder="e.g. 24"
                className="h-8 text-xs"
                onChange={(event) => {
                  onBuildFieldChange(
                    "primaryEngineVersion",
                    event.target.value
                  )
                }}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs font-medium">Secondary engine</p>
              <Input
                aria-label="Secondary engine"
                value={secondaryEngine}
                placeholder="e.g. node"
                className="h-8 text-xs"
                onChange={(event) => {
                  onBuildFieldChange(
                    "secondaryEngine",
                    event.target.value
                  )
                }}
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium">Engine version</p>
              <Input
                aria-label="Secondary engine version"
                value={secondaryEngineVersion}
                placeholder="e.g. 24"
                className="h-8 text-xs"
                onChange={(event) => {
                  onBuildFieldChange(
                    "secondaryEngineVersion",
                    event.target.value
                  )
                }}
              />
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium">Build command</p>
            <Input
              aria-label="Build command"
              aria-invalid={needsManualValues && missingBuildCommand}
              value={buildCommand}
              disabled={useDockerfile}
              placeholder="bun run build"
              className={cn(
                needsManualValues &&
                  missingBuildCommand &&
                  "border-destructive focus-visible:ring-destructive"
              )}
              onChange={(event) => {
                onBuildFieldChange("buildCommand", event.target.value)
              }}
            />
            <p className="text-xs text-muted-foreground">
              {useDockerfile
                ? "Build command is ignored because Dockerfile mode is enabled."
                : "This command runs in the selected root directory during build."}
            </p>
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
          <p className="text-xs text-muted-foreground">
            {useDockerfile
              ? "Dockerfile mode is on. Platform detection and command settings are optional."
              : "Dockerfile mode is off. Build command and runtime settings are used."}
          </p>

          {showValidationErrors ? (
            <div
              className="space-y-1 border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive"
              role="alert"
            >
              <p className="font-medium">Build settings need attention</p>
              <ul className="list-disc pl-4">
                {validationMessages.map((message) => {
                  return <li key={message}>{message}</li>
                })}
              </ul>
            </div>
          ) : null}

          {!showValidationErrors && canProceed ? (
            <p className="border border-border bg-muted/40 p-2 text-xs text-foreground">
              {useDockerfile
                ? "Ready: deployment will use your Dockerfile."
                : "Ready: build settings are complete."}
            </p>
          ) : null}
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
