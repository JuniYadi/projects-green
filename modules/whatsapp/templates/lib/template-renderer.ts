import type { WhatsAppTemplateLanguage } from "@/lib/api/whatsapp-client"

export type TemplatePreviewValues = Record<number, string>

export function getTemplatePlaceholderIndexes(body?: string | null): number[] {
  if (!body) return []

  const matches = body.match(/{{\s*(\d+)\s*}}/g)
  if (!matches) return []

  const indexes = new Set<number>()
  for (const match of matches) {
    const num = Number.parseInt(match.replace(/[{}]/g, "").trim(), 10)
    if (!Number.isNaN(num) && num > 0) indexes.add(num)
  }

  return Array.from(indexes).sort((a, b) => a - b)
}

export function renderTemplateBody(
  body: string | null | undefined,
  values?: TemplatePreviewValues
): string {
  if (!body) return ""
  if (!values || Object.keys(values).length === 0) return body

  return body.replace(/{{\s*(\d+)\s*}}/g, (_, num: string) => {
    const index = Number.parseInt(num, 10)
    return values[index] || ""
  })
}

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
  const bodyLower = (language.body ?? "").toLowerCase()
  const isLikelyOtp =
    bodyLower.includes("kode") ||
    bodyLower.includes("code") ||
    bodyLower.includes("verifikasi") ||
    bodyLower.includes("otp") ||
    bodyLower.includes("verification")

  for (const idx of indexes) {
    if (overrides?.[idx]) {
      values[idx] = overrides[idx]
    } else if (examples[idx]) {
      values[idx] = examples[idx]
    } else if (isLikelyOtp && idx === 1) {
      values[idx] = "549281"
    } else {
      values[idx] = `Example ${idx}`
    }
  }

  return values
}

function extractParameterExamples(params: unknown): Record<number, string> {
  if (!params) return {}

  if (Array.isArray(params)) {
    const examples: Record<number, string> = {}
    for (const [index, item] of params.entries()) {
      if (
        typeof item === "object" &&
        item !== null &&
        "type" in item &&
        "text" in item &&
        item.type === "BODY" &&
        typeof item.text === "string"
      ) {
        examples[index + 1] = item.text
      }
    }
    return examples
  }

  if (typeof params !== "object") return {}
  const components = (params as Record<string, unknown>).components
  if (!Array.isArray(components)) return {}

  const bodyComponent = components.find(
    (component): component is Record<string, unknown> =>
      typeof component === "object" &&
      component !== null &&
      "type" in component &&
      component.type === "BODY"
  )
  if (
    !bodyComponent ||
    typeof bodyComponent.example !== "object" ||
    bodyComponent.example === null
  ) {
    return {}
  }

  const bodyText = (bodyComponent.example as Record<string, unknown>).body_text
  if (!Array.isArray(bodyText) || bodyText.length === 0) return {}

  if (Array.isArray(bodyText[0])) {
    const examples: Record<number, string> = {}
    for (const group of bodyText) {
      if (!Array.isArray(group)) continue
      for (const [index, value] of group.entries()) {
        if (typeof value === "string" && !examples[index + 1]) {
          examples[index + 1] = value
        }
      }
    }
    return examples
  }

  const examples: Record<number, string> = {}
  for (const [index, value] of bodyText.entries()) {
    if (typeof value === "string") examples[index + 1] = value
  }
  return examples
}
