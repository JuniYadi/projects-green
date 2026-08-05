import { enMessages } from "@/lib/i18n/messages/en"
import type { DeployWizardMessages } from "@/lib/i18n/messages/types"
import { Button } from "@/components/ui/button"
import { isValidCustomDomain } from "@/modules/deploy/deploy.schema"
import type { DeployStatus } from "@/modules/deploy/deploy.types"
type ResultPanelProps = {
  messages?: DeployWizardMessages
  status: DeployStatus
  failureReason: string | null
  attempt: number
  liveDomain?: string
  dashboardHref: string
  onRetry: () => void
  onEditSettings: () => void
}

export function ResultPanel({
  messages: providedMessages,
  status,
  failureReason,
  attempt,
  liveDomain,
  dashboardHref,
  onRetry,
  onEditSettings,
}: ResultPanelProps) {
  const messages = providedMessages ?? enMessages.console.app.deployWizard
  const resultMessages = messages.result
  const previewDomain = liveDomain?.trim()
  const previewHref =
    previewDomain && isValidCustomDomain(previewDomain)
      ? `https://${previewDomain}`
      : null

  if (status === "idle") {
    return (
      <div className="border border-border p-4 text-xs text-muted-foreground">
        {resultMessages.idle}
      </div>
    )
  }

  if (status === "queued" || status === "building" || status === "deploying") {
    return (
      <div className="space-y-2 border border-primary/40 bg-primary/10 p-4">
        <p className="text-sm font-medium text-primary">
          {resultMessages.inProgress}
        </p>
        <p className="text-xs text-primary/80">
          {resultMessages.waiting.replace("{attempt}", String(attempt))}
        </p>
      </div>
    )
  }

  if (status === "running") {
    return (
      <div className="space-y-3 border border-primary/40 bg-primary/10 p-4">
        <p className="text-sm font-medium text-primary">
          {resultMessages.live}
        </p>
        <p className="text-xs text-primary/80">
          {resultMessages.successAttempt.replace("{attempt}", String(attempt))}
        </p>
        <div className="flex flex-wrap gap-2">
          {previewHref && (
            <a
              href={previewHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary underline"
            >
              {resultMessages.visitPreview}
            </a>
          )}
          {dashboardHref && (
            <a href={dashboardHref} className="text-sm text-primary underline">
              {resultMessages.openDashboard}
            </a>
          )}
        </div>
      </div>
    )
  }

  if (status === "failed") {
    return (
      <div className="space-y-3 border border-destructive/40 bg-destructive/10 p-4">
        <p className="text-sm font-medium text-destructive">
          {resultMessages.failed}
        </p>
        <p className="text-xs text-destructive">
          {resultMessages.failedAttempt.replace("{attempt}", String(attempt))}{" "}
          {failureReason ?? resultMessages.failureFallback}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={onRetry}>
            {resultMessages.retry}
          </Button>
          <Button type="button" variant="outline" onClick={onEditSettings}>
            {resultMessages.editSettings}
          </Button>
        </div>
      </div>
    )
  }

  return null
}
