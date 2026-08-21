"use client"

import * as React from "react"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Clock, Check, Checks, WarningCircle } from "@phosphor-icons/react"

// ponytail: inline type, add shared type when used in >1 file
type DeliveryStatus = "SENT" | "DELIVERED" | "READ" | "FAILED"

interface StatusHistory {
  status: DeliveryStatus
  error: string | null
  timestamp?: Date | string | null
}

interface MessageStatusBadgeProps {
  statusHistory?: StatusHistory[]
  direction: "INBOX" | "OUTBOX"
}

const STATUS_CONFIG: Record<
  DeliveryStatus,
  {
    label: string
    variant: "secondary" | "outline" | "default" | "destructive" | "success"
  }
> = {
  SENT: { label: "Sent", variant: "secondary" },
  DELIVERED: { label: "Delivered", variant: "outline" },
  READ: { label: "Read", variant: "default" },
  FAILED: { label: "Failed", variant: "destructive" },
}

function StatusIcon({
  status,
  className,
}: {
  status: DeliveryStatus
  className?: string
}) {
  switch (status) {
    case "SENT":
      return <Check className={className} />
    case "DELIVERED":
      return <Checks className={className} />
    case "READ":
      return <Checks className={`${className} text-sky-500`} />
    case "FAILED":
      return <WarningCircle className={className} />
    default:
      return <Clock className={className} />
  }
}

export function MessageStatusBadge({
  statusHistory,
  direction,
}: MessageStatusBadgeProps) {
  // INBOX messages don't have delivery status
  if (direction === "INBOX" || !statusHistory?.length) {
    return null
  }

  // If there's any terminal FAILED status, prioritize FAILED so error details are visible.
  // Otherwise prefer READ > DELIVERED > SENT.
  const failedRecord = statusHistory.find((s) => s.status === "FAILED")
  let topStatusRecord: StatusHistory | undefined

  if (failedRecord) {
    topStatusRecord = failedRecord
  } else {
    const statusRank: Record<DeliveryStatus, number> = {
      READ: 3,
      DELIVERED: 2,
      SENT: 1,
      FAILED: 0,
    }
    const sorted = [...statusHistory].sort(
      (a, b) => (statusRank[b.status] ?? 0) - (statusRank[a.status] ?? 0)
    )
    topStatusRecord = sorted[0]
  }

  const latestStatus = topStatusRecord?.status
  if (!latestStatus) return null
  const config = STATUS_CONFIG[latestStatus]
  const failureReason =
    latestStatus === "FAILED" ? topStatusRecord?.error : null

  if (failureReason) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant={config.variant} className="ml-1 gap-1 text-[10px]">
              <StatusIcon status={latestStatus} className="size-3" />
              {config.label}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="max-w-[200px] text-xs">{failureReason}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }
  return (
    <Badge variant={config.variant} className="ml-1 gap-1 text-[10px]">
      <StatusIcon status={latestStatus} className="size-3" />
      {config.label}
    </Badge>
  )
}
