import { cn } from "@/lib/utils"
import {
  HIGH_CONFIDENCE_THRESHOLD,
  LOW_CONFIDENCE_THRESHOLD,
} from "@/modules/deploy/deploy.constants"
import type { DetectionResult } from "@/modules/deploy/deploy.types"

type ConfidenceBadgeProps = {
  detectionResult: DetectionResult | null
}

export function ConfidenceBadge({ detectionResult }: ConfidenceBadgeProps) {
  if (!detectionResult) {
    return (
      <p className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
        Detection not started
      </p>
    )
  }

  const confidence = detectionResult.confidence

  if (detectionResult.status === "failed" || confidence < LOW_CONFIDENCE_THRESHOLD) {
    return (
      <p
        className={cn(
          "rounded-md border px-2 py-1 text-xs",
          "border-destructive/50 bg-destructive/10 text-destructive"
        )}
      >
        Need your help ({confidence}%)
      </p>
    )
  }

  if (confidence >= HIGH_CONFIDENCE_THRESHOLD) {
    return (
      <p
        className={cn(
          "rounded-md border px-2 py-1 text-xs",
          "border-emerald-500/40 bg-emerald-500/10 text-emerald-700"
        )}
      >
        Looks good! ({confidence}%)
      </p>
    )
  }

  return (
    <p
      className={cn(
        "rounded-none border px-2 py-1 text-xs",
        "border-amber-500/40 bg-amber-500/10 text-amber-700"
      )}
    >
      Please verify settings ({confidence}%)
    </p>
  )
}
