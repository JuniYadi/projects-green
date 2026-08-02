"use client"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ConfidenceBadge } from "@/modules/deploy/ui/confidence-badge"
import type {
  DeployBuildState,
  DetectionResult,
} from "@/modules/deploy/deploy.types"
import {
  CheckCircle,
  WarningCircle,
  XCircle,
} from "@/components/ui/phosphor-icons"

type StepDetectV2Props = {
  detectionResult: DetectionResult | null
  isDetecting: boolean
  detectionError: string | null
  buildState: DeployBuildState
  manualOverrideRequired: boolean
  canProceed: boolean
  onBack: () => void
  onNext: () => void
  onBuildFieldChange: (field: string, value: string | number | boolean) => void
}

export function StepDetectV2({
  detectionResult,
  isDetecting,
  detectionError,
  buildState,
  manualOverrideRequired,
  canProceed,
  onBack,
  onNext,
  onBuildFieldChange,
}: StepDetectV2Props) {
  const statusIcon = (() => {
    if (isDetecting) {
      return (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"
          aria-hidden="true"
        />
      )
    }

    if (detectionError) {
      return (
        <WarningCircle
          className="h-4 w-4 text-destructive"
          aria-hidden="true"
        />
      )
    }

    if (detectionResult?.status === "success") {
      return (
        <CheckCircle className="h-4 w-4 text-emerald-500" aria-hidden="true" />
      )
    }

    if (detectionResult?.status === "low_confidence") {
      return (
        <WarningCircle className="h-4 w-4 text-amber-500" aria-hidden="true" />
      )
    }

    if (detectionResult?.status === "failed") {
      return <XCircle className="h-4 w-4 text-destructive" aria-hidden="true" />
    }

    return null
  })()

  const statusMessage = (() => {
    if (isDetecting) {
      return "Analyzing repository structure..."
    }

    if (detectionError) {
      return detectionError
    }

    if (!detectionResult) {
      return "No detection result yet."
    }

    if (detectionResult.status === "failed") {
      return "Detection failed. Review the settings below or enable Dockerfile mode."
    }

    if (detectionResult.status === "low_confidence") {
      return "Detection confidence is low. Review and adjust the settings below."
    }

    if (detectionResult.status === "partial") {
      return "Partial detection. Some settings may need adjustment."
    }

    return "Detection completed successfully. Review the settings below."
  })()

  const evidenceItems = (() => {
    if (!detectionResult) return []

    const items: Array<{ label: string; value: string }> = []

    if (detectionResult.language) {
      items.push({ label: "Language", value: detectionResult.language })
    }

    if (detectionResult.framework) {
      items.push({
        label: "Framework",
        value: `${detectionResult.framework}${detectionResult.frameworkVersion ? ` v${detectionResult.frameworkVersion}` : ""}`,
      })
    }

    if (detectionResult.primaryEngine) {
      items.push({
        label: "Runtime",
        value: `${detectionResult.primaryEngine}${detectionResult.primaryEngineVersion ? ` v${detectionResult.primaryEngineVersion}` : ""}`,
      })
    }

    if (detectionResult.secondaryEngine) {
      items.push({
        label: "Secondary runtime",
        value: `${detectionResult.secondaryEngine}${detectionResult.secondaryEngineVersion ? ` v${detectionResult.secondaryEngineVersion}` : ""}`,
      })
    }

    if (detectionResult.buildCommand) {
      items.push({
        label: "Build command",
        value: detectionResult.buildCommand,
      })
    }

    items.push({
      label: "Dockerfile",
      value: detectionResult.dockerfileDetected ? "Detected" : "Not detected",
    })

    if (detectionResult.defaultPort) {
      items.push({
        label: "Default port",
        value: String(detectionResult.defaultPort),
      })
    }

    return items
  })()

  const needsManualValues = manualOverrideRequired && !buildState.useDockerfile
  const missingLanguage = buildState.language.trim().length === 0
  const missingFramework = buildState.framework.trim().length === 0
  const missingBuildCommand = buildState.buildCommand.trim().length === 0

  const validationMessages = [
    needsManualValues && missingLanguage ? "Select a language." : null,
    needsManualValues && missingFramework ? "Select a framework." : null,
    needsManualValues && missingBuildCommand ? "Enter a build command." : null,
  ].filter((message): message is string => Boolean(message))

  const showValidationErrors = validationMessages.length > 0 && !canProceed

  return (
    <div className="flex flex-col">
      <div className="space-y-4 p-6">
        <div className="space-y-1">
          <h2 className="text-xl font-bold">Detect build settings</h2>
          <p className="text-sm text-muted-foreground">
            We analyze your repository to determine the build configuration.
            Confirm or adjust it.
          </p>
        </div>

        <div className="space-y-2 border border-border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">Detection result</p>
            <ConfidenceBadge detectionResult={detectionResult} />
          </div>
          <p className="text-xs text-muted-foreground">{statusMessage}</p>

          {isDetecting ? (
            <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
              {statusIcon}
              <span>Analyzing repository structure...</span>
            </div>
          ) : detectionError ? (
            <div
              className="flex items-start gap-2 py-2 text-xs text-destructive"
              role="alert"
            >
              {statusIcon}
              <span>{detectionError}</span>
            </div>
          ) : (
            <dl className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
              {evidenceItems.map((item) => {
                return (
                  <div key={item.label} className="space-y-1">
                    <dt className="font-medium text-foreground">
                      {item.label}
                    </dt>
                    <dd>{item.value}</dd>
                  </div>
                )
              })}
              {evidenceItems.length === 0 && (
                <dd>No detection evidence available.</dd>
              )}
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
                value={buildState.language}
                onChange={(event) => {
                  onBuildFieldChange("language", event.target.value)
                }}
              >
                <option value="">Select language</option>
                <option value="Node.js">Node.js</option>
                <option value="Python">Python</option>
                <option value="Ruby">Ruby</option>
                <option value="Go">Go</option>
                <option value="Java">Java</option>
                <option value="PHP">PHP</option>
                <option value="Rust">Rust</option>
                <option value="C#">C#</option>
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
                value={buildState.framework}
                onChange={(event) => {
                  onBuildFieldChange("framework", event.target.value)
                }}
              >
                <option value="">Select framework</option>
                <option value="Next.js">Next.js</option>
                <option value="React">React</option>
                <option value="Vue">Vue</option>
                <option value="Svelte">Svelte</option>
                <option value="Astro">Astro</option>
                <option value="Remix">Remix</option>
                <option value="Nuxt">Nuxt</option>
                <option value="Django">Django</option>
                <option value="Flask">Flask</option>
                <option value="FastAPI">FastAPI</option>
                <option value="Rails">Rails</option>
                <option value="Sinatra">Sinatra</option>
                <option value="Spring Boot">Spring Boot</option>
                <option value="Laravel">Laravel</option>
                <option value="Express">Express</option>
                <option value="NestJS">NestJS</option>
              </select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs font-medium">Framework version</p>
              <input
                aria-label="Framework version"
                value={buildState.frameworkVersion}
                placeholder="e.g. 13.x"
                className="h-8 w-full border border-input bg-transparent px-2.5 text-xs"
                onChange={(event) => {
                  onBuildFieldChange("frameworkVersion", event.target.value)
                }}
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium">Default port</p>
              <input
                aria-label="Default port"
                type="number"
                value={buildState.defaultPort || ""}
                placeholder="e.g. 3000"
                className="h-8 w-full border border-input bg-transparent px-2.5 text-xs"
                onChange={(event) => {
                  onBuildFieldChange("defaultPort", Number(event.target.value))
                }}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs font-medium">Primary engine</p>
              <input
                aria-label="Primary engine"
                value={buildState.primaryEngine ?? ""}
                placeholder="e.g. node"
                className="h-8 w-full border border-input bg-transparent px-2.5 text-xs"
                onChange={(event) => {
                  onBuildFieldChange("primaryEngine", event.target.value)
                }}
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium">Engine version</p>
              <input
                aria-label="Primary engine version"
                value={buildState.primaryEngineVersion ?? ""}
                placeholder="e.g. 24"
                className="h-8 w-full border border-input bg-transparent px-2.5 text-xs"
                onChange={(event) => {
                  onBuildFieldChange("primaryEngineVersion", event.target.value)
                }}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs font-medium">Secondary engine</p>
              <input
                aria-label="Secondary engine"
                value={buildState.secondaryEngine ?? ""}
                placeholder="e.g. node"
                className="h-8 w-full border border-input bg-transparent px-2.5 text-xs"
                onChange={(event) => {
                  onBuildFieldChange("secondaryEngine", event.target.value)
                }}
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium">Engine version</p>
              <input
                aria-label="Secondary engine version"
                value={buildState.secondaryEngineVersion ?? ""}
                placeholder="e.g. 24"
                className="h-8 w-full border border-input bg-transparent px-2.5 text-xs"
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
            <input
              aria-label="Build command"
              aria-invalid={needsManualValues && missingBuildCommand}
              value={buildState.buildCommand}
              disabled={buildState.useDockerfile}
              placeholder="bun run build"
              className={cn(
                "h-8 w-full border border-input bg-transparent px-2.5 text-xs",
                needsManualValues &&
                  missingBuildCommand &&
                  "border-destructive focus-visible:ring-destructive",
                buildState.useDockerfile && "opacity-50"
              )}
              onChange={(event) => {
                onBuildFieldChange("buildCommand", event.target.value)
              }}
            />
            <p className="text-xs text-muted-foreground">
              {buildState.useDockerfile
                ? "Build command is ignored because Dockerfile mode is enabled."
                : "This command runs in the selected root directory during build."}
            </p>
          </div>

          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={buildState.useDockerfile}
              onChange={(event) => {
                onBuildFieldChange("useDockerfile", event.target.checked)
              }}
            />
            Use Dockerfile instead
          </label>
          <p className="text-xs text-muted-foreground">
            {buildState.useDockerfile
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
            <div className="border border-border bg-muted/40 p-2 text-xs text-foreground">
              {buildState.useDockerfile
                ? "Ready: deployment will use your Dockerfile."
                : "Ready: build settings are complete."}
            </div>
          ) : null}
        </div>
      </div>
      <div className="flex items-center justify-between border-t p-4">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button type="button" onClick={onNext} disabled={!canProceed}>
          Next
        </Button>
      </div>
    </div>
  )
}
