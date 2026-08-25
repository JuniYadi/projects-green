import { extractTemplateVariables } from "@/modules/whatsapp/templates/template-validator"

export type BroadcastPreflightRecipient = {
  dynamicValues?: unknown
}

export type BroadcastVariableValidation = {
  requiredVariables: string[]
  missingByRecipient: Array<{ recipientIndex: number; variables: string[] }>
  unknownColumns: string[]
  excessColumns: string[]
  isValid: boolean
}

const templateVariableKey = (index: number) => `{{${index}}}`

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function hasValue(value: unknown): boolean {
  if (typeof value === "string") {
    return value.trim().length > 0
  }

  return value !== null && value !== undefined && typeof value !== "object"
}

function isTemplateVariableKey(key: string): number | null {
  const match = /^{{(\d+)}}$/.exec(key) ?? /^(\d+)$/.exec(key)
  if (!match) {
    return null
  }

  const index = Number(match[1])
  return Number.isSafeInteger(index) && index > 0 ? index : null
}

function hasVariableValue(values: Record<string, unknown>, index: number) {
  return (
    hasValue(values[templateVariableKey(index)]) ||
    hasValue(values[String(index)])
  )
}

/**
 * Validates the per-recipient values that will become template body fields.
 * Both {{N}} and legacy N keys are understood, while new CSV files should use
 * the parser-aligned {{N}} headers.
 */
export function validateBroadcastRecipientVariables({
  templateBody,
  recipients,
}: {
  templateBody?: string | null
  recipients: BroadcastPreflightRecipient[]
}): BroadcastVariableValidation {
  const requiredIndexes = extractTemplateVariables(templateBody)
  const requiredVariables = requiredIndexes.map(templateVariableKey)
  const requiredIndexSet = new Set(requiredIndexes)
  const unknownColumns = new Set<string>()
  const excessColumns = new Set<string>()
  const missingByRecipient: Array<{
    recipientIndex: number
    variables: string[]
  }> = []

  recipients.forEach((recipient, recipientIndex) => {
    const values = isRecord(recipient.dynamicValues)
      ? recipient.dynamicValues
      : {}

    for (const key of Object.keys(values)) {
      const variableIndex = isTemplateVariableKey(key)
      if (variableIndex === null) {
        unknownColumns.add(key)
      } else if (!requiredIndexSet.has(variableIndex)) {
        excessColumns.add(key)
      }
    }

    const missing = requiredIndexes
      .filter((index) => !hasVariableValue(values, index))
      .map(templateVariableKey)
    if (missing.length > 0) {
      missingByRecipient.push({ recipientIndex, variables: missing })
    }
  })

  return {
    requiredVariables,
    missingByRecipient,
    unknownColumns: [...unknownColumns].sort(),
    excessColumns: [...excessColumns].sort(),
    isValid:
      missingByRecipient.length === 0 &&
      unknownColumns.size === 0 &&
      excessColumns.size === 0,
  }
}

export function formatBroadcastVariableValidationError(
  validation: BroadcastVariableValidation
): string {
  const parts: string[] = []

  const firstMissing = validation.missingByRecipient[0]
  if (firstMissing) {
    parts.push(
      `Recipient ${firstMissing.recipientIndex + 1} is missing ${firstMissing.variables.join(", ")}. Add a non-empty value for every required template variable.`
    )
  }
  if (validation.unknownColumns.length > 0) {
    parts.push(
      `Unknown variable column(s): ${validation.unknownColumns.join(", ")}. Rename them to the required {{N}} headers or remove them.`
    )
  }
  if (validation.excessColumns.length > 0) {
    parts.push(
      `Excess variable column(s): ${validation.excessColumns.join(", ")}. Remove columns not used by the selected template.`
    )
  }

  return parts.join(" ")
}
