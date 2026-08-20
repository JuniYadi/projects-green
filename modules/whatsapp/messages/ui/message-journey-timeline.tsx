"use client"

import {
  Clock,
  CurrencyDollar,
  PaperPlaneTilt,
  WarningCircle,
  Broadcast,
  Checks,
  Check,
} from "@phosphor-icons/react"
import { Badge } from "@/components/ui/badge"
import type { WhatsappMessageJourneyDTO } from "../messages.dto"

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function getStepIcon(status: string) {
  const s = status.toUpperCase()
  if (s.includes("READ")) {
    return <Checks className="size-4 text-sky-500" />
  }
  if (s.includes("DELIVERED")) {
    return <Checks className="size-4 text-muted-foreground" />
  }
  if (s.includes("SENT")) {
    return <Check className="size-4 text-muted-foreground" />
  }
  if (s.includes("FAIL")) {
    return <WarningCircle className="size-4 text-destructive" />
  }
  if (
    s.includes("BILLING") ||
    s.includes("CHARGED") ||
    s.includes("CONFIRMED")
  ) {
    return (
      <CurrencyDollar className="size-4 text-emerald-600 dark:text-emerald-400" />
    )
  }
  if (s.includes("INITIATED") || s.includes("START")) {
    return <PaperPlaneTilt className="size-4 text-primary" />
  }
  if (s.includes("WEBHOOK")) {
    return <Broadcast className="size-4 text-purple-600 dark:text-purple-400" />
  }
  return <Clock className="size-4 text-muted-foreground" />
}

function getStatusBadgeVariant(
  status: string
): "default" | "success" | "destructive" | "warning" | "secondary" {
  const s = status.toUpperCase()
  if (
    s.includes("READ") ||
    s.includes("CONFIRMED") ||
    s.includes("SUCCESS") ||
    s.includes("OK")
  )
    return "success"
  if (s.includes("FAIL") || s.includes("ERROR")) return "destructive"
  if (s.includes("DELIVERED") || s.includes("SENT")) return "secondary"
  if (s.includes("PENDING") || s.includes("CHARGED")) return "warning"
  return "default"
}

export function MessageJourneyTimeline({
  journey,
}: {
  journey: WhatsappMessageJourneyDTO
}) {
  return (
    <div className="relative space-y-6 pl-6 before:absolute before:top-2 before:bottom-2 before:left-[11px] before:w-[2px] before:bg-border">
      {journey.timeline.map((step, index) => {
        const variant = getStatusBadgeVariant(step.status)
        return (
          <div
            key={step.id || index}
            className="relative flex items-start gap-4"
          >
            {/* Dot / Icon */}
            <div className="absolute -left-[30px] flex size-6 items-center justify-center rounded-full border bg-background shadow-xs">
              {getStepIcon(step.status)}
            </div>

            {/* Content Card */}
            <div className="flex-1 rounded-lg border bg-card p-4 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-foreground">
                  {step.label}
                </span>
                <Badge variant={variant} className="text-[10px]">
                  {step.status}
                </Badge>
              </div>

              <p className="mt-1 text-xs text-muted-foreground">
                {formatTimestamp(step.timestamp)}
              </p>

              {step.description && (
                <p className="mt-2 rounded border border-border/50 bg-muted/40 p-2 font-mono text-xs text-foreground/80">
                  {step.description}
                </p>
              )}

              {step.error && (
                <p className="mt-2 rounded border border-destructive/20 bg-destructive/10 p-2 font-mono text-xs text-destructive">
                  {step.error}
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
