import { DEPLOY_STATUS_LABELS } from "@/modules/deploy/deploy.constants"
import { DeployStepTimeline } from "@/modules/deploy/ui/deploy-timeline"
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
  liveDomain?: string
  onLogScopeChange: (scope: DeployLogScope) => void
  onRetry: () => void
  onEditSettings: () => void
}

const STATUS_COPY: Record<
  DeployStatus,
  { title: string; supportText: string }
> = {
  idle: {
    title: "Getting your site ready",
    supportText: "We'll start building it shortly.",
  },
  queued: {
    title: "Getting your site ready",
    supportText: "We'll start building it shortly.",
  },
  building: {
    title: "Building your site",
    supportText: "We're preparing it to run online.",
  },
  deploying: {
    title: "Putting your site online",
    supportText: "We're connecting it to your web address.",
  },
  running: {
    title: "Your site is live",
    supportText: "Your web address is ready to visit.",
  },
  failed: {
    title: "We couldn't publish your site",
    supportText:
      "We hit an issue while deploying. Review logs and retry with updated settings.",
  },
}

export function StepMonitorV2({
  deployId,
  status,
  logScope,
  attempt,
  failureReason,
  liveDomain,
  onLogScopeChange,
  onRetry,
  onEditSettings,
}: StepMonitorV2Props) {
  const copy = STATUS_COPY[status]
  const supportText =
    status === "failed" ? (failureReason ?? copy.supportText) : copy.supportText
  const normalizedAttempt = Math.max(attempt, 1)

  return (
    <div className="space-y-4 p-6">
      <div className="space-y-1" aria-live="polite">
        <h2 className="text-xl font-bold">{copy.title}</h2>
        <p className="text-sm text-muted-foreground">{supportText}</p>
        <div className="flex items-center gap-2 pt-2">
          <span className="text-xs text-muted-foreground">Current status:</span>
          <span className="rounded-md border border-border px-2 py-1 text-xs font-medium">
            {DEPLOY_STATUS_LABELS[status]}
          </span>
          <span className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
            Attempt {normalizedAttempt}
          </span>
        </div>
      </div>

      <ResultPanel
        status={status}
        failureReason={failureReason}
        attempt={normalizedAttempt}
        onRetry={onRetry}
        onEditSettings={onEditSettings}
      />

      <details className="space-y-3 rounded-lg border border-border p-4">
        <summary className="cursor-pointer text-sm font-semibold">
          Show technical progress
        </summary>
        <div className="space-y-4 pt-2">
          <section className="space-y-2">
            <h3 className="text-sm font-medium">Status timeline</h3>
            <DeployStepTimeline
              deployId={deployId}
              status={status}
              liveDomain={liveDomain}
              onRetry={onRetry}
            />
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-medium">Build and runtime logs</h3>
            <LogsPanel
              deployId={deployId}
              status={status}
              scope={logScope}
              attempt={normalizedAttempt}
              onScopeChange={onLogScopeChange}
            />
          </section>
        </div>
      </details>
    </div>
  )
}
