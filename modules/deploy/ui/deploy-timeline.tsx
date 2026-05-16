import { cn } from "@/lib/utils"
import { DEPLOY_TIMELINE } from "@/modules/deploy/deploy.mock"
import type { DeployStatus } from "@/modules/deploy/deploy.types"

type DeployTimelineProps = {
  status: DeployStatus
}

const getStatusIndex = (status: DeployStatus) => {
  if (status === "queued") {
    return 0
  }

  if (status === "building") {
    return 1
  }

  if (status === "deploying") {
    return 2
  }

  if (status === "running" || status === "failed") {
    return 3
  }

  return -1
}

export function DeployTimeline({ status }: DeployTimelineProps) {
  const statusIndex = getStatusIndex(status)

  return (
    <ol className="grid gap-2 sm:grid-cols-4">
      {DEPLOY_TIMELINE.map((item, index) => {
        const isCompleted = index < statusIndex
        const isActive = index === statusIndex

        return (
          <li
            key={item.id}
            className={cn(
              "border p-2 text-xs",
              isCompleted && "border-emerald-500/40 bg-emerald-500/10",
              isActive && "border-primary bg-primary/10",
              !isCompleted && !isActive && "border-border bg-background"
            )}
          >
            {item.label}
          </li>
        )
      })}
      <li
        className={cn(
          "border p-2 text-xs",
          status === "running" && "border-emerald-500/40 bg-emerald-500/10",
          status === "failed" && "border-destructive/40 bg-destructive/10",
          status !== "running" && status !== "failed" && "border-border"
        )}
      >
        Live
      </li>
    </ol>
  )
}
