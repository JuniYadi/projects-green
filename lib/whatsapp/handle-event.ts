import { createHash } from "node:crypto"
import { saveDebugSnapshot } from "./debug-repository"
import { claimProcessedEvent } from "./idempotency-repository"

type WhatsappWebhookEnvelope = {
  object: "whatsapp_business_account"
  entry: Array<{
    id: string
    time?: number
    changes: Array<{
      value: Record<string, unknown>
      field: string
    }>
  }>
}

export type TemplateStatusUpdate = {
  templateId: string
  templateName: string
  category?: string
  language?: string
  event: string
  reason?: string
  occurredAt?: number
}

export type ParsedWebhookEntry = {
  id: string
  phoneNumberId: string
  displayPhoneNumber?: string
  messages: unknown[]
  statuses: unknown[]
  templateStatusUpdates: TemplateStatusUpdate[]
}

type DebugRepository = {
  save: typeof saveDebugSnapshot
}

type HandleEventOptions = {
  debugRepository?: DebugRepository
  rawBody?: string
}

function isWhatsappWebhookEnvelope(
  payload: unknown
): payload is WhatsappWebhookEnvelope {
  if (typeof payload !== "object" || payload === null) {
    return false
  }

  const candidate = payload as Record<string, unknown>
  return (
    candidate.object === "whatsapp_business_account" &&
    Array.isArray(candidate.entry)
  )
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

export function normalizeTemplateStatusUpdate(
  value: unknown,
  occurredAt?: number
): TemplateStatusUpdate | null {
  if (!isRecord(value)) return null

  const rawTemplateId = value.message_template_id
  const templateName = value.message_template_name
  const event = value.event

  if (
    (typeof rawTemplateId !== "string" && typeof rawTemplateId !== "number") ||
    typeof templateName !== "string" ||
    templateName.length === 0 ||
    typeof event !== "string" ||
    event.length === 0
  ) {
    return null
  }

  const category = value.message_template_category
  const language = value.message_template_language
  const reason = value.reason

  return {
    templateId: String(rawTemplateId),
    templateName,
    event,
    ...(typeof category === "string" ? { category } : {}),
    ...(typeof language === "string" ? { language } : {}),
    ...(typeof reason === "string" ? { reason } : {}),
    ...(typeof occurredAt === "number" ? { occurredAt } : {}),
  }
}

export async function handleEventUseCase(
  payload: unknown,
  options: HandleEventOptions = {}
) {
  if (!isWhatsappWebhookEnvelope(payload)) {
    if (options.debugRepository) {
      options.debugRepository.save({
        deviceId: "unknown",
        reason: "INVALID_PAYLOAD",
        payload,
      })
    }
    return {
      code: 400,
      message: "INVALID_PAYLOAD",
    }
  }

  if (options.rawBody) {
    const bodyHash = createHash("sha256").update(options.rawBody).digest("hex")
    if (!(await claimProcessedEvent(bodyHash))) {
      return { duplicate: true }
    }
  }

  // Parse entries into a stable structure for downstream dispatch
  const parsedEntries: ParsedWebhookEntry[] = payload.entry.map((entry) => {
    const changes = entry.changes ?? []
    const messageChange = changes.find((change) => change.field === "messages")
    const value = messageChange?.value ?? {}
    const metadata = isRecord(value.metadata) ? value.metadata : {}
    const templateStatusUpdates = changes.flatMap((change) =>
      change.field === "message_template_status_update"
        ? [normalizeTemplateStatusUpdate(change.value, entry.time)].filter(
            (update): update is TemplateStatusUpdate => update !== null
          )
        : []
    )

    return {
      id: entry.id,
      phoneNumberId:
        typeof metadata.phone_number_id === "string"
          ? metadata.phone_number_id
          : "",
      displayPhoneNumber:
        typeof metadata.display_phone_number === "string"
          ? metadata.display_phone_number
          : undefined,
      messages: Array.isArray(value.messages) ? value.messages : [],
      statuses: Array.isArray(value.statuses) ? value.statuses : [],
      templateStatusUpdates,
    }
  })

  return {
    code: 200,
    message: "EVENT_RECEIVED",
    entries: parsedEntries,
  }
}
