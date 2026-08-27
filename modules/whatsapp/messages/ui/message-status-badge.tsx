"use client"
import {
  getWhatsAppText,
  WhatsAppText,
} from "@/modules/whatsapp/ui/whatsapp-text"

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

const STATUS_CONFIG: Record<DeliveryStatus, { label: string }> = {
  SENT: { label: "Sent" },
  DELIVERED: { label: "Delivered" },
  READ: { label: "Read" },
  FAILED: { label: "Failed" },
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
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="inline-flex cursor-pointer items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-medium text-destructive hover:bg-destructive/10"
              title={getWhatsAppText("s235")}
            >
              <WarningCircle
                className="size-3 text-destructive"
                weight="fill"
              />
              <span>
                <WhatsAppText id="s155" />
              </span>
            </button>
          </TooltipTrigger>
          <TooltipContent
            side="top"
            className="flex max-w-sm flex-col items-start gap-1 border border-border bg-popover p-3 text-xs text-popover-foreground shadow-md [&_svg]:bg-popover [&_svg]:fill-popover"
          >
            <p className="font-semibold text-destructive">
              <WhatsAppText id="s236" />
            </p>
            <p className="leading-relaxed break-words text-muted-foreground">
              {failureReason || "Message could not be delivered by WhatsApp."}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex cursor-pointer items-center text-muted-foreground hover:text-foreground"
            title={STATUS_CONFIG[latestStatus].label}
            aria-label={STATUS_CONFIG[latestStatus].label}
          >
            <StatusIcon status={latestStatus} className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="border border-border bg-popover px-2.5 py-1 text-xs text-popover-foreground shadow-md [&_svg]:bg-popover [&_svg]:fill-popover"
        >
          {STATUS_CONFIG[latestStatus].label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
