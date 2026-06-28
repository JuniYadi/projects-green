/**
 * Device Health Badge — shared component for showing device health status.
 *
 * Status mapping:
 *   - ACTIVE + recent heartbeat → green "Connected"
 *   - DISCONNECTED → red "Disconnected" + "Last seen: ..."
 *   - UNKNOWN or ACTIVE with no heartbeat → gray "Unknown"
 */

import { Badge } from "@/components/ui/badge"

export type HealthStatus = "connected" | "disconnected" | "unknown"

export interface DeviceHealthBadgeProps {
  status: string
  lastHeartbeatAt?: string | null
}

function getHealthStatus(
  status: string,
  lastHeartbeatAt: string | null | undefined
): HealthStatus {
  if (status === "DISCONNECTED") return "disconnected"
  if (status === "UNKNOWN") return "unknown"
  if (status === "ACTIVE" && !lastHeartbeatAt) return "unknown"
  if (status === "ACTIVE") return "connected"
  return "unknown"
}

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function DeviceHealthBadge({
  status,
  lastHeartbeatAt,
}: DeviceHealthBadgeProps) {
  const health = getHealthStatus(status, lastHeartbeatAt)

  if (health === "connected") {
    return (
      <Badge variant="success" className="gap-1">
        <span className="size-2 rounded-full bg-green-500" />
        Connected
      </Badge>
    )
  }

  if (health === "disconnected") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-destructive">
        <span className="size-2 rounded-full bg-destructive" />
        Disconnected
        {lastHeartbeatAt && (
          <span className="text-muted-foreground">
            · Last seen {timeAgo(lastHeartbeatAt)}
          </span>
        )}
      </span>
    )
  }

  // Unknown
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <span className="size-2 rounded-full bg-muted-foreground" />
      Unknown
    </span>
  )
}
