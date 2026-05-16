import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import { DEPLOY_LOG_LINES } from "@/modules/deploy/deploy.mock"
import type {
  DeployLogScope,
  DeployStatus,
  DeployLogLine,
} from "@/modules/deploy/deploy.types"

type LogsPanelProps = {
  status: DeployStatus
  scope: DeployLogScope
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
    const lineStatusIndex = statusOrder.findIndex((item) => item === line.status)
    const inScope = scope === "all" ? true : line.scope === scope
    return inScope && lineStatusIndex <= currentStatusIndex
  })
}

export function LogsPanel({ status, scope, onScopeChange }: LogsPanelProps) {
  const [isOpen, setIsOpen] = useState(status === "failed")

  const visibleLines = useMemo(() => {
    return getVisibleLogLines(DEPLOY_LOG_LINES, status, scope)
  }, [scope, status])

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="flex items-center justify-between gap-2 border border-border bg-muted/20 px-3 py-2">
        <p className="text-xs font-medium">Logs</p>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" type="button">
            {isOpen ? "Hide logs" : "Show logs"}
          </Button>
        </CollapsibleTrigger>
      </div>

      <CollapsibleContent className="space-y-3 border border-t-0 border-border p-3">
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
            <li className="text-zinc-400">Logs will appear after deploy starts.</li>
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
