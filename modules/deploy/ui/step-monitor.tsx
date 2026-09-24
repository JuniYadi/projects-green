import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useParams } from "next/navigation"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { DEPLOY_STATUS_LABELS } from "@/modules/deploy/deploy.constants"
import { DeployStepTimeline } from "@/modules/deploy/ui/deploy-timeline"
import { LogsPanel } from "@/modules/deploy/ui/logs-panel"
import { ResultPanel } from "@/modules/deploy/ui/result-panel"
import type {
  DeployLogScope,
  DeployStatus,
} from "@/modules/deploy/deploy.types"

type StepMonitorProps = {
  deployId?: string
  status: DeployStatus
  logScope: DeployLogScope
  attempt: number
  failureReason: string | null
  onLogScopeChange: (scope: DeployLogScope) => void
  onRetry: () => void
  onEditSettings: () => void
}

export function StepMonitor({
  deployId,
  status,
  logScope,
  attempt,
  failureReason,
  onLogScopeChange,
  onRetry,
  onEditSettings,
}: StepMonitorProps) {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const t = getMessages(locale).console.app.deployWizard.monitor
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
        <CardTitle>{t.title}</CardTitle>
        <CardDescription>{t.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {t.currentStatus}
          </span>
          <span className="rounded-md border border-border px-2 py-1 text-xs font-medium">
            {DEPLOY_STATUS_LABELS[status]}
          </span>
          <span className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
            {t.attempt.replace("{attempt}", String(Math.max(attempt, 1)))}
          </span>
        </div>

        <p className="text-xs text-muted-foreground">{stepStateText}</p>

        <section className="space-y-2">
          <h3 className="text-sm font-medium">{t.statusTimeline}</h3>
          <DeployStepTimeline
            deployId={deployId}
            status={status}
            onRetry={onRetry}
          />
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-medium">{t.buildRuntimeLogs}</h3>
          <LogsPanel
            deployId={deployId}
            status={status}
            scope={logScope}
            attempt={Math.max(attempt, 1)}
            onScopeChange={onLogScopeChange}
          />
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-medium">{t.resultState}</h3>
          <ResultPanel
            status={status}
            failureReason={failureReason}
            dashboardHref="/en/console/app/manage"
            attempt={Math.max(attempt, 1)}
            onRetry={onRetry}
            onEditSettings={onEditSettings}
          />
        </section>
      </CardContent>
    </Card>
  )
}
