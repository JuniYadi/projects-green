import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
  failureReason: string | null
  onLogScopeChange: (scope: DeployLogScope) => void
  onRetry: () => void
  onEditSettings: () => void
}

export function StepMonitor({
  status,
  logScope,
  failureReason,
  onLogScopeChange,
  onRetry,
  onEditSettings,
}: StepMonitorProps) {
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
          <span className="rounded-none border border-border px-2 py-1 text-xs font-medium">
            {DEPLOY_STATUS_LABELS[status]}
          </span>
        </div>

        <DeployTimeline status={status} />

        <LogsPanel
          status={status}
          scope={logScope}
          onScopeChange={onLogScopeChange}
        />

        <ResultPanel
          status={status}
          failureReason={failureReason}
          onRetry={onRetry}
          onEditSettings={onEditSettings}
        />
      </CardContent>
    </Card>
  )
}
