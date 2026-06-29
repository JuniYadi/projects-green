"use client"

import * as React from "react"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Clock, Check, X, CheckCircle } from "@phosphor-icons/react"
import type { Prisma } from "@prisma/client"

// ponytail: inline type, add shared type when used in >1 file
type DeliveryStatus = "SENT" | "DELIVERED" | "READ" | "FAILED"

interface StatusHistory {
  status: DeliveryStatus
  error: string | null
}

interface MessageStatusBadgeProps {
  statusHistory?: StatusHistory[]
  direction: "INBOX" | "OUTBOX"
}

const STATUS_CONFIG: Record<
  DeliveryStatus,
  { label: string; variant: "secondary" | "outline" | "default" | "destructive" | "success" }
> = {
  SENT: { label: "Sent", variant: "outline" },
  DELIVERED: { label: "Delivered", variant: "default" },
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
      return <Check weight="bold" className={className} />
    case "DELIVERED":
      return <CheckCircle weight="fill" className={className} />
    case "READ":
      return <CheckCircle weight="fill" className={`${className} text-blue-500`} />
    case "FAILED":
      return <X weight="bold" className={className} />
    default:
      return <Clock weight="fill" className={className} />
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

  // Get the latest status for OUTBOX messages
  const latestStatus = statusHistory[0]?.status
  if (!latestStatus) return null

  const config = STATUS_CONFIG[latestStatus]
  const failureReason = latestStatus === "FAILED" ? statusHistory[0]?.error : null

  if (failureReason) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant={config.variant}
              className="ml-1 gap-1 text-[10px]"
            >
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
