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
  DeviceMobile,
  ChatCircleText,
  Clock,
  WarningCircle,
  Hash,
  Copy,
  Check,
  CheckCircle,
  ArrowDownLeft,
} from "@phosphor-icons/react"
import { toast } from "sonner"
import type { WebhookEventRecord } from "@/app/[lang]/console/whatsapp/logs/webhook-logs-tab-content"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { useParams } from "next/navigation"

interface WebhookEventDetailSheetProps {
  event: WebhookEventRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function WebhookEventDetailSheet({
  event,
  open,
  onOpenChange,
}: WebhookEventDetailSheetProps) {
  const [copiedId, setCopiedId] = React.useState(false)
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const t = messages.console.whatsapp.logs.drawer

  if (!event) return null

  const deliveryStatus = (
    event.deliveryStatus ||
    event.processingStatus ||
    ""
  ).toUpperCase()

  const isFailed = deliveryStatus === "FAILED"
  const isRead = deliveryStatus === "READ"
  const isDelivered = deliveryStatus === "DELIVERED"
  const isSent = deliveryStatus === "SENT"
  const isReceived =
    deliveryStatus === "RECEIVED" || event.eventType === "inbound_message"

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
  const payloadObj = (event.metaPayload as Record<string, unknown>) || {}
  const recipientPhone =
    event.phoneNumber ||
    (typeof payloadObj.recipient === "string"
      ? payloadObj.recipient
      : undefined) ||
    (typeof payloadObj.phoneNumber === "string"
      ? payloadObj.phoneNumber
      : undefined) ||
    (typeof payloadObj.to === "string" ? payloadObj.to : undefined)
  const waMessageId =
    event.waMessageId ||
    (typeof payloadObj.waMessageId === "string"
      ? payloadObj.waMessageId
      : typeof payloadObj.messageId === "string"
        ? payloadObj.messageId
        : undefined)

  const additionalEntries = Object.entries(payloadObj).filter(([key, val]) => {
    const isExcludedKey = [
      "phoneNumber",
      "recipient",
      "to",
      "waMessageId",
      "messageId",
      "eventType",
      "processingStatus",
      "createdAt",
      "entry",
      "object",
      "id",
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
              {t.titleMessages}
            </SheetTitle>
            <Badge
              variant={
                isRead || isDelivered
                  ? "default"
                  : isSent
                    ? "secondary"
                    : isReceived
                      ? "outline"
                      : isFailed
                        ? "destructive"
                        : "secondary"
              }
              className="px-2.5 py-0.5 text-xs font-semibold tracking-wide uppercase"
            >
              {isRead
                ? t.statusRead
                : isDelivered
                  ? t.statusDelivered
                  : isSent
                    ? t.statusSent
                    : isReceived
                      ? t.statusReceived
                      : isFailed
                        ? t.statusFailed
                        : deliveryStatus || event.processingStatus}
            </Badge>
          </div>
          <SheetDescription className="pt-1 font-mono text-xs text-muted-foreground">
            {t.idLabel}: {event.id}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 pt-5">
          {/* Status Hero Card */}
          <div
            className={`flex items-start gap-3 rounded-xl border p-4 ${
              isFailed
                ? "border-destructive/30 bg-destructive/5 text-destructive"
                : isRead || isDelivered
                  ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
                  : isReceived
                    ? "border-sky-500/30 bg-sky-500/5 text-sky-700 dark:text-sky-400"
                    : "border-purple-500/30 bg-purple-500/5 text-purple-700 dark:text-purple-400"
            }`}
          >
            {isFailed ? (
              <WarningCircle className="mt-0.5 size-5 shrink-0" />
            ) : isRead || isDelivered ? (
              <CheckCircle className="mt-0.5 size-5 shrink-0" />
            ) : isReceived ? (
              <ArrowDownLeft className="mt-0.5 size-5 shrink-0" />
            ) : (
              <Check className="mt-0.5 size-5 shrink-0" />
            )}
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">
                  {isRead
                    ? t.statusRead
                    : isDelivered
                      ? t.statusDelivered
                      : isSent
                        ? t.statusSent
                        : isReceived
                          ? t.statusReceived
                          : isFailed
                            ? t.statusFailed
                            : t.statusPending}
                </span>
                <span className="font-mono text-xs opacity-80">
                  {new Date(event.createdAt).toLocaleTimeString(locale)}
                </span>
              </div>
              <p className="text-xs leading-relaxed opacity-90">
                {isRead
                  ? t.statusDescReadWebhook
                  : isDelivered
                    ? t.statusDescDeliveredWebhook
                    : isSent
                      ? t.statusDescSentWebhook
                      : isReceived
                        ? t.statusDescReceivedWebhook
                        : isFailed
                          ? t.statusDescFailedWebhook
                          : t.statusDescSuccessWebhook}
              </p>
            </div>
          </div>

          {/* Section 1: Pengiriman & Kontak */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
              {t.sectionContact}
            </h4>
            <div className="divide-y divide-border/60 rounded-xl border bg-card p-4">
              <div className="space-y-1 pb-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <DeviceMobile className="size-4" />
                  <span>
                    {isReceived
                      ? t.directionTo + " (" + t.device + ")"
                      : t.directionFrom + " (" + t.device + ")"}
                  </span>
                </div>
                <p className="font-mono text-sm font-semibold text-foreground">
                  {event.deviceLabel || event.deviceId || "—"}
                </p>
              </div>

              {recipientPhone && (
                <div className="space-y-1 pt-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ChatCircleText className="size-4" />
                    <span>
                      {isReceived
                        ? t.directionFrom + " (" + t.recipientPhone + ")"
                        : t.directionTo + " (" + t.recipientPhone + ")"}
                    </span>
                  </div>
                  <p className="font-mono text-sm font-semibold text-foreground">
                    {recipientPhone}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Status & Tipe Event */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
              {t.sectionEvent}
            </h4>
            <div className="divide-y divide-border/60 rounded-xl border bg-card p-4">
              <div className="flex items-center justify-between gap-2 pb-3">
                <span className="text-xs font-medium text-muted-foreground">
                  {t.eventType}
                </span>
                <Badge
                  variant="outline"
                  className="font-mono text-xs font-medium capitalize"
                >
                  {event.eventType.replace(/_/g, " ")}
                </Badge>
              </div>

              <div className="flex items-center justify-between gap-2 pt-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="size-4" />
                  <span>{t.time}</span>
                </div>
                <span className="font-mono text-xs font-medium text-foreground">
                  {new Date(event.createdAt).toLocaleString(locale)}
                </span>
              </div>
            </div>
          </div>
          {waMessageId && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                {t.sectionMessageId}
              </h4>
              <div className="space-y-2 rounded-xl border bg-muted/30 p-4">
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
                <p className="rounded-md border bg-background/80 p-2.5 font-mono text-xs leading-relaxed break-all text-foreground select-all">
                  {waMessageId}
                </p>
              </div>
            </div>
          )}

          {/* Section 4: Atribut Tambahan Payload */}
          {additionalEntries.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                {t.sectionTech}
              </h4>
              <div className="divide-y divide-border/60 rounded-xl border bg-card p-4">
                {additionalEntries.map(([key, val]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0"
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
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
