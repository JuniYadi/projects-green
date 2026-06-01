import { useEffect, useMemo, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import type {
  DeployLogScope,
  DeployStatus,
  DeployLogLine,
} from "@/modules/deploy/deploy.types"

type LogsPanelProps = {
  deployId?: string
  status: DeployStatus
  scope: DeployLogScope
  attempt: number
  onScopeChange: (scope: DeployLogScope) => void
}

const LOG_SCOPES: DeployLogScope[] = ["all", "build", "runtime"]

const getVisibleLogLines = (
  lines: DeployLogLine[],
  status: DeployStatus,
  scope: DeployLogScope
) => {
  const statusOrder: Array<DeployStatus> = [
    "queued",
    "building",
    "deploying",
    "running",
    "failed",
  ]

  const currentStatusIndex = statusOrder.findIndex((item) => item === status)

  return lines.filter((line) => {
    const lineStatusIndex = statusOrder.findIndex(
      (item) => item === line.status
    )
    const inScope = scope === "all" ? true : line.scope === scope
    return inScope && lineStatusIndex <= currentStatusIndex
  })
}

const getStreamStateLabel = (status: DeployStatus) => {
  if (status === "idle") {
    return "Waiting for deployment to start."
  }

  if (status === "running" || status === "failed") {
    return "Deployment finished."
  }

  return "Live updates in progress."
}

const getTerminalLogLine = (
  status: DeployStatus,
  attempt: number
): DeployLogLine | null => {
  if (status === "running") {
    return {
      id: `log-success-${attempt}`,
      scope: "runtime",
      status: "running",
      message: `Attempt ${attempt}: deployment passed health checks.`,
    }
  }

  if (status === "failed") {
    return {
      id: `log-failure-${attempt}`,
      scope: "runtime",
      status: "failed",
      message: `Attempt ${attempt}: rollout failed during health checks.`,
    }
  }

  return null
}

export function LogsPanel({
  deployId,
  status,
  scope,
  attempt,
  onScopeChange,
}: LogsPanelProps) {
  const [localIsOpen, setLocalIsOpen] = useState(status === "failed")
  const [logs, setLogs] = useState<DeployLogLine[]>([])
  const [error, setError] = useState<string | null>(null)
  const isOpen = status === "failed" || localIsOpen

  const fetchLogsRef = useRef<() => void>(() => {})

  useEffect(() => {
    if (!deployId || status === "idle") {
      return
    }

    let attempt = 0
    const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

    const doFetch = async () => {
      attempt++
      try {
        const res = await fetch(`/api/deploy/logs/${deployId}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        if (!json.ok) throw new Error(json.error || "Failed")
        setLogs(json.data)
        setError(null)
        attempt = 0 // reset on success
      } catch (e) {
        if (attempt < 3) {
          await delay(Math.pow(2, attempt) * 1000) // 2s, 4s, 8s
          doFetch()
        } else {
          setError(e instanceof Error ? e.message : "Failed to fetch logs")
        }
      }
    }

    fetchLogsRef.current = doFetch
    doFetch()

    let interval: Timer | null = null
    if (status !== "running" && status !== "failed") {
      interval = setInterval(() => {
        attempt = 0
        fetchLogsRef.current()
      }, 3000)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [deployId, status])

  const visibleLines = useMemo(() => {
    const inScopeLines = getVisibleLogLines(logs, status, scope)
    const terminalLine = getTerminalLogLine(status, attempt)

    if (!terminalLine || (scope !== "all" && scope !== terminalLine.scope)) {
      return inScopeLines
    }

    return [...inScopeLines, terminalLine]
  }, [logs, attempt, scope, status])

  return (
    <Collapsible open={isOpen} onOpenChange={setLocalIsOpen}>
      <div className="flex items-center justify-between gap-2 border border-border bg-muted/20 px-3 py-2">
        <div>
          <p className="text-xs font-medium">Logs</p>
          <p className="text-[11px] text-muted-foreground">
            Stream: {getStreamStateLabel(status)}
          </p>
        </div>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" type="button">
            {isOpen ? "Hide logs" : "Show logs"}
          </Button>
        </CollapsibleTrigger>
      </div>

      <CollapsibleContent className="space-y-3 border border-t-0 border-border p-3">
        {error && (
          <div className="flex items-center justify-between rounded bg-destructive/10 p-2 text-xs text-destructive">
            <span>{error}</span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2"
              onClick={() => {
                if (!deployId || status === "idle") return
                fetchLogsRef.current()
              }}
            >
              Retry
            </Button>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {LOG_SCOPES.map((logScope) => {
            const isSelected = scope === logScope

            return (
              <Button
                key={logScope}
                type="button"
                size="sm"
                variant={isSelected ? "default" : "outline"}
                onClick={() => onScopeChange(logScope)}
              >
                {logScope === "all"
                  ? "All"
                  : logScope === "build"
                    ? "Build"
                    : "Runtime"}
              </Button>
            )
          })}
        </div>

        <ul className="max-h-52 space-y-1 overflow-y-auto border border-border bg-black p-3 text-xs text-emerald-300">
          {visibleLines.length === 0 ? (
            <li className="text-zinc-400">
              Logs will appear after deploy starts.
            </li>
          ) : (
            visibleLines.map((line) => {
              return (
                <li
                  key={line.id}
                  className={cn(
                    "font-mono",
                    line.scope === "runtime" && "text-sky-300"
                  )}
                >
                  [{line.scope}] {line.message}
                </li>
              )
            })
          )}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  )
}
