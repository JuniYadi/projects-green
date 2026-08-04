import { DEPLOY_STATUS_LABELS } from "@/modules/deploy/deploy.constants"
import { isValidCustomDomain } from "@/modules/deploy/deploy.schema"
import { enMessages } from "@/lib/i18n/messages/en"
import type { DeployWizardMessages } from "@/lib/i18n/messages/types"
import { DeployStepTimeline } from "@/modules/deploy/ui/deploy-timeline"
import { LogsPanel } from "@/modules/deploy/ui/logs-panel"
import { ResultPanel } from "@/modules/deploy/ui/result-panel"
import type {
  DeployLogScope,
  DeployStatus,
} from "@/modules/deploy/deploy.types"

type StepMonitorV2Props = {
  messages?: DeployWizardMessages
  deployId?: string
  status: DeployStatus
  appName: string
  logScope: DeployLogScope
  attempt: number
  failureReason: string | null
  liveDomain?: string
  dashboardHref?: string
  onLogScopeChange: (scope: DeployLogScope) => void
  onRetry: () => void
  onEditSettings: () => void
}

export function StepMonitorV2({
  deployId,
  status,
  appName,
  logScope,
  attempt,
  failureReason,
  liveDomain,
  dashboardHref = "",
  onLogScopeChange,
  onRetry,
  onEditSettings,
  messages: providedMessages,
}: StepMonitorV2Props) {
  const messages = providedMessages ?? enMessages.console.app.deployWizard
  const previewDomain = liveDomain?.trim()
  const previewHref =
    previewDomain && isValidCustomDomain(previewDomain)
      ? `https://${previewDomain}`
      : null
  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-xl font-bold">
            {appName || messages.monitor.yourApp}
          </h2>
          <p className="text-sm text-muted-foreground">
            {messages.monitor.activity[status]}
          </p>
        </div>
        {previewHref && (
          <a
            href={previewHref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary underline"
          >
            {previewDomain}
          </a>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">
          {messages.monitor.currentStatus}
        </span>
        <span className="rounded-md border border-border px-2 py-1 text-xs font-medium">
          {DEPLOY_STATUS_LABELS[status]}
        </span>
        <span className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
          {messages.monitor.attempt.replace(
            "{attempt}",
            String(Math.max(attempt, 1))
          )}
        </span>
      </div>

      <section className="space-y-2">
        <h3 className="text-sm font-medium">
          {messages.monitor.statusTimeline}
        </h3>
        <DeployStepTimeline
          deployId={deployId}
          status={status}
          liveDomain={previewHref ? previewDomain : undefined}
          onRetry={onRetry}
        />
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-medium">
          {messages.monitor.buildRuntimeLogs}
        </h3>
        <LogsPanel
          messages={messages}
          deployId={deployId}
          status={status}
          scope={logScope}
          attempt={Math.max(attempt, 1)}
          initialOpen={false}
          onScopeChange={onLogScopeChange}
        />
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-medium">{messages.monitor.resultState}</h3>
        <ResultPanel
          messages={messages}
          status={status}
          failureReason={failureReason}
          attempt={Math.max(attempt, 1)}
          liveDomain={liveDomain}
          dashboardHref={dashboardHref}
          onRetry={onRetry}
          onEditSettings={onEditSettings}
        />
      </section>
    </div>
  )
}
