import { DEPLOY_STATUS_LABELS } from "@/modules/deploy/deploy.constants"
import { DeployTimeline } from "@/modules/deploy/ui/deploy-timeline"
import { LogsPanel } from "@/modules/deploy/ui/logs-panel"
import { ResultPanel } from "@/modules/deploy/ui/result-panel"
import type {
  DeployLogScope,
  DeployStatus,
} from "@/modules/deploy/deploy.types"

type StepMonitorV2Props = {
  deployId?: string
  status: DeployStatus
  logScope: DeployLogScope
  attempt: number
  failureReason: string | null
  onLogScopeChange: (scope: DeployLogScope) => void
  onRetry: () => void
  onEditSettings: () => void
}

export function StepMonitorV2({
  deployId,
  status,
  logScope,
  attempt,
  failureReason,
  onLogScopeChange,
  onRetry,
  onEditSettings,
}: StepMonitorV2Props) {
  const isStepComplete = status === "running" || status === "failed"
  const stepStateText =
    status === "idle"
      ? "Monitor step waiting to start."
      : isStepComplete
        ? "Monitor step complete."
        : "Monitor step in progress."

  return (
    <div className="space-y-4 p-6">
      <div className="space-y-1">
        <h2 className="text-xl font-bold">Deploy &amp; Monitor</h2>
        <p className="text-sm text-muted-foreground">
          Watch deployment progress and inspect logs in real-time.
        </p>
      </div>

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
        <DeployTimeline deployId={deployId} status={status} />
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-medium">Build and runtime logs</h3>
        <LogsPanel
          deployId={deployId}
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
    </div>
  )
}
