"use client"

import { CheckCircle, XCircle, Phone } from "@phosphor-icons/react"
import { Badge } from "@/components/ui/badge"

type StatusBadgeProps = {
  status: string
  lastHeartbeatAt?: string | null
  className?: string
}

export function StatusBadge({
  status,
  lastHeartbeatAt,
  className,
}: StatusBadgeProps) {
  if (status === "DISCONNECTED") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-destructive">
        <span className="size-2 rounded-full bg-destructive" />
        Disconnected
      </span>
    )
  }
  if (status === "UNKNOWN") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <span className="size-2 rounded-full bg-muted-foreground" />
        Unknown
      </span>
    )
  }
  const isActive = status === "ACTIVE"

  return (
    <Badge variant={isActive ? "default" : "secondary"} className={className}>
      {isActive ? (
        <CheckCircle weight="fill" className="mr-1 size-3.5" />
      ) : (
        <XCircle weight="fill" className="mr-1 size-3.5" />
      )}
      {isActive ? "Active" : "Inactive"}
    </Badge>
  )
}

export function HealthBadge({
  status,
  lastHeartbeatAt,
}: {
  status: string
  lastHeartbeatAt?: string | null
}) {
  if (status === "DISCONNECTED")
    return (
      <Badge variant="destructive" className="gap-1">
        <span className="size-2 rounded-full bg-white" />
        Disconnected
      </Badge>
    )
  if (status === "UNKNOWN" || (status === "ACTIVE" && !lastHeartbeatAt))
    return (
      <Badge variant="secondary" className="gap-1">
        <span className="size-2 rounded-full bg-muted-foreground" />
        Unknown
      </Badge>
    )
  return (
    <Badge variant="success" className="gap-1">
      <span className="size-2 rounded-full bg-green-500" />
      Connected
    </Badge>
  )
}

export function DeviceEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <Phone className="mb-3 size-10 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">No devices found</p>
    </div>
  )
}
