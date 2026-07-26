export type CreateFormFields = {
  prefix: string
  maxClaims: string
  expiresAt: string
  amount: string
  currency: string
  targetWorkosUserId: string
  targetOrganizationId: string
}

/** Drop a single field key from fieldErrors (used by updateCreateField). */
export function clearFieldError(
  fieldErrors: Record<string, string[]>,
  field: string
): Record<string, string[]> {
  if (!(field in fieldErrors)) return fieldErrors
  const next = { ...fieldErrors }
  delete next[field]
  return next
}

export type CreateApiError =
  | {
      message?: string
      fieldErrors?: Record<string, string[]>
    }
  | null
  | undefined

/** Map API create failure payload → UI error state. */
export function resolveCreateFailureState(err: CreateApiError): {
  fieldErrors: Record<string, string[]>
  createError: string | null
} {
  if (err?.fieldErrors && Object.keys(err.fieldErrors).length > 0) {
    return { fieldErrors: err.fieldErrors, createError: null }
  }
  return {
    fieldErrors: {},
    createError: err?.message || "Failed to create voucher",
  }
}

/** Normalize catch path message. */
export function resolveCreateExceptionMessage(err: unknown): string {
  return err instanceof Error ? err.message : "An unexpected error occurred"
}
