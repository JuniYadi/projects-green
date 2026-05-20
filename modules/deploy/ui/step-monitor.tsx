import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DEPLOY_STATUS_LABELS } from "@/modules/deploy/deploy.constants"
import { DeployTimeline } from "@/modules/deploy/ui/deploy-timeline"
import { LogsPanel } from "@/modules/deploy/ui/logs-panel"
import { ResultPanel } from "@/modules/deploy/ui/result-panel"
import type {
  DeployLogScope,
  DeployStatus,
} from "@/modules/deploy/deploy.types"

type StepMonitorProps = {
  status: DeployStatus
  logScope: DeployLogScope
  attempt: number
  failureReason: string | null
  onLogScopeChange: (scope: DeployLogScope) => void
  onRetry: () => void
  onEditSettings: () => void
}

export function StepMonitor({
  status,
  logScope,
  attempt,
  failureReason,
  onLogScopeChange,
  onRetry,
  onEditSettings,
}: StepMonitorProps) {
  const isStepComplete = status === "running" || status === "failed"
  const stepStateText =
    status === "idle"
      ? "Monitor step waiting to start."
      : isStepComplete
        ? "Monitor step complete."
        : "Monitor step in progress."

  return (
    <Card>
      <CardHeader>
        <CardTitle>Deploy &amp; Monitor</CardTitle>
        <CardDescription>
          Watch deployment progress and inspect logs in real-time.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Current status:</span>
          <span className="rounded-md border border-border px-2 py-1 text-xs font-medium">
            {DEPLOY_STATUS_LABELS[status]}
          </span>
          <span className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
            Attempt {Math.max(attempt, 1)}
          </span>
        </div>

        <p className="text-xs text-muted-foreground">{stepStateText}</p>

        <section className="space-y-2">
          <h3 className="text-sm font-medium">Status timeline</h3>
          <DeployTimeline status={status} />
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-medium">Build and runtime logs</h3>
          <LogsPanel
            status={status}
            scope={logScope}
            attempt={Math.max(attempt, 1)}
            onScopeChange={onLogScopeChange}
          />
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-medium">Result state</h3>
          <ResultPanel
            status={status}
            failureReason={failureReason}
            attempt={Math.max(attempt, 1)}
            onRetry={onRetry}
            onEditSettings={onEditSettings}
          />
        </section>
      </CardContent>
    </Card>
  )
}
