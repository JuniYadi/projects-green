"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  CheckIcon,
  SpinnerIcon,
  WarningCircle,
  XIcon,
} from "@/components/ui/phosphor-icons"
import { cn } from "@/lib/utils"
import {
  DEPLOY_EVENT_STEP_INDEX,
  buildDeployTimelineItems,
  toDeployLogLines,
} from "@/modules/deploy/deploy-monitor.dto"
import type {
  DeployLogLine,
  DeployStatus,
  DeployTimelineItem,
  DeployStep,
} from "@/modules/deploy/deploy.types"

type DeployStepTimelineProps = {
  deployId?: string
  status: DeployStatus
  /** Optional live domain shown after DEPLOY_COMPLETED. */
  liveDomain?: string
  /** Explicitly skip build steps for runtime-only attempts. */
  skipBuildSteps?: boolean
  /** Retry handler invoked from the failed step CTA. */
  onRetry?: () => void
  /** Current wizard step — used for gating live URL and retry behavior. */
  currentStep?: DeployStep
  /** Max unlocked wizard step — used for gating live URL and retry behavior. */
  maxUnlockedStep?: DeployStep
}

// Timeline and LogsPanel own 3s polling; stop at running, failed, or idle.
const LAG_THRESHOLD_MS = 120_000
const POLL_INTERVAL_MS = 3_000

type StepUiState = "completed" | "active" | "pending" | "skipped" | "failed"

type FetchedStatus = {
  status: DeployStatus
  failureReason: string | null
  startedAt: string | null
  completedAt: string | null
}

type FetchedEvent = {
  id: string
  type: string
  label: string
  message: string | null
  createdAt: string
}

const STATUS_ORDER: DeployStatus[] = [
  "queued",
  "building",
  "deploying",
  "running",
  "failed",
]

function activeStepIndex(status: DeployStatus): number {
  if (status === "idle") return -1
  if (status === "running") return 13
  if (status === "failed") return 6
  return STATUS_ORDER.indexOf(status)
}

function stepUiState(
  stepIndex: number,
  activeIndex: number,
  status: DeployStatus,
  failedIndex: number | null,
  skipBuildSteps: boolean,
  degraded: boolean
): StepUiState {
  if (skipBuildSteps && stepIndex < 8) return "skipped"
  if (degraded && stepIndex >= 9 && stepIndex <= 11) return "completed"
  if (status === "failed") {
    const failure = failedIndex ?? activeIndex
    if (stepIndex < failure) return "completed"
    if (stepIndex === failure) return "failed"
    return "skipped"
  }
  if (stepIndex < activeIndex) return "completed"
  if (stepIndex === activeIndex) return "active"
  return "pending"
}

function statusText(state: StepUiState): string {
  switch (state) {
    case "completed":
      return "Completed"
    case "active":
      return "In progress"
    case "pending":
      return "Pending"
    case "skipped":
      return "Skipped"
    case "failed":
      return "Failed"
  }
}

