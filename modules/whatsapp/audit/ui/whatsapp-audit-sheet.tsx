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
import {
  WarningCircle,
  Clock,
  DeviceMobile,
  User,
  ChatCircleText,
  Info,
  Hash,
  Copy,
  Check,
  CheckCircle,
} from "@phosphor-icons/react"
import { toast } from "sonner"
import { actionTone } from "./whatsapp-audit-details"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { useParams } from "next/navigation"
import type { AuditLogRecord } from "@/app/[lang]/console/whatsapp/logs/audit-logs-tab-content"

interface AuditLogDetailSheetProps {
  log: AuditLogRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AuditLogDetailSheet({
  log,
  open,
  onOpenChange,
}: AuditLogDetailSheetProps) {
  const [copiedId, setCopiedId] = React.useState(false)
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const t = messages.console.whatsapp.logs.drawer

  if (!log) return null

  const tone = actionTone(log.action)
  const isFailed =
    log.status?.toUpperCase() === "FAILED" || Boolean(log.errorMessage)
  const isSuccess =
    log.status?.toUpperCase() === "OK" ||
    log.status?.toUpperCase() === "SUCCESS"

  const handleCopyId = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(true)
      toast.success(t.copyIdSuccess)
      setTimeout(() => setCopiedId(false), 2000)
    } catch {
      toast.error(t.copyIdFail)
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
  const correlationId = (log as { correlationId?: string }).correlationId
  const waMessageId =
    typeof detailsObj.waMessageId === "string"
      ? detailsObj.waMessageId
      : typeof detailsObj.messageId === "string"
        ? detailsObj.messageId
        : undefined
  const messageType =
    typeof detailsObj.type === "string" ? detailsObj.type : undefined

  const additionalEntries = Object.entries(detailsObj).filter(([key, val]) => {
    const isExcludedKey = [
      "phoneNumber",
      "recipient",
      "to",
      "templateName",
      "template",
      "category",
      "waMessageId",
      "messageId",
      "type",
      "id",
      "entry",
      "object",
    ].includes(key)
    return (
      !isExcludedKey &&
      typeof val !== "object" &&
      val !== null &&
      val !== undefined
    )
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto px-6 py-6 sm:max-w-lg">
        {/* Header Section */}
        <SheetHeader className="border-b pb-5">
          <div className="flex items-center justify-between gap-3">
            <SheetTitle className="text-lg font-bold tracking-tight">
              {t.titleActivity}
            </SheetTitle>
            <div className="flex items-center gap-2">
              <Badge
                variant={
                  tone === "success"
                    ? "default"
                    : tone === "danger"
                      ? "destructive"
                      : tone === "warning"
                        ? "outline"
                        : "secondary"
                }
                className="text-xs font-semibold tracking-wide uppercase"
              >
                {log.action}
              </Badge>
              <Badge
                variant={
                  isSuccess ? "default" : isFailed ? "destructive" : "secondary"
                }
                className="text-xs font-semibold tracking-wide uppercase"
              >
                {isSuccess
                  ? t.statusSuccess
                  : isFailed
                    ? t.statusFailed
                    : log.status || "OK"}
              </Badge>
            </div>
          </div>
          <SheetDescription className="pt-1 font-mono text-xs text-muted-foreground">
            {t.idLabel}: {log.id}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 pt-5">
          {/* Status Hero Card */}
          <div
            className={`flex items-start gap-3 rounded-xl border p-4 ${
              isFailed
                ? "border-destructive/30 bg-destructive/5 text-destructive"
                : "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
            }`}
          >
            {isFailed ? (
              <WarningCircle className="mt-0.5 size-5 shrink-0" />
            ) : (
              <CheckCircle className="mt-0.5 size-5 shrink-0" />
            )}
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">
                  {isSuccess ? t.statusSuccess : t.statusFailed}
                </span>
                <span className="font-mono text-xs opacity-80">
                  {new Date(log.createdAt).toLocaleTimeString(locale)}
                </span>
              </div>
              <p className="text-xs leading-relaxed opacity-90">
                {(log as { errorMessage?: string }).errorMessage ||
                  log.message ||
                  (isSuccess
                    ? t.statusDescSuccessAudit
                    : t.statusDescFailedAudit)}
              </p>
            </div>
          </div>

          {/* Section 1: Pengiriman & Perangkat */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
              {t.sectionContact}
            </h4>
            <div className="divide-y divide-border/60 rounded-xl border bg-card p-4">
              <div className="space-y-1 pb-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <DeviceMobile className="size-4" />
                  <span>{t.device}</span>
                </div>
                <p className="font-mono text-sm font-semibold text-foreground">
                  {log.deviceLabel || log.deviceId || "—"}
                </p>
              </div>

              {recipientPhone && (
                <div className="space-y-1 pt-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ChatCircleText className="size-4" />
                    <span>{t.recipientPhone}</span>
                  </div>
                  <p className="font-mono text-sm font-semibold text-foreground">
                    {recipientPhone}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Identitas Pesan / Template */}
          {(templateName || waMessageId || messageType) && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                {t.sectionMessageId}
              </h4>
              <div className="divide-y divide-border/60 rounded-xl border bg-card p-4">
                {templateName && (
                  <div className="space-y-1 pb-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Info className="size-4" />
                      <span>{t.templateLabel}</span>
                    </div>
                    <p className="font-mono text-sm font-semibold text-foreground">
                      {templateName}
                      {category ? ` (${category})` : ""}
                    </p>
                  </div>
                )}

                {waMessageId && (
                  <div className="space-y-2 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <Hash className="size-4" />
                        <span>{t.waMessageId}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleCopyId(String(waMessageId))}
                        className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs font-medium text-muted-foreground shadow-xs transition-colors hover:bg-accent hover:text-foreground"
                      >
                        {copiedId ? (
                          <>
                            <Check className="size-3.5 text-emerald-500" />
                            <span className="text-emerald-600">
                              {t.copiedButton}
                            </span>
                          </>
                        ) : (
                          <>
                            <Copy className="size-3.5" />
                            <span>{t.copyIdButton}</span>
                          </>
                        )}
                      </button>
                    </div>
                    <p className="rounded-md border bg-muted/40 p-2.5 font-mono text-xs leading-relaxed break-all text-foreground select-all">
                      {waMessageId}
                    </p>
                  </div>
                )}

                {messageType && (
                  <div className="flex items-center justify-between gap-2 pt-3">
                    <span className="text-xs font-medium text-muted-foreground">
                      {t.payloadType}
                    </span>
                    <Badge
                      variant="outline"
                      className="font-mono text-xs uppercase"
                    >
                      {messageType}
                    </Badge>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Section 3: Ringkasan Aktivitas */}
          {log.message && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                {t.sectionSummary}
              </h4>
              <div className="rounded-xl border bg-muted/30 p-4 text-xs leading-relaxed font-medium text-foreground">
                {log.message}
              </div>
            </div>
          )}

          {/* Section 4: Informasi Teknis Operasional */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
              {t.sectionTech}
            </h4>
            <div className="divide-y divide-border/60 rounded-xl border bg-card p-4">
              <div className="flex items-center justify-between gap-2 pb-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <User className="size-4" />
                  <span>{t.actor}</span>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-foreground">
                    {log.actorName || log.adminId || "System"}
                  </p>
                  {log.actorEmail && (
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {log.actorEmail}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 py-3">
                <span className="text-xs text-muted-foreground">
                  {t.ipAddress}
                </span>
                <span className="font-mono text-xs text-foreground">
                  {log.ip || "—"}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 py-3">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="size-4" />
                  <span>{t.duration}</span>
                </div>
                <span className="font-mono text-xs font-medium text-foreground">
                  {log.durationMs != null ? `${log.durationMs} ms` : "—"}
                </span>
              </div>

              {correlationId && (
                <div className="flex items-center justify-between gap-2 py-3">
                  <span className="text-xs text-muted-foreground">
                    {t.correlationIdLabel}
                  </span>
                  <span className="text-right font-mono text-[11px] break-all text-foreground">
                    {correlationId}
                  </span>
                </div>
              )}

              {additionalEntries.map(([key, val]) => (
                <div
                  key={key}
                  className="flex items-center justify-between gap-2 py-2.5 last:pb-0"
                >
                  <span className="text-xs text-muted-foreground capitalize">
                    {key.replace(/([A-Z])/g, " $1")}:
                  </span>
                  <span className="text-right font-mono text-xs font-medium break-all text-foreground">
                    {String(val)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
