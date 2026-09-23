import { useParams } from "next/navigation"
import { cn } from "@/lib/utils"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import {
  HIGH_CONFIDENCE_THRESHOLD,
  LOW_CONFIDENCE_THRESHOLD,
} from "@/modules/deploy/deploy.constants"
import type { DetectionResult } from "@/modules/deploy/deploy.types"

type ConfidenceBadgeProps = {
  detectionResult: DetectionResult | null
}

export function ConfidenceBadge({ detectionResult }: ConfidenceBadgeProps) {
  const params = useParams<{ lang?: string }>()
  const t = getMessages(
    resolveLocaleOrDefault(params?.lang)
  ).pDeployConfidenceBadge
  if (!detectionResult) {
    return (
      <p className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
        {t.detectionNotStarted}
      </p>
    )
  }

  const confidence = detectionResult.confidence

  if (
    detectionResult.status === "failed" ||
    detectionResult.status === "blocked" ||
    detectionResult.status === "unsupported" ||
    detectionResult.status === "low_confidence" ||
    confidence < LOW_CONFIDENCE_THRESHOLD
  ) {
    return (
      <p
        className={cn(
          "rounded-md border px-2 py-1 text-xs",
          "border-destructive/50 bg-destructive/10 text-destructive"
        )}
      >
        {t.needHelp} ({confidence}%)
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
        {t.looksGood} ({confidence}%)
      </p>
    )
  }

  return (
    <p
      className={cn(
        "rounded-md border px-2 py-1 text-xs",
        "border-amber-500/40 bg-amber-500/10 text-amber-700"
      )}
    >
      {t.verifySettings} ({confidence}%)
    </p>
  )
}
