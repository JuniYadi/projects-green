"use client"

import { Gear } from "@phosphor-icons/react"
import { getMessagesForMaybeLocale } from "@/lib/i18n/messages"
import { cn } from "@/lib/utils"

export type ToolTelemetryBadgeProps = {
  toolName?: string
  args?: unknown
  result?: unknown
  durationMs?: number
  message?: string
  lang?: string
  className?: string
}

export function ToolTelemetryBadge({
  toolName,
  args,
  result,
  durationMs,
  message,
  lang = "en",
  className,
}: ToolTelemetryBadgeProps) {
  const messages = getMessagesForMaybeLocale(lang)
  const agentMessages = messages.console.app.deployAgent
  let formatted = message

  if (!formatted && toolName) {
    const parts: string[] = [`Tool: ${toolName}`]

    if (args !== undefined && args !== null) {
      if (typeof args === "string") {
        const cleanArgs =
          args.trim().startsWith("(") && args.trim().endsWith(")")
            ? args.trim()
            : `(${args})`
        parts.push(cleanArgs)
      } else {
        parts.push(`(${JSON.stringify(args)})`)
      }
    }

    if (result !== undefined && result !== null) {
      const resultStr =
        typeof result === "string" ? result : JSON.stringify(result)
      parts.push(`-> ${resultStr}`)
    }

    if (durationMs !== undefined && durationMs !== null) {
      parts.push(`(${durationMs}ms)`)
    }

    formatted = parts.join(" ")
  }

  // Ensure ⚙ symbol is included if not already present
  const displayText = formatted || "Tool execution"
  const hasGear = displayText.startsWith("⚙")

  return (
    <div
      role="status"
      aria-label={agentMessages.toolTelemetryAriaLabel}
      data-testid="tool-telemetry-badge"
      className={cn(
        "flex items-center gap-2 rounded-md border border-border/50 bg-muted/40 px-2.5 py-1.5 font-mono text-xs text-muted-foreground",
        className
      )}
    >
      {!hasGear && (
        <Gear
          className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
          weight="bold"
          aria-hidden="true"
        />
      )}
      <span className="truncate">
        {hasGear ? displayText : `⚙ ${displayText}`}
      </span>
    </div>
  )
}
