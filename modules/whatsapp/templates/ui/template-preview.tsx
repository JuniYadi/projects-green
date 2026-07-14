/**
 * WhatsApp Template Preview — Shared preview renderer
 *
 * Renders template language variants as WhatsApp-like message bubbles
 * with header, body, footer, and buttons. Used by both template detail
 * and the send-message dialog.
 */

import { Badge } from "@/components/ui/badge"
import type { WhatsAppTemplateLanguage } from "@/lib/api/whatsapp-client"

// ─── Types ───────────────────────────────────────────────────────────────────

export type TemplatePreviewValues = Record<number, string>

// ─── Placeholder helpers ─────────────────────────────────────────────────────

export function getTemplatePlaceholderIndexes(
  body?: string | null
): number[] {
  if (!body) return []
  const matches = body.match(/{{\s*(\d+)\s*}}/g)
  if (!matches) return []
  const indexes = new Set<number>()
  for (const match of matches) {
    const num = parseInt(match.replace(/[{}]/g, "").trim(), 10)
    if (!isNaN(num) && num > 0) indexes.add(num)
  }
  return Array.from(indexes).sort((a, b) => a - b)
}

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

function getFlagEmoji(countryCode: string): string {
  if (countryCode.length !== 2) return ""
  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
  return String.fromCodePoint(...codePoints)
}

// ─── Template body rendering ─────────────────────────────────────────────────

export function renderTemplateBody(
  body: string | null | undefined,
  values?: TemplatePreviewValues
): string {
  if (!body) return ""
  if (!values || Object.keys(values).length === 0) return body
  return body.replace(/{{\s*(\d+)\s*}}/g, (_, num) => {
    const index = parseInt(num, 10)
    return values[index] || ""
  })
}

// ─── Value resolution ────────────────────────────────────────────────────────

/**
 * Resolve preview values for template placeholders.
 *
 * Priority:
 * 1. Explicit `overrides[index]`
 * 2. Examples from `language.parameters`
 * 3. `Example ${index}` fallback
 */
export function resolveTemplatePreviewValues(
  language: Pick<WhatsAppTemplateLanguage, "body" | "parameters">,
  overrides?: TemplatePreviewValues
): TemplatePreviewValues {
  const indexes = getTemplatePlaceholderIndexes(language.body)
  if (indexes.length === 0) return {}

  const values: TemplatePreviewValues = {}
  const examples = extractParameterExamples(language.parameters)

  for (const idx of indexes) {
    if (overrides?.[idx]) {
      values[idx] = overrides[idx]
    } else if (examples[idx]) {
      values[idx] = examples[idx]
    } else {
      values[idx] = `Example ${idx}`
    }
  }

  return values
}

function extractParameterExamples(
  params: unknown
): Record<number, string> {
  if (!params) return {}

  // [{ type: "BODY", text: "Alice" }] — flat component array
  if (Array.isArray(params)) {
    const examples: Record<number, string> = {}
    ;(params as Array<Record<string, unknown>>).forEach((item, i) => {
      if (item.type === "BODY" && typeof item.text === "string") {
        examples[i + 1] = item.text
      }
    })
    return examples
  }

  // { components: [{ type: "BODY", example: { body_text: [["Alice", "Acme"]] } }] }
  const obj = params as Record<string, unknown>
  const components = obj.components as Array<Record<string, unknown>> | undefined
  if (Array.isArray(components)) {
    const bodyComponent = components.find(
      (c) => (c as Record<string, unknown>).type === "BODY"
    )
    if (bodyComponent) {
      const example = bodyComponent.example as
        | Record<string, unknown>
        | undefined
      if (example) {
        const bodyText = example.body_text
        if (Array.isArray(bodyText) && bodyText.length > 0) {
          // body_text: [["Alice", "Acme"]] — nested array
          if (Array.isArray(bodyText[0])) {
            const examples: Record<number, string> = {}
            ;(bodyText as string[][]).forEach((group) => {
              group.forEach((val, i) => {
                // 1-indexed placeholders
                if (!examples[i + 1]) examples[i + 1] = val
              })
            })
            return examples
          }
          // body_text: ["Alice", "Acme"] — flat array
          const examples: Record<number, string> = {}
          ;(bodyText as string[]).forEach((val, i) => {
            examples[i + 1] = val
          })
          return examples
        }
      }
    }
  }

  return {}
}

// ─── Button label resolution ─────────────────────────────────────────────────

function getButtonLabel(btn: Record<string, unknown>): string {
  if (typeof btn.text === "string" && btn.text) return btn.text

  const ctaUrl = btn.cta_url as Record<string, unknown> | undefined
  if (ctaUrl && typeof ctaUrl.display_text === "string") return ctaUrl.display_text

  const reply = btn.reply as Record<string, unknown> | undefined
  if (reply && typeof reply.title === "string") return reply.title

  // OTP button is special — text is "Copy code"
  if (btn.type === "OTP") return "Copy code"

  return String(btn.type ?? "Button")
}

// ─── Preview component ───────────────────────────────────────────────────────

export function WhatsAppTemplatePreview({
  language,
  values,
  className,
  mode = "full",
}: {
  language: WhatsAppTemplateLanguage
  values?: TemplatePreviewValues
  className?: string
  mode?: "full" | "compact"
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
          No preview content
        </p>
      </div>
    )
  }

  // Compact mode: render only body text (matches MessageBubble)
  if (mode === "compact") {
    return (
      <div className={className}>
        <div className="ml-auto max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-4 py-3 text-sm text-primary-foreground shadow-sm">
          {bodyText && (
            <div className="whitespace-pre-wrap break-words">{bodyText}</div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      <div className="ml-auto max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-4 py-3 text-sm text-primary-foreground shadow-sm">
        {/* Header */}
        {language.headerText ? (
          <div className="mb-1.5 font-semibold">{language.headerText}</div>
        ) : null}
        {language.headerType &&
        language.headerType !== "NONE" &&
        !language.headerText ? (
          <div className="mb-1.5 rounded-md border border-primary-foreground/20 bg-primary-foreground/10 px-2 py-3 text-center text-xs font-medium">
            {language.headerType === "IMAGE" || language.headerType === "VIDEO" ? (
              <span>{language.headerType} placeholder</span>
            ) : language.headerType === "DOCUMENT" ? (
              <div>
                <span>Document placeholder</span>
                {language.headerUrl && (
                  <p className="mt-0.5 truncate text-[10px] text-primary-foreground/60">
                    {language.headerUrl}
                  </p>
                )}
              </div>
            ) : (
              <span>{language.headerType} placeholder</span>
            )}
          </div>
        ) : null}

        {/* Body */}
        {bodyText && (
          <div className="whitespace-pre-wrap break-words">{bodyText}</div>
        )}

        {/* Footer */}
        {language.footer && (
          <div className="mt-1.5 text-[11px] text-primary-foreground/60">
            {language.footer}
          </div>
        )}

        {/* Buttons — full-width rows below the bubble */}
        {buttons.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {buttons.map((btn, i) => (
              <div
                key={i}
                className="rounded-md border border-primary-foreground/20 bg-primary-foreground/5 px-3 py-2 text-center text-xs font-medium"
              >
                {getButtonLabel(btn)}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
