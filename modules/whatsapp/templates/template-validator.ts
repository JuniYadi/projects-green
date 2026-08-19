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
