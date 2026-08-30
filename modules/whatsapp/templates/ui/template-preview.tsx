import { WhatsAppText } from "@/modules/whatsapp/ui/whatsapp-text"
/**
 * WhatsApp Template Preview — Shared preview renderer
 *
 * Renders template language variants as WhatsApp-like message bubbles
 * with header, body, footer, and buttons. Used by both template detail
 * and the send-message dialog.
 */

import * as React from "react"
import { Badge } from "@/components/ui/badge"
import {
  renderTemplateBody,
  resolveTemplatePreviewValues,
  type TemplatePreviewValues,
} from "@/modules/whatsapp/templates/lib/template-renderer"
import type { WhatsAppTemplateLanguage } from "@/lib/api/whatsapp-client"

export {
  getTemplatePlaceholderIndexes,
  renderTemplateBody,
  resolveTemplatePreviewValues,
  type TemplatePreviewValues,
} from "@/modules/whatsapp/templates/lib/template-renderer"

// ─── Language display ────────────────────────────────────────────────────────

const REGION_MAP: Record<string, string> = {
  id: "ID",
  en: "US",
  ms: "MY",
  th: "TH",
  vi: "VN",
  fil: "PH",
  tl: "PH",
  zh: "CN",
}

export function getLanguageDisplay(lang: string): {
  code: string
  label: string
  flag: string
} {
  const normalized = lang.replace("_", "-")
  const parts = normalized.split("-")
  const base = parts[0]
  const region = parts.length > 1 ? parts[1].toUpperCase() : undefined
  const countryCode = region ?? REGION_MAP[base] ?? ""

  let label = base
  try {
    const display = new Intl.DisplayNames(["en"], { type: "language" })
    label = display.of(base) ?? base
  } catch {
    // fallback to base code
  }

  return { code: normalized, label, flag: countryCode }
}

export function TemplateLanguageBadge({
  lang,
  className,
}: {
  lang: string
  className?: string
}) {
  const { code, label, flag } = getLanguageDisplay(lang)
  return (
    <Badge variant="secondary" className={className}>
      {flag ? (
        <span className="mr-1 text-xs leading-none">{getFlagEmoji(flag)}</span>
      ) : null}
      {code}
      <span className="ml-1 text-muted-foreground/60">·</span>
      <span className="ml-1 font-normal">{label}</span>
    </Badge>
  )
}
export function getFlagEmoji(countryCode: string): string {
  if (countryCode.length !== 2) return ""
  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
  return String.fromCodePoint(...codePoints)
}

// ─── WhatsApp Markdown formatting ────────────────────────────────────────────

/**
 * Renders WhatsApp markdown styles (*bold*, _italic_, ~strikethrough~, ```monospace```).
 */
export function WhatsAppFormattedText({ text }: { text: string }) {
  if (!text) return null

  // Split text by lines first to preserve line breaks
  const lines = text.split("\n")

  return (
    <>
      {lines.map((line, lineIdx) => (
        <React.Fragment key={lineIdx}>
          {lineIdx > 0 && <br />}
          {renderWhatsAppLine(line)}
        </React.Fragment>
      ))}
    </>
  )
}

function renderWhatsAppLine(line: string): React.ReactNode {
  if (!line) return null

  // Tokenize line by markdown delimiters: ```...```, *...*, _..._, ~...~
  // Regex matches:
  // 1. ```code```
  // 2. *bold*
  // 3. _italic_
  // 4. ~strikethrough~
  const regex =
    /(```[\s\S]*?```|\*(?!\s)[^*]+(?!\s)\*|_(?!\s)[^_]+(?!\s)_|~(?!\s)[^~]+(?!\s)~)/g
  const parts = line.split(regex)

  return parts.map((part, i) => {
    if (!part) return null

    if (part.startsWith("```") && part.endsWith("```") && part.length >= 6) {
      return (
        <code
          key={i}
          className="rounded bg-muted/70 px-1 py-0.5 font-mono text-[12px] text-foreground"
        >
          {part.slice(3, -3)}
        </code>
      )
    }

    if (part.startsWith("*") && part.endsWith("*") && part.length >= 2) {
      return (
        <strong key={i} className="font-bold text-foreground">
          {part.slice(1, -1)}
        </strong>
      )
    }

    if (part.startsWith("_") && part.endsWith("_") && part.length >= 2) {
      return (
        <em key={i} className="italic">
          {part.slice(1, -1)}
        </em>
      )
    }

    if (part.startsWith("~") && part.endsWith("~") && part.length >= 2) {
      return (
        <del key={i} className="line-through opacity-80">
          {part.slice(1, -1)}
        </del>
      )
    }

    return <React.Fragment key={i}>{part}</React.Fragment>
  })
}

// ─── Button label resolution ─────────────────────────────────────────────────

function getButtonLabel(btn: Record<string, unknown>): string {
  if (typeof btn.text === "string" && btn.text.trim()) return btn.text.trim()

  const ctaUrl = btn.cta_url as Record<string, unknown> | undefined
  if (
    ctaUrl &&
    typeof ctaUrl.display_text === "string" &&
    ctaUrl.display_text.trim()
  )
    return ctaUrl.display_text.trim()

  const reply = btn.reply as Record<string, unknown> | undefined
  if (reply && typeof reply.title === "string" && reply.title.trim())
    return reply.title.trim()

  // OTP button fallback
  if (btn.type === "OTP") return "Copy Code"

  return String(btn.type ?? "Button")
}

