"use client"
import { WhatsAppText } from "@/modules/whatsapp/ui/whatsapp-text"

import { Checks, Check, Image as ImageIcon } from "@phosphor-icons/react"
import type { WhatsappMessageJourneyDTO } from "../messages.dto"

function formatTimeOnly(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return ""
  }
}

export function MessageChatPreview({
  journey,
}: {
  journey: WhatsappMessageJourneyDTO
}) {
  const { message, contact, device } = journey
  const isOutbound = message.direction === "OUTBOX"

  // Check last status for ticks
  const lastDeliveryStatus = journey.timeline
    .filter((t) =>
      ["SENT", "DELIVERED", "READ", "FAILED"].includes(t.status.toUpperCase())
    )
    .pop()
    ?.status.toUpperCase()

  const isRead = lastDeliveryStatus === "READ"
  const isDelivered = lastDeliveryStatus === "DELIVERED"
  const isSent = lastDeliveryStatus === "SENT"

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border bg-muted/20 shadow-xs">
      {/* WhatsApp Header Bar */}
      <div className="flex items-center justify-between border-b bg-emerald-700 px-4 py-3 text-white dark:bg-emerald-800">
        <div>
          <h4 className="text-sm leading-tight font-semibold">
            {contact?.phoneNumber || "WhatsApp Contact"}
          </h4>
          <p className="text-[11px] text-emerald-100/80">
            <WhatsAppText id="s234" />
            {device?.phoneNumber || "WhatsApp Cloud"}
          </p>
        </div>
        <span className="rounded bg-emerald-800/80 px-2 py-0.5 text-[10px] font-medium tracking-wider uppercase">
          {message.messageType || "text"}
        </span>
      </div>

      {/* Chat Area Wallpaper */}
      <div className="flex min-h-[220px] flex-col justify-center gap-3 bg-[#e5ddd5]/40 p-4 dark:bg-zinc-950/60">
        <div
          className={`flex w-full ${
            isOutbound ? "justify-end" : "justify-start"
          }`}
        >
          <div
            className={`relative max-w-[85%] rounded-lg p-3 text-sm shadow-xs ${
              isOutbound
                ? "rounded-tr-none bg-[#d9fdd3] text-zinc-900 dark:bg-emerald-950/80 dark:text-zinc-100"
                : "rounded-tl-none bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100"
            }`}
          >
            {/* Media Attachment if available */}
            {message.mediaUrl && (
              <div className="mb-2 flex items-center gap-2 overflow-hidden rounded border bg-black/5 p-2">
                <ImageIcon className="size-5 text-muted-foreground" />
                <span className="max-w-[200px] truncate text-xs text-muted-foreground">
                  {message.mediaUrl}
                </span>
              </div>
            )}

            {/* Message Body Text */}
            <div className="text-[13px] leading-relaxed break-words whitespace-pre-wrap">
              {message.body || "(No message body content)"}
            </div>

            {/* Template Buttons Mockup if available */}
            {Array.isArray(message.metadata?.fields) &&
              message.metadata.fields.length > 0 && (
                <div className="mt-2.5 flex flex-col gap-1.5 border-t border-black/10 pt-2 dark:border-white/10">
                  {(message.metadata.fields as unknown[]).map((btnText, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-center rounded bg-white/60 py-1 text-xs font-medium text-emerald-800 shadow-2xs dark:bg-zinc-800/80 dark:text-emerald-300"
                    >
                      {String(btnText)}
                    </div>
                  ))}
                </div>
              )}

            {/* Time & Double Blue Tick */}
            <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
              <span>{formatTimeOnly(message.createdAt)}</span>
              {isOutbound && (
                <span>
                  {isRead ? (
                    <Checks className="size-3.5 text-sky-500" />
                  ) : isDelivered ? (
                    <Checks className="size-3.5 text-muted-foreground" />
                  ) : isSent ? (
                    <Check className="size-3.5 text-muted-foreground" />
                  ) : null}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
