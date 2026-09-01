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
    return <Checks className="size-4 text-emerald-600 dark:text-emerald-400" />
  }
  if (s.includes("DELIVERED")) {
    return <Checks className="size-4 text-blue-600 dark:text-blue-400" />
  }
  if (s.includes("SENT")) {
    return <Check className="size-4 text-purple-600 dark:text-purple-400" />
  }
  if (s.includes("FAIL") || s.includes("ERROR")) {
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
    return (
      <PaperPlaneTilt className="size-4 text-indigo-600 dark:text-indigo-400" />
    )
  }
  if (s.includes("WEBHOOK")) {
    return <Broadcast className="size-4 text-sky-600 dark:text-sky-400" />
  }
  return <Clock className="size-4 text-muted-foreground" />
}

function renderStatusBadge(status: string) {
  const s = status.toUpperCase()
  if (s === "READ" || s === "CONFIRMED") {
    return (
      <Badge className="border-emerald-500/30 bg-emerald-500/15 text-[10px] text-emerald-700 dark:text-emerald-300">
        {status}
      </Badge>
    )
  }
  if (s === "DELIVERED") {
    return (
      <Badge className="border-blue-500/30 bg-blue-500/15 text-[10px] text-blue-700 dark:text-blue-300">
        DELIVERED
      </Badge>
    )
  }
  if (s === "SENT") {
    return (
      <Badge className="border-purple-500/30 bg-purple-500/15 text-[10px] text-purple-700 dark:text-purple-300">
        SENT
      </Badge>
    )
  }
  if (s === "RECEIVED" || s === "SUCCESS" || s === "OK") {
    return (
      <Badge className="border-sky-500/40 bg-sky-500/10 text-[10px] text-sky-700 dark:text-sky-300">
        {status}
      </Badge>
    )
  }
  if (s === "INITIATED" || s === "START") {
    return (
      <Badge className="border-indigo-500/30 bg-indigo-500/15 text-[10px] text-indigo-700 dark:text-indigo-300">
        {status}
      </Badge>
    )
  }
  if (s.includes("PENDING") || s.includes("CHARGED")) {
    return (
      <Badge className="border-amber-500/30 bg-amber-500/15 text-[10px] text-amber-700 dark:text-amber-300">
        {status}
      </Badge>
    )
  }
  if (s.includes("FAIL") || s.includes("ERROR")) {
    return (
      <Badge variant="destructive" className="text-[10px]">
        {status}
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" className="text-[10px]">
      {status || "PENDING"}
    </Badge>
  )
}

export function MessageJourneyTimeline({
  journey,
}: {
  journey: WhatsappMessageJourneyDTO
}) {
  return (
    <div className="relative space-y-6 pl-6 before:absolute before:top-2 before:bottom-2 before:left-[11px] before:w-[2px] before:bg-border">
      {journey.timeline.map((step, index) => {
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
                {renderStatusBadge(step.status)}
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
