"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"

export type DeviceHealthStatus = "CONNECTED" | "DISCONNECTED" | "UNKNOWN"

interface DeviceHealthBadgeProps {
  status: DeviceHealthStatus
  lastHeartbeatAt?: string | null
}

function formatRelativeTime(
  dateStr: string | null | undefined,
  messages: ReturnType<typeof getMessages>["console"]["whatsapp"]["shared"]
): string {
  if (!dateStr) return messages.never
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60_000)

  if (diffMin < 1) return messages.justNow
  if (diffMin < 60)
    return messages.minutesAgo.replace("{count}", String(diffMin))
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return messages.hoursAgo.replace("{count}", String(diffHr))
  const diffDays = Math.floor(diffHr / 24)
  return messages.daysAgo.replace("{count}", String(diffDays))
}

export function DeviceHealthBadge({
  status,
  lastHeartbeatAt,
}: DeviceHealthBadgeProps) {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale).console.whatsapp.shared
  const connected = status === "CONNECTED"
  const disconnected = status === "DISCONNECTED"

  const variant = connected
    ? "default"
    : disconnected
      ? "destructive"
      : "secondary"

  const label = connected
    ? messages.connected
    : disconnected
      ? messages.disconnected
      : messages.unknown

  const dotColor = connected
    ? "bg-green-500"
    : disconnected
      ? "bg-red-500"
      : "bg-gray-400"

  return (
    <div className="flex items-center gap-1.5">
      <span className={`size-2 rounded-full ${dotColor}`} />
      <Badge variant={variant} className="text-xs">
        {label}
      </Badge>
      {disconnected && lastHeartbeatAt && (
        <span className="text-xs text-muted-foreground">
          {messages.lastSeen.replace(
            "{time}",
            formatRelativeTime(lastHeartbeatAt, messages)
          )}
        </span>
      )}
    </div>
  )
}