function formatDuration(ms: number | null): string {
  if (ms === null || ms <= 0) return "—"
  if (ms < 1_000) return `${ms}ms`
  const seconds = Math.round(ms / 1_000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const rem = seconds % 60
  return rem === 0 ? `${minutes}m` : `${minutes}m ${rem}s`
}

function StepIcon({ state }: { state: StepUiState }) {
  if (state === "completed") {
    return (
      <CheckIcon
        aria-label="Completed"
        className="size-4 text-emerald-600"
        weight="bold"
      />
    )
  }
  if (state === "active") {
    return (
      <SpinnerIcon
        aria-label="In progress"
        className="size-4 animate-spin text-blue-600"
      />
    )
  }
  if (state === "failed") {
    return (
      <WarningCircle
        aria-label="Failed"
        className="size-4 text-destructive"
        weight="fill"
      />
    )
  }
  if (state === "skipped") {
    return (
      <XIcon aria-label="Skipped" className="size-4 text-muted-foreground" />
    )
  }
  return (
    <span
      aria-label="Pending"
      className="size-4 rounded-full border border-border"
    />
  )
}

export function DeployStepTimeline({
  deployId,
  status,
  liveDomain,
  skipBuildSteps,
  onRetry,
}: DeployStepTimelineProps) {
  const [steps] = useState<DeployTimelineItem[]>(() =>
    buildDeployTimelineItems()
  )
  const [fetchedStatus, setFetchedStatus] = useState<FetchedStatus | null>(null)
  const [events, setEvents] = useState<FetchedEvent[]>([])
  const [openStep, setOpenStep] = useState<string | null>(null)
  const [stepLogs, setStepLogs] = useState<Record<string, DeployLogLine[]>>({})
  const [renderTick, setRenderTick] = useState(() => Date.now())
  const [logsError, setLogsError] = useState<string | null>(null)

  const requestVersionRef = useRef(0)
  const fetchStatusRef = useRef<() => Promise<void>>(async () => {})
  const fetchEventsRef = useRef<() => Promise<void>>(async () => {})

  // Reset state when deployId changes so stale data from a previous deployment is cleared.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    requestVersionRef.current += 1
    setFetchedStatus(null)
    setEvents([])
    setOpenStep(null)
    setStepLogs({})
    setLogsError(null)
  }, [deployId])
  /* eslint-enable react-hooks/set-state-in-effect */

  const effectiveStatus = fetchedStatus?.status ?? status

  const hasArgoCDReadiness = events.some(
    (ev) =>
      ev.type === "ARGOCD_SYNC_STARTED" ||
      ev.type === "ARGOCD_SYNCED" ||
      ev.type === "POD_READY"
  )
  const isDegraded = effectiveStatus === "running" && !hasArgoCDReadiness
  const recognizedEvents = events.filter(
    (event) => DEPLOY_EVENT_STEP_INDEX[event.type] !== undefined
  )
  const latestEvent = recognizedEvents[recognizedEvents.length - 1]
  const activeIndex =
    events.length === 0
      ? activeStepIndex(effectiveStatus)
      : latestEvent
        ? DEPLOY_EVENT_STEP_INDEX[latestEvent.type]
        : -1
  const failedIndex = latestEvent
    ? DEPLOY_EVENT_STEP_INDEX[latestEvent.type]
    : null
  const inferredSkipBuild =
    events.some(
      (event) =>
        event.type === "GITOPS_COMMIT_CREATED" ||
        event.type === "MANIFEST_PUSHED"
    ) &&
    !events.some((event) =>
      [
        "BUILD_STARTED",
        "JENKINS_JOB_TRIGGERED",
        "JENKINS_BUILD_QUEUED",
        "JENKINS_BUILD_RUNNING",
        "JENKINS_BUILD_COMPLETED",
      ].includes(event.type)
    )
  const resolvedSkipBuild = skipBuildSteps ?? inferredSkipBuild
  const showLiveUrl =
    effectiveStatus === "running" &&
    Boolean(liveDomain?.trim()) &&
    events.some((event) => event.type === "DEPLOY_COMPLETED")

  const pollActive =
    deployId &&
    effectiveStatus !== "running" &&
    effectiveStatus !== "failed" &&
    effectiveStatus !== "idle"

  const fetchStatus = useCallback(async () => {
    if (!deployId) return
    const requestVersion = requestVersionRef.current
    try {
      const res = await fetch(`/api/deploy/status/${deployId}`)
      if (!res.ok) return
      const json = await res.json()
      if (requestVersion !== requestVersionRef.current) return
      if (json.ok && json.data) {
        setFetchedStatus({
          status: json.data.status,
          failureReason: json.data.failureReason,
          startedAt: json.data.startedAt,
          completedAt: json.data.completedAt,
        })
      }
    } catch {
      // ponytail: swallow — status polling is best-effort
    }
  }, [deployId])
  const fetchEvents = useCallback(async () => {
    if (!deployId) return
    const requestVersion = requestVersionRef.current
    try {
      const res = await fetch(`/api/deploy/events/${deployId}`)
      if (!res.ok) return
      const json = await res.json()
      if (requestVersion !== requestVersionRef.current) return
      if (json.ok && Array.isArray(json.events)) {
        setEvents(json.events)
      }
    } catch {
      // ponytail: swallow — events polling is best-effort
    }
  }, [deployId])
  useEffect(() => {
    fetchStatusRef.current = fetchStatus
    fetchEventsRef.current = fetchEvents
  }, [fetchStatus, fetchEvents])

  useEffect(() => {
    if (!pollActive) return
    fetchStatusRef.current()
    fetchEventsRef.current()
    const id = setInterval(() => {
      fetchStatusRef.current()
      fetchEventsRef.current()
      setRenderTick(Date.now())
    }, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [pollActive])
  // Initial one-shot fetch so the timeline populates even in terminal states.
  useEffect(() => {
    if (deployId && effectiveStatus !== "idle") {
      fetchStatusRef.current()
      fetchEventsRef.current()
    }
  }, [deployId, effectiveStatus])

  const fetchStepLogs = useCallback(
    async (stepId: string) => {
      if (!deployId) return
      const requestVersion = requestVersionRef.current
      try {
        const res = await fetch(`/api/deploy/logs/${deployId}`)
        if (!res.ok) {
          if (requestVersion === requestVersionRef.current) {
            setLogsError("Failed to load logs")
          }
          return
        }
        const json = await res.json()
        if (requestVersion !== requestVersionRef.current) return
        if (!json.ok) {
          setLogsError(json.error || "Failed to load logs")
          return
        }
        const lines = toDeployLogLines(json.data ?? [])
        setStepLogs((prev) => ({ ...prev, [stepId]: lines }))
        setLogsError(null)
      } catch {
        if (requestVersion === requestVersionRef.current) {
          setLogsError("Failed to load logs")
        }
      }
    },
    [deployId]
  )
  const handleStepToggle = (stepId: string, open: boolean) => {
    if (open) {
      setOpenStep(stepId)
      setLogsError(null)
      if (!stepLogs[stepId]) void fetchStepLogs(stepId)
    } else {
      setOpenStep(null)
    }
  }

  const eventForStep = (stepIndex: number): FetchedEvent | undefined => {
    for (let index = recognizedEvents.length - 1; index >= 0; index -= 1) {
      const event = recognizedEvents[index]
      if (DEPLOY_EVENT_STEP_INDEX[event.type] === stepIndex) return event
    }
    return undefined
  }

  if (effectiveStatus === "idle") {
    return (
      <p className="text-sm text-muted-foreground">
        Deployment has not started.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <ol
        className="space-y-2"
        aria-label="Deployment step timeline"
        aria-live="polite"
      >
        {steps.map((step, idx) => {
          const uiState = stepUiState(
            idx,
            activeIndex,
            effectiveStatus,
            effectiveStatus === "failed" ? failedIndex : null,
            resolvedSkipBuild,
            isDegraded
          )
          const ev = eventForStep(idx)
          const stepStartedAt = ev ? Date.parse(ev.createdAt) : null
          const nextEv = recognizedEvents
            .filter(
              (event) => Date.parse(event.createdAt) > (stepStartedAt ?? 0)
            )
            .sort(
              (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)
            )[0]
          const stepEndedAt = nextEv ? Date.parse(nextEv.createdAt) : null
          const duration =
            stepStartedAt !== null && stepEndedAt !== null
              ? stepEndedAt - stepStartedAt
              : uiState === "active" && stepStartedAt !== null
                ? renderTick - stepStartedAt
                : uiState === "active" && fetchedStatus?.startedAt
                  ? renderTick - Date.parse(fetchedStatus.startedAt)
                  : null
          const lagging =
            duration !== null &&
            duration > LAG_THRESHOLD_MS &&
            (uiState === "completed" || uiState === "active")
          const isOpen = openStep === step.id

          return (
            <li
              key={step.id}
              className={cn(
                "rounded-md border p-3",
                uiState === "active" && "border-blue-500/40 bg-blue-500/5",
                uiState === "failed" &&
                  "border-destructive/40 bg-destructive/5",
                uiState === "completed" && "border-border",
                uiState === "pending" && "border-border opacity-70",
                uiState === "skipped" && "border-border opacity-50"
              )}
              aria-current={uiState === "active" ? "step" : undefined}
            >
              <Collapsible
                open={isOpen}
                onOpenChange={(open) => handleStepToggle(step.id, open)}
              >
                <CollapsibleTrigger className="flex w-full items-center gap-3 text-left">
                  <StepIcon state={uiState} />
                  <div className="flex flex-1 flex-col">
                    <span className="text-sm font-medium">{step.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {statusText(uiState)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {lagging && (
                      <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-xs text-amber-700">
                        Lagging
                      </span>
                    )}
                    {duration !== null && (
                      <span className="rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground">
                        {formatDuration(duration)}
                      </span>
                    )}
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-2 border-t border-border pt-2">
                  {uiState === "failed" && (
                    <div className="space-y-2">
                      <p className="text-xs text-destructive">
                        {fetchedStatus?.failureReason ??
                          "Deployment failed at this step."}
                      </p>
                      {onRetry && (
                        <button
                          type="button"
                          onClick={onRetry}
                          className="rounded border border-border px-2 py-1 text-xs hover:bg-muted"
                        >
                          Retry deploy
                        </button>
                      )}
                    </div>
                  )}
                  {isDegraded && idx >= 9 && idx <= 11 && (
                    <p className="text-xs text-amber-600">
                      ArgoCD health not tracked
                    </p>
                  )}
                  {logsError && (
                    <p className="text-xs text-destructive">{logsError}</p>
                  )}
                  {stepLogs[step.id]?.length ? (
                    <ul className="space-y-1 font-mono text-xs">
                      {stepLogs[step.id].map((line) => (
                        <li key={line.id} className="text-muted-foreground">
                          <span className="font-sans text-foreground">
                            [{line.scope}]
                          </span>{" "}
                          {line.message}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No logs for this step.
                    </p>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </li>
          )
        })}
      </ol>

      {showLiveUrl && (
        <a
          href={`https://${liveDomain}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-sm text-blue-600 underline"
        >
          Open live deployment →
        </a>
      )}
    </div>
  )
}
