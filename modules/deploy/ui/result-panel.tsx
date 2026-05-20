import { Button } from "@/components/ui/button"
import type { DeployStatus } from "@/modules/deploy/deploy.types"

type ResultPanelProps = {
  status: DeployStatus
  failureReason: string | null
  attempt: number
  onRetry: () => void
  onEditSettings: () => void
}

export function ResultPanel({
  status,
  failureReason,
  attempt,
  onRetry,
  onEditSettings,
}: ResultPanelProps) {
  if (status === "idle") {
    return (
      <div className="border border-border p-4 text-xs text-muted-foreground">
        Deploy to start monitoring results.
      </div>
    )
  }

  if (status === "queued" || status === "building" || status === "deploying") {
    return (
      <div className="space-y-2 border border-primary/40 bg-primary/10 p-4">
        <p className="text-sm font-medium text-primary">
          Deployment in progress
        </p>
        <p className="text-xs text-primary/80">
          Attempt {attempt}: waiting for final runtime result.
        </p>
      </div>
    )
  }

  if (status === "running") {
    return (
      <div className="space-y-3 border border-emerald-500/40 bg-emerald-500/10 p-4">
        <p className="text-sm font-medium text-emerald-700">Deployment live</p>
        <p className="text-xs text-emerald-700">
          Attempt {attempt} finished successfully. Your app is ready to visit.
        </p>
        <Button asChild>
          <a href="#" aria-label="Visit App">
            Visit App
          </a>
        </Button>
      </div>
    )
  }

  if (status === "failed") {
    return (
      <div className="space-y-3 border border-destructive/40 bg-destructive/10 p-4">
        <p className="text-sm font-medium text-destructive">
          Deployment failed
        </p>
        <p className="text-xs text-destructive">
          Attempt {attempt} failed.{" "}
          {failureReason ??
            "We hit an issue while deploying. Review logs and retry with updated settings."}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={onRetry}>
            Retry
          </Button>
          <Button type="button" variant="outline" onClick={onEditSettings}>
            Edit Settings
          </Button>
        </div>
      </div>
    )
  }

  return null
}
