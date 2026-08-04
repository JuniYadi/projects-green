"use client"

import { enMessages } from "@/lib/i18n/messages/en"
import type { DeployWizardMessages } from "@/lib/i18n/messages/types"
import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ConfidenceBadge } from "@/modules/deploy/ui/confidence-badge"
import type {
  DeployBuildState,
  DetectionResult,
} from "@/modules/deploy/deploy.types"
import {
  CheckCircle,
  ClockCounterClockwise,
  FileCode,
  Gear,
  WarningCircle,
  XCircle,
} from "@/components/ui/phosphor-icons"

type StepDetectV2Props = {
  messages?: DeployWizardMessages
  detectionResult: DetectionResult | null
  isDetecting: boolean
  detectionRetrying: boolean
  detectionAttempt: number
  detectionError: string | null
  detectionErrorCode?: string | null
  buildState: DeployBuildState
  manualOverrideRequired: boolean
  canProceed: boolean
  onBack: () => void
  onNext: () => void
  onBuildFieldChange: (field: string, value: string | number | boolean) => void
  onRetry: () => void
}

type OperationRow = {
  label: string
  icon: React.ReactNode
  status: "idle" | "scanning" | "done" | "error"
}

export function StepDetectV2({
  detectionResult,
  isDetecting,
  detectionRetrying,
  detectionAttempt,
  detectionError: detectionError,
  detectionErrorCode,
  buildState,
  manualOverrideRequired,
  canProceed,
  onBack,
  onNext,
  onBuildFieldChange,
  onRetry,
  messages: providedMessages,
}: StepDetectV2Props) {
  const messages = providedMessages ?? enMessages.console.app.deployWizard
  const isRetryableFailure =
    detectionErrorCode === "NETWORK_ERROR" ||
    detectionErrorCode === "DETECTION_TRANSIENT_PROVIDER_ERROR"
  const isFinalFailure =
    !isDetecting &&
    !!detectionError &&
    detectionAttempt >= 2 &&
    isRetryableFailure
  const isWorking = isDetecting || detectionRetrying

  const [activeOperation, setActiveOperation] = useState(0)

  useEffect(() => {
    if (!isWorking) return

    const resetId = window.setTimeout(() => {
      setActiveOperation(detectionRetrying ? 1 : 0)
    }, 0)
    const intervalId = window.setInterval(() => {
      setActiveOperation((current) => Math.min(current + 1, 3))
    }, 700)

    return () => {
      window.clearTimeout(resetId)
      window.clearInterval(intervalId)
    }
  }, [detectionAttempt, detectionRetrying, isWorking])

  const operations = useMemo<OperationRow[]>(() => {
    const base: OperationRow[] = [
      {
        label: messages.detect.operationReadRepository,
        icon: <FileCode className="h-4 w-4" aria-hidden="true" />,
        status: "idle",
      },
      {
        label: messages.detect.operationDependencies,
        icon: <ClockCounterClockwise className="h-4 w-4" aria-hidden="true" />,
        status: "idle",
      },
      {
        label: messages.detect.operationRuntime,
        icon: <Gear className="h-4 w-4" aria-hidden="true" />,
        status: "idle",
      },
      {
        label: messages.detect.operationPlan,
        icon: <CheckCircle className="h-4 w-4" aria-hidden="true" />,
        status: "idle",
      },
    ]

    if (isWorking) {
      return base.map(
        (op, index): OperationRow => ({
          ...op,
          status:
            index < activeOperation
              ? "done"
              : index === activeOperation
                ? "scanning"
                : "idle",
        })
      )
    }

    if (detectionResult) {
      return base.map((op) => ({ ...op, status: "done" as const }))
    }

    if (detectionError) {
      return base.map((op) => ({ ...op, status: "error" as const }))
    }

    return base
  }, [
    activeOperation,
    detectionError,
    detectionResult,
    isWorking,
    messages.detect,
  ])
  const isPolicyBlocked =
    detectionResult?.status === "blocked" ||
    detectionResult?.status === "unsupported"

  const leadMessage = (() => {
    if (isPolicyBlocked) {
      return (
        detectionResult?.decisionMessage ??
        (detectionResult?.status === "blocked"
          ? "This site cannot be published with the current policy."
          : "This project is not supported yet.")
      )
    }
    if (isFinalFailure || detectionResult?.status === "failed") {
      return "We couldn't check your project automatically."
    }
    if (detectionResult?.status === "low_confidence") {
      return `We found ${detectionResult.framework ?? "your project"}, but it needs a quick check.`
    }
    if (detectionResult) {
      return `We found ${detectionResult.framework ?? "your project"}. Your site is ready to review.`
    }
    return "We couldn't check your project automatically."
  })()

  const statusMessage = (() => {
    if (detectionRetrying) {
      return `Retry attempt ${detectionAttempt} of 2 — please wait while we re-analyze the repository.`
    }
    if (isDetecting)
      return "Scanning repository structure... This can take a minute."
    if (detectionError && !isFinalFailure) {
      return detectionError
    }
    if (isFinalFailure) {
      return "Detection failed after two attempts. Configure build settings manually."
    }
    if (!detectionResult) return "No detection result yet."
    if (detectionResult.decisionMessage) {
      return detectionResult.decisionMessage
    }
    if (detectionResult.status === "failed") {
      return "Detection failed. Review the settings below or enable Dockerfile mode."
    }
    if (detectionResult.status === "low_confidence") {
      return "Detection confidence is low. Review and adjust the settings below."
    }
    return "Detection completed successfully. Review the settings below."
  })()

  const evidenceItems = useMemo(() => {
    if (!detectionResult) return []

    const items: Array<{ label: string; value: string }> = []

    if (detectionResult.language) {
      items.push({ label: "Language", value: detectionResult.language })
    }

    if (detectionResult.framework) {
      const version =
        detectionResult.frameworkVersion &&
        detectionResult.frameworkVersion !== "unknown"
          ? `v${detectionResult.frameworkVersion}`
          : "Not detected"
      items.push({
        label: "Framework",
        value: `${detectionResult.framework} · ${version}`,
      })
    }

    if (detectionResult.primaryEngine) {
      const version =
        detectionResult.primaryEngineVersion &&
        detectionResult.primaryEngineVersion !== "unknown"
          ? `v${detectionResult.primaryEngineVersion}`
          : "Not detected"
      items.push({
        label: "Runtime",
        value: `${detectionResult.primaryEngine} · ${version}`,
      })
    }

    if (detectionResult.secondaryEngine) {
      const version =
        detectionResult.secondaryEngineVersion &&
        detectionResult.secondaryEngineVersion !== "unknown"
          ? `v${detectionResult.secondaryEngineVersion}`
          : "Not detected"
      items.push({
        label: "Secondary runtime",
        value: `${detectionResult.secondaryEngine} · ${version}`,
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
    for (const evidence of detectionResult.evidence ?? []) {
      items.push({
        label: evidence.type,
        value: evidence.detail
          ? `${evidence.value} · ${evidence.detail}`
          : evidence.value,
      })
    }

    const keyCounts = new Map<string, number>()
    return items.map((item) => {
      const identity = JSON.stringify([item.label, item.value])
      const occurrence = keyCounts.get(identity) ?? 0
      keyCounts.set(identity, occurrence + 1)
      return { ...item, key: `${identity}:${occurrence}` }
    })
  }, [detectionResult])

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
  const manualSettingsOpen =
    manualOverrideRequired || isFinalFailure || showValidationErrors

  return (
    <div className="flex flex-col">
      <div className="space-y-4 p-6">
        <div className="space-y-1">
          <h2 className="text-xl font-bold">{messages.detect.heading}</h2>
          <p className="text-sm text-muted-foreground">
            {messages.detect.description}
          </p>
          {!isWorking ? (
            <div className="space-y-1" role="status" aria-live="polite">
              <p className="text-base font-semibold">{leadMessage}</p>
            </div>
          ) : null}
        </div>

        {isWorking ? (
          <div
            className="border border-border bg-muted/20 p-3 text-sm"
            role="status"
            aria-live="polite"
          >
            <p className="font-medium">Checking your project…</p>
            <p className="text-xs text-muted-foreground">
              {operations[activeOperation]?.label ?? "Preparing detection"}
            </p>
            {detectionRetrying ? (
              <p className="text-xs text-muted-foreground">{statusMessage}</p>
            ) : null}
            <div className="sr-only">
              {operations.map((operation) => (
                <span key={operation.label}>{operation.label}</span>
              ))}
            </div>
          </div>
        ) : (
          <details className="border border-border p-3">
            <summary className="cursor-pointer text-sm font-medium">
              Show technical details
            </summary>
            <div className="mt-3 grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_260px]">
              <section className="space-y-2 border border-border p-3">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Detection operations
                </p>
                <div className="space-y-2">
                  {operations.map((op) => (
                    <div
                      key={op.label}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors motion-reduce:transition-none",
                        op.status === "scanning" && "bg-primary/5 text-primary",
                        op.status === "done" &&
                          "bg-emerald-500/5 text-emerald-600",
                        op.status === "error" &&
                          "bg-destructive/5 text-destructive",
                        op.status === "idle" && "text-muted-foreground"
                      )}
                    >
                      <span className="shrink-0">
                        {op.status === "scanning" ? (
                          <span
                            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none"
                            aria-hidden="true"
                          />
                        ) : op.status === "done" ? (
                          <CheckCircle
                            className="h-4 w-4 text-emerald-500"
                            aria-hidden="true"
                          />
                        ) : op.status === "error" ? (
                          <XCircle
                            className="h-4 w-4 text-destructive"
                            aria-hidden="true"
                          />
                        ) : (
                          op.icon
                        )}
                      </span>
                      <span className="flex-1">{op.label}</span>
                      {op.status === "scanning" ? (
                        <span className="text-xs text-muted-foreground">
                          Running…
                        </span>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>

              <section className="space-y-2 border border-border p-3">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Evidence stream
                </p>
                {detectionResult && !isDetecting ? (
                  evidenceItems.length > 0 ? (
                    <ul className="space-y-2 text-xs text-muted-foreground">
                      {evidenceItems.map((item) => (
                        <li
                          key={item.key}
                          className="flex animate-in items-start gap-2 fade-in slide-in-from-bottom-1 motion-reduce:animate-none"
                        >
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                          <span>
                            <span className="font-medium text-foreground">
                              {item.label}
                            </span>
                            <span className="block break-words">
                              {item.value}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No evidence recorded.
                    </p>
                  )
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Evidence appears as the AI scans the repository…
                  </p>
                )}
              </section>

              <section className="space-y-2 border border-border p-3">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Launch verdict
                </p>
                {detectionResult && !isDetecting ? (
                  <>
                    <ConfidenceBadge detectionResult={detectionResult} />
                    <div className="border border-border bg-muted/20 p-3 text-xs">
                      <p className="font-medium text-foreground">
                        Detection status
                      </p>
                      <p className="text-muted-foreground capitalize">
                        {detectionResult.status.replace("_", " ")}
                      </p>
                      {detectionResult.decisionMessage ? (
                        <p className="mt-1 text-foreground">
                          {detectionResult.decisionMessage}
                        </p>
                      ) : null}
                      <p className="mt-1 text-muted-foreground">
                        Confidence: {detectionResult.confidence}%
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
                    {detectionRetrying
                      ? `Waiting before retry ${detectionAttempt} of 2…`
                      : "Waiting for detection…"}
                  </div>
                )}
                {statusMessage ? (
                  <p
                    className="text-xs text-muted-foreground"
                    role="status"
                    aria-live="polite"
                  >
                    {statusMessage}
                  </p>
                ) : null}
              </section>
            </div>
          </details>
        )}

        {detectionError && !isWorking ? (
          <div
            className="flex items-start gap-2 border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive"
            role="alert"
          >
            <WarningCircle
              className="mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
            />
            <div className="flex-1">
              <p>{detectionError}</p>
              {isFinalFailure ? (
                <p className="mt-1">
                  Automatic detection stopped after two attempts. Manual
                  configuration is available below.
                </p>
              ) : null}
            </div>
            {isFinalFailure ? (
              <Button variant="outline" size="sm" onClick={onRetry}>
                Retry detection
              </Button>
            ) : null}
          </div>
        ) : null}

        {!isWorking && (
          <details
            open={manualSettingsOpen}
            className="border border-border p-3"
          >
            <summary className="cursor-pointer text-sm font-medium">
              Change technical settings
            </summary>
            <div className="mt-3 space-y-3">
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
                    value={buildState.frameworkVersion ?? ""}
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

              {!isPolicyBlocked && !showValidationErrors && canProceed ? (
                <div className="border border-border bg-muted/40 p-2 text-xs text-foreground">
                  {buildState.useDockerfile
                    ? "Ready: deployment will use your Dockerfile."
                    : "Ready: build settings are complete."}
                </div>
              ) : null}
            </div>
          </details>
        )}
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
