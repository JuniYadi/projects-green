import { createHash } from "node:crypto"
import { saveDebugSnapshot } from "./debug-repository"
import { hasProcessedEvent, markEventProcessed } from "./idempotency-repository"

type WhatsappWebhookEnvelope = {
  object: "whatsapp_business_account"
  entry: Array<{
    id: string
    changes: Array<{
      value: {
        messaging_product: string
        metadata: {
          phone_number_id: string
          display_phone_number?: string
        }
        messages?: unknown[]
        statuses?: unknown[]
      }
      field: string
    }>
  }>
}

export type ParsedWebhookEntry = {
  id: string
  phoneNumberId: string
  displayPhoneNumber?: string
  messages: unknown[]
  statuses: unknown[]
}

type DebugRepository = {
  save: typeof saveDebugSnapshot
}

type HandleEventOptions = {
  debugRepository?: DebugRepository
  rawBody?: string
}

function isWhatsappWebhookEnvelope(payload: unknown): payload is WhatsappWebhookEnvelope {
  if (typeof payload !== "object" || payload === null) {
    return false
  }

  const candidate = payload as Record<string, unknown>
  return candidate.object === "whatsapp_business_account" && Array.isArray(candidate.entry)
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
    if (await hasProcessedEvent(bodyHash)) {
      return { duplicate: true }
    }
    await markEventProcessed(bodyHash)
  }

  // Parse entries into a stable structure for downstream dispatch
  const parsedEntries: ParsedWebhookEntry[] = payload.entry.map((entry) => {
    const change = entry.changes?.[0]
    const value = change?.value ?? {}

    return {
      id: entry.id,
      phoneNumberId: value.metadata?.phone_number_id ?? "",
      displayPhoneNumber: value.metadata?.display_phone_number,
      messages: value.messages ?? [],
      statuses: value.statuses ?? [],
    }
  })

  return {
    code: 200,
    message: "EVENT_RECEIVED",
    entries: parsedEntries,
  }
}
