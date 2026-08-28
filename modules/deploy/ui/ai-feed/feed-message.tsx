"use client"

import type React from "react"

import {
  CheckCircle,
  Spinner,
  Warning,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react"

import type { FeedItemKind } from "./ai-deploy.types"

type FeedMessageProps = {
  kind: FeedItemKind
  statement: string
  details?: React.ReactNode
  actions?: React.ReactNode
  timestamp?: number
  working?: boolean
}

function FeedMessage({
  kind,
  statement,
  details,
  actions,
  timestamp,
  working = false,
}: FeedMessageProps) {
  const icon = working ? (
    <Spinner className="h-5 w-5 animate-spin text-primary" />
  ) : kind.startsWith("source_found") ||
    kind.startsWith("access_verified") ||
    kind.startsWith("detection_success") ||
    kind.startsWith("plan_ready") ||
    kind.startsWith("live") ? (
    <CheckCircle className="h-5 w-5 text-emerald-600" />
  ) : kind === "access_required" ||
    kind === "detection_low_conf" ||
    kind === "not_supported" ? (
    <WarningCircle className="h-5 w-5 text-amber-500" />
  ) : kind === "access_denied" ||
    kind === "detection_failed" ||
    kind === "failed" ? (
    <XCircle className="h-5 w-5 text-destructive" />
  ) : (
    <Warning className="h-5 w-5 text-muted-foreground" />
  )

  return (
    <div
      className={cn("flex gap-3 rounded-xl border border-border bg-card p-4")}
    >
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm font-bold">{statement}</p>
        {details ? (
          <div className="mt-1 text-xs text-muted-foreground">{details}</div>
        ) : null}
        {actions ? <div className="mt-2 flex gap-2">{actions}</div> : null}
        {timestamp ? (
          <time
            dateTime={new Date(timestamp).toISOString()}
            className="sr-only"
          >
            {new Date(timestamp).toLocaleString()}
          </time>
        ) : null}
      </div>
    </div>
  )
}

export { FeedMessage }
export type { FeedMessageProps }
