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
import { Copy, Check, WarningCircle } from "@phosphor-icons/react"
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

  const handleCopyJSON = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(log, null, 2))
      setCopied(true)
      toast.success("Audit log JSON copied to clipboard")
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
              Audit Log Detail
            </SheetTitle>
            <div className="flex items-center gap-1.5">
              <Badge variant={tone === "danger" ? "destructive" : "outline"}>
                {log.action}
              </Badge>
              <Badge
                variant={
                  log.status === "OK"
                    ? "default"
                    : log.status === "FAILED"
                      ? "destructive"
                      : "secondary"
                }
              >
                {log.status ?? "UNKNOWN"}
              </Badge>
            </div>
          </div>
          <SheetDescription className="font-mono text-xs">
            ID: {log.id} • {new Date(log.createdAt).toLocaleString()}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 py-4">
          {/* Error Banner if Failed */}
          {isFailed && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive">
              <div className="flex items-start gap-2">
                <WarningCircle className="mt-0.5 size-4 shrink-0" />
                <div className="space-y-1">
                  <p className="font-semibold">Execution Failure</p>
                  <p className="font-mono leading-relaxed break-all">
                    {log.errorMessage ||
                      log.message ||
                      "Operation failed without explicit error message."}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Context Attributes */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="space-y-1 rounded-md border bg-muted/20 p-2.5">
              <span className="font-medium text-muted-foreground">Device:</span>
              <p className="truncate font-mono font-medium">
                {log.deviceLabel || log.deviceId || "—"}
              </p>
              {log.phoneNumber && (
                <p className="font-mono text-[11px] text-muted-foreground">
                  {log.phoneNumber}
                </p>
              )}
            </div>
            <div className="space-y-1 rounded-md border bg-muted/20 p-2.5">
              <span className="font-medium text-muted-foreground">
                Actor / Admin:
              </span>
              <p className="truncate font-medium">
                {log.actorName || log.actorEmail || log.adminId || "System"}
              </p>
            </div>
            <div className="space-y-1 rounded-md border bg-muted/20 p-2.5">
              <span className="font-medium text-muted-foreground">
                IP Address:
              </span>
              <p className="font-mono">{log.ip || "—"}</p>
            </div>
            <div className="space-y-1 rounded-md border bg-muted/20 p-2.5">
              <span className="font-medium text-muted-foreground">
                Duration:
              </span>
              <p className="font-mono">
                {log.durationMs != null ? `${log.durationMs}ms` : "—"}
              </p>
            </div>
          </div>

          {/* Message & User Agent */}
          <div className="space-y-2 text-xs">
            {log.message && (
              <div className="space-y-1 rounded-md border bg-muted/10 p-3">
                <span className="font-semibold text-muted-foreground">
                  Message:
                </span>
                <p className="leading-relaxed text-foreground">{log.message}</p>
              </div>
            )}
            {log.userAgent && (
              <div className="space-y-0.5 rounded-md border bg-muted/10 p-2.5">
                <span className="font-medium text-muted-foreground">
                  User Agent:
                </span>
                <p className="font-mono text-[11px] break-all text-muted-foreground">
                  {log.userAgent}
                </p>
              </div>
            )}
          </div>

          {/* Structured Details JSON */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">
                Payload / Details Inspector
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

            <pre className="max-h-[350px] overflow-auto rounded-lg border bg-muted/50 p-3 font-mono text-xs break-all whitespace-pre-wrap text-foreground/90">
              {log.details
                ? JSON.stringify(log.details, null, 2)
                : JSON.stringify(
                    { message: log.message, error: log.errorMessage },
                    null,
                    2
                  )}
            </pre>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
