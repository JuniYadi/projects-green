/**
 * WhatsApp Audit — action tone mapping + known-keys extractor.
 * Mirrors vpn audit-details pattern but WhatsApp-specific.
 */

export type ActionTone = "success" | "danger" | "warning" | "neutral"

export function actionTone(action: string): ActionTone {
  if (/SYNCED|CREATED|UPDATED|SENT|DELIVERED|IMPORTED/.test(action))
    return "success"
  if (/FAILED|CANCELLED|DELETED/.test(action)) return "danger"
  if (/REQUESTED|RETRIED|STATUS_CHANGED/.test(action)) return "warning"
  return "neutral"
}

/**
 * Known detail keys extracted from the details JSON blob.
 * Returns only keys that have truthy values.
 */
export function extractKnownDetails(
  details: Record<string, unknown> | null
): Record<string, unknown> {
  if (!details) return {}
  const known: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(details)) {
    if (value != null && value !== "") {
      known[key] = value
    }
  }
  return known
}

/**
 * Returns keys from details that are NOT in the known list.
 */
export function extractOtherDetails(
  details: Record<string, unknown> | null
): Record<string, unknown> {
  if (!details) return {}
  const known = new Set([
    "templateId",
    "slug",
    "changedFields",
    "waMessageId",
    "phoneNumber",
    "contactId",
    "groupId",
    "source",
  ])
  const other: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(details)) {
    if (!known.has(key) && value != null && value !== "") {
      other[key] = value
    }
  }
  return other
}
