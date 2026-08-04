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
    isDetecting,
    messages.detect,
  ])

  const statusMessage = (() => {
    if (detectionRetrying) {
      return messages.detect.statusRetrying.replace(
        "{attempt}",
        String(detectionAttempt)
      )
    }
    if (isDetecting) return messages.detect.statusReading
    if (detectionError && !isFinalFailure) {
      return detectionError
    }
    if (isFinalFailure) {
      return messages.detect.statusFinalFailure
    }
    if (!detectionResult) return messages.detect.statusNoResult
    if (detectionResult.decisionMessage) {
      return detectionResult.decisionMessage
    }
    if (detectionResult.status === "failed") {
      return messages.detect.statusFailure
    }
    if (detectionResult.status === "low_confidence") {
      return messages.detect.statusLowConfidence
    }
    return messages.detect.statusSuccess
  })()

  const evidenceItems = useMemo(() => {
    if (!detectionResult) return []

    const items: Array<{ label: string; value: string }> = []

    if (detectionResult.language) {
      items.push({
        label: messages.detect.language,
        value: detectionResult.language,
      })
    }

    if (detectionResult.framework) {
      const version =
        detectionResult.frameworkVersion &&
        detectionResult.frameworkVersion !== "unknown"
          ? `v${detectionResult.frameworkVersion}`
          : messages.detect.notDetected
      items.push({
        label: messages.detect.framework,
        value: `${detectionResult.framework} · ${version}`,
      })
    }

    if (detectionResult.primaryEngine) {
      const version =
        detectionResult.primaryEngineVersion &&
        detectionResult.primaryEngineVersion !== "unknown"
          ? `v${detectionResult.primaryEngineVersion}`
          : messages.detect.notDetected
      items.push({
        label: messages.detect.primaryEngine,
        value: `${detectionResult.primaryEngine} · ${version}`,
      })
    }

    if (detectionResult.secondaryEngine) {
      const version =
        detectionResult.secondaryEngineVersion &&
        detectionResult.secondaryEngineVersion !== "unknown"
          ? `v${detectionResult.secondaryEngineVersion}`
          : messages.detect.notDetected
      items.push({
        label: messages.detect.secondaryRuntime,
        value: `${detectionResult.secondaryEngine} · ${version}`,
      })
    }

    if (detectionResult.buildCommand) {
      items.push({
        label: messages.detect.buildCommand,
        value: detectionResult.buildCommand,
      })
    }

    items.push({
      label: messages.detect.dockerfile,
      value: detectionResult.dockerfileDetected
        ? messages.detect.detected
        : messages.detect.notDetected,
    })

    if (detectionResult.defaultPort) {
      items.push({
        label: messages.detect.defaultPort,
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
  }, [detectionResult, messages.detect])

  const needsManualValues = manualOverrideRequired && !buildState.useDockerfile
  const missingLanguage = buildState.language.trim().length === 0
  const missingFramework = buildState.framework.trim().length === 0
  const missingBuildCommand = buildState.buildCommand.trim().length === 0

  const validationMessages = [
    needsManualValues && missingLanguage
      ? messages.detect.languageRequired
      : null,
    needsManualValues && missingFramework
      ? messages.detect.frameworkRequired
      : null,
    needsManualValues && missingBuildCommand
      ? messages.detect.buildCommandRequired
      : null,
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
        </div>

        <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_260px]">
          <section className="space-y-2 border border-border p-3">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {messages.detect.operations}
            </p>
            <div className="space-y-2">
              {operations.map((op) => (
                <div
                  key={op.label}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors motion-reduce:transition-none",
                    op.status === "scanning" && "bg-primary/5 text-primary",
                    op.status === "done" && "bg-emerald-500/5 text-emerald-600",
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
                      {messages.detect.running}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-2 border border-border p-3">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {messages.detect.evidence}
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
                        <span className="block break-words">{item.value}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {messages.detect.noEvidence}
                </p>
              )
            ) : (
              <p className="text-xs text-muted-foreground">
                {messages.detect.evidenceWaiting}
              </p>
            )}
          </section>

          <section className="space-y-2 border border-border p-3">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {messages.detect.launchVerdict}
            </p>
            {detectionResult && !isDetecting ? (
              <>
                <ConfidenceBadge detectionResult={detectionResult} />
                <div className="border border-border bg-muted/20 p-3 text-xs">
                  <p className="font-medium text-foreground">
                    {messages.detect.detectionStatus}
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
                    {messages.detect.confidence}: {detectionResult.confidence}%
                  </p>
                </div>
              </>
            ) : (
              <div className="border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
                {detectionRetrying
                  ? messages.detect.waitingRetry.replace(
                      "{attempt}",
                      String(detectionAttempt)
                    )
                  : messages.detect.waiting}
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
                <p className="mt-1">{messages.detect.retryFallback}</p>
              ) : null}
            </div>
            {isFinalFailure ? (
              <Button variant="outline" size="sm" onClick={onRetry}>
                {messages.detect.retryDetection}
              </Button>
            ) : null}
          </div>
        ) : null}

        {!isDetecting && (
          <div className="space-y-3 border border-border p-3">
            <p className="text-sm font-medium">
              {messages.detect.manualOverride}
            </p>
            <p className="text-xs text-muted-foreground">
              {manualOverrideRequired
                ? messages.detect.manualRequired
                : messages.detect.optionalAdjust}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="text-xs font-medium">
                  {messages.detect.language}
                </p>
                <select
                  aria-label="Language selector"
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
                >
                  <option value="">{messages.detect.selectLanguage}</option>
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
                <p className="text-xs font-medium">
                  {messages.detect.framework}
                </p>
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
                  <option value="">{messages.detect.selectFramework}</option>
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
                <p className="text-xs font-medium">
                  {messages.detect.frameworkVersion}
                </p>
                <input
                  aria-label={messages.detect.frameworkVersion}
                  className="h-8 w-full border border-input bg-transparent px-2.5 text-xs"
                  onChange={(event) => {
                    onBuildFieldChange("useDockerfile", event.target.checked)
                  }}
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium">
                  {messages.detect.defaultPort}
                </p>
                <input
                  aria-label={messages.detect.defaultPort}
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
                <p className="text-xs font-medium">
                  {messages.detect.primaryEngine}
                </p>
                <input
                  aria-label={messages.detect.primaryEngine}
                  value={buildState.primaryEngine ?? ""}
                  placeholder="e.g. node"
                  className="h-8 w-full border border-input bg-transparent px-2.5 text-xs"
                  onChange={(event) => {
                    onBuildFieldChange("primaryEngine", event.target.value)
                  }}
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium">
                  {messages.detect.engineVersion}
                </p>
                <input
                  aria-label={messages.detect.engineVersion}
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
                <p className="text-xs font-medium">
                  {messages.detect.secondaryEngine}
                </p>
                <input
                  aria-label={messages.detect.secondaryEngine}
                  value={buildState.secondaryEngine ?? ""}
                  placeholder="e.g. node"
                  className="h-8 w-full border border-input bg-transparent px-2.5 text-xs"
                  onChange={(event) => {
                    onBuildFieldChange("secondaryEngine", event.target.value)
                  }}
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium">
                  {messages.detect.engineVersion}
                </p>
                <input
                  aria-label={messages.detect.engineVersion}
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
