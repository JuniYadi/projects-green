"use client"

import * as React from "react"
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
  const failureReason =
    latestStatus === "FAILED" ? topStatusRecord?.error : null

  if (latestStatus === "FAILED") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-medium text-destructive hover:bg-destructive/10"
              title="Failed to deliver"
            >
              <WarningCircle className="size-3 text-destructive" weight="fill" />
              <span>Failed</span>
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-[240px] text-xs">
            <p className="font-semibold text-destructive">Delivery Failed</p>
            <p className="mt-0.5 text-muted-foreground">
              {failureReason || "Message could not be delivered by WhatsApp."}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center">
            <StatusIcon status={latestStatus} className="size-3.5" />
          </span>
        </TooltipTrigger>
        <TooltipContent className="text-xs">
          {STATUS_CONFIG[latestStatus].label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
