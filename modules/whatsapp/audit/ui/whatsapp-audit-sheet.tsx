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
  WarningCircle,
  Clock,
  DeviceMobile,
  User,
  ChatCircleText,
  Info,
} from "@phosphor-icons/react"
import { toast } from "sonner"
import type { AuditLogDTO } from "./whatsapp-audit-table"
import { actionTone } from "./whatsapp-audit-details"

interface AuditLogDetailSheetProps {
  log: AuditLogDTO | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AuditLogDetailSheet({
  log,
  open,
  onOpenChange,
}: AuditLogDetailSheetProps) {
  const [copied, setCopied] = React.useState(false)

  if (!log) return null

  const tone = actionTone(log.action)
  const isFailed = log.status === "FAILED" || Boolean(log.errorMessage)

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

  // Extract human-readable details
  const detailsObj = (log.details as Record<string, unknown>) || {}
  const recipientPhone =
    log.phoneNumber ||
    (typeof detailsObj.phoneNumber === "string"
      ? detailsObj.phoneNumber
      : undefined) ||
    (typeof detailsObj.recipient === "string"
      ? detailsObj.recipient
      : undefined) ||
    (typeof detailsObj.to === "string" ? detailsObj.to : undefined)
  const templateName =
    typeof detailsObj.templateName === "string"
      ? detailsObj.templateName
      : typeof detailsObj.template === "string"
        ? detailsObj.template
        : undefined
  const category =
    typeof detailsObj.category === "string" ? detailsObj.category : undefined
  const correlationId = log.correlationId
  const waMessageId =
    typeof detailsObj.waMessageId === "string"
      ? detailsObj.waMessageId
      : typeof detailsObj.messageId === "string"
        ? detailsObj.messageId
        : undefined
  const messageType =
    typeof detailsObj.type === "string" ? detailsObj.type : undefined

  // Additional key-value attributes from details excluding already extracted
  const additionalEntries = Object.entries(detailsObj).filter(([key]) => {
    return ![
      "phoneNumber",
      "recipient",
      "to",
      "templateName",
      "template",
      "category",
      "waMessageId",
      "messageId",
      "type",
    ].includes(key)
  })
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader className="border-b pb-4">
          <div className="flex items-center justify-between gap-2">
            <SheetTitle className="text-base font-semibold">
              Audit Entry Details
            </SheetTitle>
            <div className="flex items-center gap-1.5">
              <Badge
                variant={
                  tone === "success"
                    ? "default"
                    : tone === "destructive"
                      ? "destructive"
                      : tone === "warning"
                        ? "outline"
                        : "secondary"
                }
              >
                {log.action}
              </Badge>
              <Badge
                variant={
                  log.status === "OK"
                    ? "default"
                    : isFailed
                      ? "destructive"
                      : "secondary"
                }
              >
                {log.status || "UNKNOWN"}
              </Badge>
            </div>
          </div>
          <SheetDescription className="font-mono text-xs">
            ID: {log.id} • {new Date(log.createdAt).toLocaleString()}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4">
          {/* Failure Alert Banner */}
          {isFailed && (
            <div className="flex items-start gap-2.5 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
              <WarningCircle className="mt-0.5 size-4 shrink-0" />
              <div className="space-y-1">
                <span className="font-semibold">Operation Failed</span>
                <p className="leading-relaxed">
                  {log.errorMessage ||
                    log.message ||
                    "Action terminated with failure status."}
                </p>
              </div>
            </div>
          )}

          {/* Overview Key-Value Cards */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="space-y-1 rounded-md border bg-muted/20 p-2.5">
              <div className="flex items-center gap-1 text-muted-foreground">
                <DeviceMobile className="size-3.5" />
                <span className="font-medium">Device:</span>
              </div>
              <p className="truncate font-mono font-medium">
                {log.deviceLabel || log.deviceId || "—"}
              </p>
            </div>
            <div className="space-y-1 rounded-md border bg-muted/20 p-2.5">
              <div className="flex items-center gap-1 text-muted-foreground">
                <User className="size-3.5" />
                <span className="font-medium">Actor / Admin:</span>
              </div>
              <p className="truncate font-medium text-foreground">
                {log.actorName || log.actorEmail || log.adminId || "System"}
              </p>
            </div>

            {recipientPhone && (
              <div className="space-y-1 rounded-md border bg-muted/20 p-2.5">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <ChatCircleText className="size-3.5" />
                  <span className="font-medium">Recipient Phone:</span>
                </div>
                <p className="font-mono font-medium text-foreground">
                  {recipientPhone}
                </p>
              </div>
            )}

            {templateName && (
              <div className="space-y-1 rounded-md border bg-muted/20 p-2.5">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Info className="size-3.5" />
                  <span className="font-medium">Template:</span>
                </div>
                <p className="truncate font-mono font-medium text-foreground">
                  {templateName}
                  {category ? ` (${category})` : ""}
                </p>
              </div>
            )}

            {waMessageId && (
              <div className="space-y-1 rounded-md border bg-muted/20 p-2.5">
                <span className="font-medium text-muted-foreground">
                  WA Message ID:
                </span>
                <div className="flex items-center justify-between gap-1">
                  <p className="truncate font-mono text-[11px] text-foreground">
                    {waMessageId}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      void handleCopy(waMessageId, "WA Message ID")
                    }
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {copied ? (
                      <Check className="size-3 text-emerald-500" />
                    ) : (
                      <Copy className="size-3" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {messageType && (
              <div className="space-y-1 rounded-md border bg-muted/20 p-2.5">
                <span className="font-medium text-muted-foreground">
                  Payload Type:
                </span>
                <p className="font-mono font-medium text-foreground uppercase">
                  {messageType}
                </p>
              </div>
            )}

            <div className="space-y-1 rounded-md border bg-muted/20 p-2.5">
              <span className="font-medium text-muted-foreground">
                IP Address:
              </span>
              <p className="font-mono">{log.ip || "—"}</p>
            </div>

            <div className="space-y-1 rounded-md border bg-muted/20 p-2.5">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Clock className="size-3.5" />
                <span className="font-medium">Duration:</span>
              </div>
              <p className="font-mono">
                {log.durationMs != null ? `${log.durationMs}ms` : "—"}
              </p>
            </div>
          </div>

          {/* Operation Message */}
          {log.message && (
            <div className="space-y-1 rounded-md border bg-muted/10 p-3 text-xs">
              <span className="font-semibold text-muted-foreground">
                Message Summary:
              </span>
              <p className="leading-relaxed text-foreground">{log.message}</p>
            </div>
          )}

          {/* Correlation / Tracking */}
          {correlationId && (
            <div className="rounded-md border bg-muted/10 p-2.5 text-xs">
              <span className="font-medium text-muted-foreground">
                Correlation ID:{" "}
              </span>
              <span className="font-mono break-all text-foreground">
                {correlationId}
              </span>
            </div>
          )}

          {/* Additional Structured Attributes */}
          {additionalEntries.length > 0 && (
            <div className="space-y-2 rounded-lg border bg-muted/10 p-3 text-xs">
              <span className="font-semibold text-muted-foreground">
                Additional Attributes
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
                  JSON.stringify(log, null, 2),
                  "Audit log record"
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
                  Copy Entry Record
                </>
              )}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
