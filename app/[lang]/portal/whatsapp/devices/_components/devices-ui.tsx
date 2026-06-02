"use client"

import { CheckCircle, XCircle, Phone } from "@phosphor-icons/react"
import { Badge } from "@/components/ui/badge"

type StatusBadgeProps = {
  status: string
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
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

export function DeviceEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <Phone className="mb-3 size-10 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">No devices found</p>
    </div>
  )
}
