import { z } from "zod"
import type {
  InteractiveButtonPayload,
  InteractiveCTAUrlButton,
  InteractiveReplyButton,
} from "@/lib/whatsapp/meta-cloud/types"

export const MAX_BUTTONS = 3
export const MAX_BUTTON_TITLE_LENGTH = 20

export const parsedReplyButtonSchema = z.object({
  type: z.literal("reply"),
  id: z.string().min(1).max(256),
  title: z.string().min(1).max(MAX_BUTTON_TITLE_LENGTH),
})

export const parsedUrlButtonSchema = z.object({
  type: z.literal("url"),
  id: z.string().min(1).max(256),
  title: z.string().min(1).max(MAX_BUTTON_TITLE_LENGTH),
  url: z
    .string()
    .url()
    .refine((val) => /^https?:\/\//i.test(val), {
      message: "URL must start with http:// or https://",
    }),
})

export const parsedButtonSchema = z.discriminatedUnion("type", [
  parsedReplyButtonSchema,
  parsedUrlButtonSchema,
])

export type ParsedReplyButton = z.infer<typeof parsedReplyButtonSchema>
export type ParsedUrlButton = z.infer<typeof parsedUrlButtonSchema>
export type ParsedButton = z.infer<typeof parsedButtonSchema>

export type ParseInteractiveButtonsResult = {
  cleanText: string
  buttons: ParsedButton[]
}

/**
 * Clips button title to Meta's maximum allowed length (default 20 chars).
 */
export function truncateButtonTitle(
  title: string,
  maxLength = MAX_BUTTON_TITLE_LENGTH
): string {
  const trimmed = title.trim()
  if (trimmed.length <= maxLength) {
    return trimmed
  }
  return trimmed.slice(0, maxLength).trim()
}

/**
 * Parses smart action tags [BUTTON: label] and [URL: label | url]
 * from AI-generated response text.
 * Strips all tags from the body text and enforces Meta WhatsApp button limits:
 * - Maximum 3 buttons total
 * - Button titles truncated to 20 characters
 * - Valid http/https URL required for CTA URL buttons
 */
export function parseInteractiveButtons(
  rawText: string
): ParseInteractiveButtonsResult {
  if (!rawText || typeof rawText !== "string") {
    return { cleanText: "", buttons: [] }
  }

  const buttons: ParsedButton[] = []
  const tagRegex = /\[(BUTTON|URL):\s*([^\]]+)\]/gi

  let match: RegExpExecArray | null
  while ((match = tagRegex.exec(rawText)) !== null) {
    if (buttons.length >= MAX_BUTTONS) {
      continue
    }

    const tagType = match[1].toUpperCase()
    const content = match[2].trim()

    if (!content) {
      continue
    }

    if (tagType === "BUTTON") {
      const title = truncateButtonTitle(content, MAX_BUTTON_TITLE_LENGTH)
      if (!title) {
        continue
      }

      const candidate = {
        type: "reply" as const,
        id: `btn_${buttons.length + 1}`,
        title,
      }

      const parsed = parsedReplyButtonSchema.safeParse(candidate)
      if (parsed.success) {
        buttons.push(parsed.data)
      }
    } else if (tagType === "URL") {
      const pipeIndex = content.indexOf("|")
      if (pipeIndex === -1) {
        continue
      }

      const rawLabel = content.slice(0, pipeIndex).trim()
      const rawUrl = content.slice(pipeIndex + 1).trim()

      if (!rawLabel || !rawUrl) {
        continue
      }

      const title = truncateButtonTitle(rawLabel, MAX_BUTTON_TITLE_LENGTH)
      if (!title) {
        continue
      }

      const candidate = {
        type: "url" as const,
        id: `url_${buttons.length + 1}`,
        title,
        url: rawUrl,
      }

      const parsed = parsedUrlButtonSchema.safeParse(candidate)
      if (parsed.success) {
        buttons.push(parsed.data)
      }
    }
  }

  const cleanText = rawText
    .replace(/\[(?:BUTTON|URL):[^\]]*\]/gi, "")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()

  return {
    cleanText,
    buttons,
  }
}

/**
 * Builds a Meta-compatible interactive button payload for sendMessage.
 */
export function buildInteractivePayload(
  cleanText: string,
  buttons: ParsedButton[]
): InteractiveButtonPayload {
  const text = cleanText.trim() || "Silakan pilih opsi berikut:"
  const cappedButtons = buttons.slice(0, MAX_BUTTONS)

  const metaButtons: Array<
    InteractiveReplyButton | InteractiveCTAUrlButton
  > = cappedButtons.map((btn) => {
    if (btn.type === "url") {
      return {
        type: "cta_url" as const,
        cta_url: {
          id: btn.id,
          display_text: btn.title,
          url: btn.url,
        },
      }
    }
    return {
      type: "reply" as const,
      reply: {
        id: btn.id,
        title: btn.title,
      },
    }
  })

  return {
    type: "button",
    body: {
      text,
    },
    action: {
      buttons: metaButtons,
    },
  }
}
