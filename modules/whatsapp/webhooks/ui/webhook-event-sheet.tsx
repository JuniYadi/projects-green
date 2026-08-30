"use client"

import * as React from "react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Copy,
  Check,
  DeviceMobile,
  ChatCircleText,
  Clock,
  WarningCircle,
  Hash,
} from "@phosphor-icons/react"
import { toast } from "sonner"
import type { WebhookEventDTO } from "./webhook-event-table"

interface WebhookEventDetailSheetProps {
  event: WebhookEventDTO | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function WebhookEventDetailSheet({
  event,
  open,
  onOpenChange,
}: WebhookEventDetailSheetProps) {
  const [copied, setCopied] = React.useState(false)

  if (!event) return null

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success(`${label} copied to clipboard`)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Failed to copy")
    }
  }

  // Extract structured details from metaPayload if available
  const payloadObj = (event.metaPayload as Record<string, unknown>) || {}
  const isFailed = event.processingStatus === "FAILED"

  // Additional key-value attributes from payload excluding known fields
  const additionalEntries = Object.entries(payloadObj).filter(([key]) => {
    return ![
      "id",
      "phoneNumber",
      "deviceLabel",
      "waMessageId",
      "eventType",
      "processingStatus",
      "createdAt",
    ].includes(key)
  })
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader className="border-b pb-4">
          <div className="flex items-center justify-between gap-2">
            <SheetTitle className="text-base font-semibold">
              Webhook Event Summary
            </SheetTitle>
            <div className="flex items-center gap-1.5">
              <Badge variant="outline">{event.eventType}</Badge>
              <Badge
                variant={
                  event.processingStatus === "SUCCESS"
                    ? "default"
                    : isFailed
                      ? "destructive"
                      : "secondary"
                }
              >
                {event.processingStatus}
              </Badge>
            </div>
          </div>
          <SheetDescription className="font-mono text-xs">
            ID: {event.id} • {new Date(event.createdAt).toLocaleString()}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4">
          {/* Error Banner */}
          {isFailed && (
            <div className="flex items-start gap-2.5 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
              <WarningCircle className="mt-0.5 size-4 shrink-0" />
              <div className="space-y-1">
                <span className="font-semibold">Processing Failed</span>
                <p className="leading-relaxed">
                  The webhook event handler failed during event processing.
                  Check technical details below.
                </p>
              </div>
            </div>
          )}

          {/* Structured Key-Value Overview */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="space-y-1 rounded-md border bg-muted/20 p-2.5">
              <div className="flex items-center gap-1 text-muted-foreground">
                <DeviceMobile className="size-3.5" />
                <span className="font-medium">Device:</span>
              </div>
              <p className="truncate font-mono font-medium">
                {event.deviceLabel || "—"}
              </p>
              {event.phoneNumber && (
                <p className="font-mono text-[11px] text-muted-foreground">
                  {event.phoneNumber}
                </p>
              )}
            </div>

            <div className="space-y-1 rounded-md border bg-muted/20 p-2.5">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Hash className="size-3.5" />
                <span className="font-medium">WA Message ID:</span>
              </div>
              <p className="font-mono text-[11px] break-all">
                {event.waMessageId || "—"}
              </p>
            </div>

            <div className="space-y-1 rounded-md border bg-muted/20 p-2.5">
              <div className="flex items-center gap-1 text-muted-foreground">
                <ChatCircleText className="size-3.5" />
                <span className="font-medium">Event Type:</span>
              </div>
              <p className="font-mono font-medium text-foreground">
                {event.eventType}
              </p>
            </div>

            <div className="space-y-1 rounded-md border bg-muted/20 p-2.5">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Clock className="size-3.5" />
                <span className="font-medium">Received At:</span>
              </div>
              <p className="text-[11px] text-foreground">
                {new Date(event.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </p>
            </div>
          </div>

          {/* Additional Structured Attributes */}
          {additionalEntries.length > 0 && (
            <div className="space-y-2 rounded-lg border bg-muted/10 p-3 text-xs">
              <span className="font-semibold text-muted-foreground">
                Payload Data Elements
              </span>
              <div className="grid grid-cols-2 gap-2 pt-1">
                {additionalEntries.map(([key, val]) => (
                  <div
                    key={key}
                    className="rounded border bg-background/80 p-2"
                  >
                    <span className="text-[11px] font-medium text-muted-foreground capitalize">
                      {key.replace(/([A-Z])/g, " $1")}:
                    </span>
                    <p className="mt-0.5 truncate font-mono text-[11px] font-medium text-foreground">
                      {typeof val === "object"
                        ? JSON.stringify(val)
                        : String(val)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Copy Full Record Button without raw JSON dump */}
          <div className="flex items-center justify-end pt-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() =>
                void handleCopy(
                  JSON.stringify(event.metaPayload ?? event, null, 2),
                  "Webhook event payload"
                )
              }
            >
              {copied ? (
                <>
                  <Check className="size-3.5 text-emerald-500" />
                  Copied Details
                </>
              ) : (
                <>
                  <Copy className="size-3.5" />
                  Copy Event Payload
                </>
              )}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