// ─── Preview component ───────────────────────────────────────────────────────

export function WhatsAppTemplatePreview({
  language,
  values,
  className,
  mode = "full",
  showOuterContainer = true,
  hideInternalStatus = false,
}: {
  language: WhatsAppTemplateLanguage
  values?: TemplatePreviewValues
  className?: string
  mode?: "full" | "compact"
  showOuterContainer?: boolean
  hideInternalStatus?: boolean
}) {
  const resolved = resolveTemplatePreviewValues(language, values)
  const bodyText = renderTemplateBody(language.body, resolved)
  const buttons = Array.isArray(language.buttons)
    ? (language.buttons as Array<Record<string, unknown>>)
    : []
  const hasHeader =
    language.headerText ||
    (language.headerType && language.headerType !== "NONE")
  const hasFooter = !!language.footer
  const hasBody = !!bodyText
  const hasButtons = buttons.length > 0
  const hasContent = hasHeader || hasFooter || hasBody || hasButtons

  if (!hasContent) {
    return (
      <div className={className}>
        <p className="text-sm text-muted-foreground italic">
          <WhatsAppText id="s237" />
        </p>
      </div>
    )
  }

  if (mode === "compact") {
    return (
      <div className={className}>
        <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-none bg-[#e7fedb] px-3.5 py-2.5 text-sm text-[#111b21] shadow-sm dark:bg-[#005c4b] dark:text-[#e9edef]">
          {bodyText && (
            <div className="leading-relaxed break-words">
              <WhatsAppFormattedText text={bodyText} />
            </div>
          )}
        </div>
      </div>
    )
  }
  const bubbleContent = (
    <div
      className={`relative max-w-full rounded-2xl rounded-tr-xs border border-emerald-500/20 bg-emerald-600/10 p-3.5 text-sm shadow-xs dark:border-emerald-500/20 dark:bg-emerald-950/30 ${className ?? ""}`}
    >
      {language.headerText ? (
        <div className="mb-2 text-sm font-bold text-foreground">
          {language.headerText}
        </div>
      ) : null}

      {language.headerType &&
      language.headerType !== "NONE" &&
      !language.headerText ? (
        <div className="mb-2 overflow-hidden rounded-lg border border-border/40 bg-muted/40">
          {language.headerType === "DOCUMENT" ? (
            <div className="flex items-center gap-3 p-2.5">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-destructive/15 text-xs font-bold text-destructive uppercase">
                PDF
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-foreground">
                  {language.headerUrl
                    ? language.headerUrl.split("/").pop()?.split("?")[0] ||
                      "attachment.pdf"
                    : "Document Attachment (PDF)"}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  WhatsApp Document
                </p>
              </div>
            </div>
          ) : language.headerType === "IMAGE" ? (
            <div className="flex h-32 items-center justify-center bg-muted/60 text-xs text-muted-foreground">
              <span>🖼️ Image Attachment</span>
            </div>
          ) : language.headerType === "VIDEO" ? (
            <div className="flex h-32 items-center justify-center bg-muted/60 text-xs text-muted-foreground">
              <span>🎥 Video Attachment</span>
            </div>
          ) : (
            <div className="p-2 text-center text-xs text-muted-foreground">
              {language.headerType} <WhatsAppText id="s239" />
            </div>
          )}
        </div>
      ) : null}

      {/* Message Body with WhatsApp Markdown Formatting */}
      {bodyText && (
        <div className="text-sm leading-relaxed break-words text-foreground/90">
          <WhatsAppFormattedText text={bodyText} />
        </div>
      )}

      {/* Footer Text */}
      {language.footer && (
        <div className="mt-2 text-[11px] text-muted-foreground">
          {language.footer}
        </div>
      )}

      {!hideInternalStatus && (
        <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
          <span>10:45</span>
          <span className="font-bold text-emerald-500">✓✓</span>
        </div>
      )}
      {/* Interactive Buttons — Clean WhatsApp Card Style */}
      {buttons.length > 0 && (
        <div className="-mx-3 mt-2 -mb-3 divide-y divide-border/40 border-t border-border/40">
          {buttons.map((btn, i) => (
            <div
              key={i}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 text-center text-xs font-semibold text-[#00a884] transition-colors hover:bg-muted/30 dark:text-[#00a884]"
            >
              {btn.type === "URL" && <span>🔗</span>}
              {btn.type === "PHONE_NUMBER" && <span>📞</span>}
              {btn.type === "OTP" && <span>🔑</span>}
              {getButtonLabel(btn)}
            </div>
          ))}
        </div>
      )}
    </div>
  )

  if (!showOuterContainer) {
    return bubbleContent
  }

  return (
    <div
      className={`overflow-hidden rounded-xl border bg-[#efeae2]/60 p-4 font-sans text-[#111b21] dark:bg-[#0b141a]/90 dark:text-[#e9edef] ${className ?? ""}`}
    >
      {bubbleContent}
    </div>
  )
}
