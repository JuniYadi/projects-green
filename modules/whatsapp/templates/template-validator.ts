/**
 * WhatsApp Template Variable & Boundary Validator
 *
 * Implements strict Meta Cloud API template rules:
 * 1. Variable extraction: finds all {{1}}, {{2}}, etc.
 * 2. Sequential placeholder checking: {{1}}, {{2}}, ... without missing numbers.
 * 3. Boundary validation: Meta restricts variables at the exact start or exact end of body text,
 *    and prevents consecutive variables (e.g. {{1}}{{2}}).
 * 4. Slug formatting: lowercase letters, numbers, and underscores only.
 */

export type VariableValidationResult = {
  isValid: boolean
  indexes: number[]
  errors: string[]
  warnings: string[]
}

/**
 * Extracts sequential placeholder indexes from text (e.g. "{{1}} and {{2}}" -> [1, 2]).
 */
export function extractTemplateVariables(text?: string | null): number[] {
  if (!text) return []
  const matches = text.match(/{{\s*(\d+)\s*}}/g)
  if (!matches) return []
  const indexes = new Set<number>()
  for (const match of matches) {
    const num = parseInt(match.replace(/[{}]/g, "").trim(), 10)
    if (!isNaN(num) && num > 0) indexes.add(num)
  }
  return Array.from(indexes).sort((a, b) => a - b)
}

/**
 * Validates body text against Meta WhatsApp template requirements:
 * - Placeholders must be 1-indexed and sequential (no skipping numbers).
 * - Variable cannot be at the very end of the body text (Meta rejection prevention).
 * - Variable cannot be directly adjacent to another variable without space/text ({{1}}{{2}}).
 */
export function validateTemplateBodyRules(
  body?: string | null
): VariableValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const trimmed = (body ?? "").trim()

  if (!trimmed) {
    return {
      isValid: false,
      indexes: [],
      errors: ["Body text is required."],
      warnings: [],
    }
  }

  const indexes = extractTemplateVariables(trimmed)

  // 1. Check sequential indexing
  for (let i = 0; i < indexes.length; i++) {
    const expected = i + 1
    if (indexes[i] !== expected) {
      errors.push(
        `Variables must be sequential starting at {{1}}. Found {{${indexes[i]}}} instead of {{${expected}}}.`
      )
      break
    }
  }

  // 2. Check consecutive variables {{1}}{{2}}
  if (/{{(\d+)}}\s*{{(\d+)}}/.test(trimmed)) {
    errors.push(
      "Consecutive variables (e.g. {{1}}{{2}}) are not allowed by WhatsApp."
    )
  }

  // 3. Check variable at end of body
  if (/{{(\d+)}}\s*[.!?]?$/.test(trimmed)) {
    warnings.push(
      "WhatsApp restricts placing variables at the end of the message. Add closing text or punctuation after the variable to prevent template rejection."
    )
  }

  // 4. Max variables constraint (Meta limit is 25 per template)
  if (indexes.length > 25) {
    errors.push("Template exceeds maximum of 25 variables.")
  }

  return {
    isValid: errors.length === 0,
    indexes,
    errors,
    warnings,
  }
}

/**
 * Formats a raw template name into a valid WhatsApp slug.
 * Meta requirement: lowercase alphanumeric characters and underscores only.
 */
export function formatTemplateSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 100)
}

export type BuildMetaComponentsInput = {
  headerType?: string | null
  headerText?: string | null
  headerUrl?: string | null
  body?: string | null
  footer?: string | null
  buttons?: unknown
  parameters?: unknown
}

/**
 * Converts template language input to Meta Cloud API components structure.
 */
export function buildMetaTemplateComponents(
  input: BuildMetaComponentsInput
): Array<Record<string, unknown>> {
  const components: Array<Record<string, unknown>> = []

  // 1. HEADER
  const headerType = input.headerType?.toUpperCase()
  if (headerType && headerType !== "NONE") {
    if (headerType === "TEXT" && input.headerText?.trim()) {
      const headerVars = extractTemplateVariables(input.headerText)
      const headerComp: Record<string, unknown> = {
        type: "HEADER",
        format: "TEXT",
        text: input.headerText.trim(),
      }
      if (headerVars.length > 0) {
        headerComp.example = {
          header_text: headerVars.map((v) => `Sample ${v}`),
        }
      }
      components.push(headerComp)
    } else if (
      headerType === "IMAGE" ||
      headerType === "VIDEO" ||
      headerType === "DOCUMENT"
    ) {
      const headerComp: Record<string, unknown> = {
        type: "HEADER",
        format: headerType,
      }
      if (input.headerUrl?.trim()) {
        headerComp.example = {
          header_handle: [input.headerUrl.trim()],
        }
      }
      components.push(headerComp)
    }
  }

  // 2. BODY
  if (input.body?.trim()) {
    const bodyVars = extractTemplateVariables(input.body)
    const bodyComp: Record<string, unknown> = {
      type: "BODY",
      text: input.body.trim(),
    }

    if (bodyVars.length > 0) {
      // Extract custom sample values from parameters if available
      const paramList = Array.isArray(input.parameters)
        ? (input.parameters as Array<{ type?: string; text?: string }>)
        : []
      const sampleTexts = bodyVars.map((v, i) => {
        const customParam = paramList.find(
          (p) => p.type === "BODY" && p.text?.trim()
        )
        return paramList[i]?.text?.trim() || `Sample ${v}`
      })
      bodyComp.example = {
        body_text: [sampleTexts],
      }
    }
    components.push(bodyComp)
  }

  // 3. FOOTER
  if (input.footer?.trim()) {
    components.push({
      type: "FOOTER",
      text: input.footer.trim(),
    })
  }

  // 4. BUTTONS
  if (Array.isArray(input.buttons) && input.buttons.length > 0) {
    const metaButtons: Array<Record<string, unknown>> = []
    for (const b of input.buttons as Array<Record<string, any>>) {
      if (b.type === "QUICK_REPLY" && b.text?.trim()) {
        metaButtons.push({
          type: "QUICK_REPLY",
          text: b.text.trim(),
        })
      } else if (b.type === "URL" && b.text?.trim() && b.url?.trim()) {
        const urlVars = extractTemplateVariables(b.url)
        const btnObj: Record<string, unknown> = {
          type: "URL",
          text: b.text.trim(),
          url: b.url.trim(),
        }
        if (urlVars.length > 0) {
          btnObj.example = Array.isArray(b.example)
            ? b.example
            : urlVars.map((v) => `param_${v}`)
        }
        metaButtons.push(btnObj)
      } else if (
        b.type === "PHONE_NUMBER" &&
        b.text?.trim() &&
        b.phoneNumber?.trim()
      ) {
        metaButtons.push({
          type: "PHONE_NUMBER",
          text: b.text.trim(),
          phone_number: b.phoneNumber.trim(),
        })
      } else if (b.type === "OTP") {
        metaButtons.push({
          type: "OTP",
          otp_type: "COPY_CODE",
          text: b.text?.trim() || "Copy Code",
        })
      }
    }

    if (metaButtons.length > 0) {
      components.push({
        type: "BUTTONS",
        buttons: metaButtons,
      })
    }
  }

  return components
}
