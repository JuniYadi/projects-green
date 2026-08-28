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
import { Copy, Check } from "@phosphor-icons/react"
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

  const handleCopyJSON = async () => {
    try {
      await navigator.clipboard.writeText(
        JSON.stringify(event.metaPayload ?? event, null, 2)
      )
      setCopied(true)
      toast.success("Webhook payload JSON copied to clipboard")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Failed to copy JSON")
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader className="border-b pb-4">
          <div className="flex items-center justify-between gap-2">
            <SheetTitle className="text-base font-semibold">
              Webhook Event Detail
            </SheetTitle>
            <div className="flex items-center gap-1.5">
              <Badge variant="outline">{event.eventType}</Badge>
              <Badge
                variant={
                  event.processingStatus === "SUCCESS"
                    ? "default"
                    : event.processingStatus === "FAILED"
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

        <div className="space-y-5 py-4">
          {/* Metadata Cards */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="space-y-1 rounded-md border bg-muted/20 p-2.5">
              <span className="font-medium text-muted-foreground">Device:</span>
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
              <span className="font-medium text-muted-foreground">
                WA Message ID:
              </span>
              <p className="font-mono text-[11px] break-all">
                {event.waMessageId || "—"}
              </p>
            </div>
          </div>

          {/* Raw / Structured Payload JSON */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">
                Raw Payload Inspector
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => void handleCopyJSON()}
              >
                {copied ? (
                  <>
                    <Check className="mr-1.5 size-3.5 text-emerald-500" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="mr-1.5 size-3.5" />
                    Copy JSON
                  </>
                )}
              </Button>
            </div>

            <pre className="max-h-[400px] overflow-auto rounded-lg border bg-muted/50 p-3 font-mono text-xs break-all whitespace-pre-wrap text-foreground/90">
              {event.metaPayload
                ? JSON.stringify(event.metaPayload, null, 2)
                : JSON.stringify(event, null, 2)}
            </pre>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
