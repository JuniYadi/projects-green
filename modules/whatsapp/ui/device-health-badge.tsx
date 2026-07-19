"use client"

import * as React from "react"
import { Badge } from "@/components/ui/badge"

export type DeviceHealthStatus = "CONNECTED" | "DISCONNECTED" | "UNKNOWN"

interface DeviceHealthBadgeProps {
  status: DeviceHealthStatus
  lastHeartbeatAt?: string | null
}

function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "Never"
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60_000)

  if (diffMin < 1) return "Just now"
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDays = Math.floor(diffHr / 24)
  return `${diffDays}d ago`
}

export function DeviceHealthBadge({
  status,
  lastHeartbeatAt,
}: DeviceHealthBadgeProps) {
  const connected = status === "CONNECTED"
  const disconnected = status === "DISCONNECTED"

  const variant = connected
    ? "default"
    : disconnected
      ? "destructive"
      : "secondary"

  const label = connected
    ? "Connected"
    : disconnected
      ? "Disconnected"
      : "Unknown"

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
          Last seen: {formatRelativeTime(lastHeartbeatAt)}
        </span>
      )}
    </div>
  )
}
