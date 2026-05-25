import { saveDebugSnapshot } from "./debug-repository"
import { hasProcessedEvent, markEventProcessed } from "./idempotency-repository"

type WhatsappWebhookEnvelope = {
  object: "whatsapp_business_account"
  entry: unknown[]
  eventId?: string
}

type DebugRepository = {
  save: typeof saveDebugSnapshot
}

type HandleEventOptions = {
  debugRepository?: DebugRepository
}

function isWhatsappWebhookEnvelope(payload: unknown): payload is WhatsappWebhookEnvelope {
  if (typeof payload !== "object" || payload === null) {
    return false
  }

  const candidate = payload as Record<string, unknown>
  return candidate.object === "whatsapp_business_account" && Array.isArray(candidate.entry)
}

export function handleEventUseCase(payload: unknown, options: HandleEventOptions = {}) {
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

  if (payload.eventId !== undefined) {
    if (hasProcessedEvent(payload.eventId)) {
      return { duplicate: true }
    }
    markEventProcessed(payload.eventId)
  }

  return {
    code: 200,
    message: "EVENT_RECEIVED",
  }
}
