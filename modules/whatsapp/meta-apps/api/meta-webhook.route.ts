import { timingSafeEqual } from "node:crypto"
import { Elysia, t } from "elysia"
import type { Prisma } from "@prisma/client"

import {
  handleEventUseCase,
  normalizeTemplateStatusUpdate,
} from "@/lib/whatsapp/handle-event"
import {
  createWebhookEvent,
  recordProcessingResult,
} from "@/modules/whatsapp/webhooks/webhooks.service"
import { verifyWebhookSignature } from "@/modules/whatsapp/webhooks/services/webhook-hmac.service"
import { WebhookRetryJob } from "@/modules/whatsapp/webhooks/jobs/webhook-retry.job"
import { logWhatsappAuditEvent } from "@/modules/whatsapp/audit/whatsapp-audit.service"
import {
  metaAppsService,
  type ResolvedMetaAppCredentials,
} from "../meta-apps.service"
type JsonRecord = Record<string, unknown>
const MAX_RAW_BODY_BYTES = 1_048_576
async function readBoundedBody(request: Request): Promise<string | null> {
  const contentLength = Number(request.headers.get("content-length"))
  if (Number.isFinite(contentLength) && contentLength > MAX_RAW_BODY_BYTES)
    return null

  const body = request.clone().body
  if (!body) return ""

  const reader = body.getReader()
  const decoder = new TextDecoder()
  const chunks: string[] = []
  let bytes = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      bytes += value.byteLength
      if (bytes > MAX_RAW_BODY_BYTES) {
        await reader.cancel()
        return null
      }
      chunks.push(decoder.decode(value, { stream: true }))
    }
    chunks.push(decoder.decode())
    return chunks.join("")
  } finally {
    reader.releaseLock()
  }
}

const payloadTooLargeResponse = () =>
  new Response(JSON.stringify({ ok: false, error: "PAYLOAD_TOO_LARGE" }), {
    status: 413,
    headers: { "content-type": "application/json" },
  })
type ParsedEventResult = {
  code?: number
  message?: string
  entries?: unknown[]
  duplicate?: boolean
}
type WebhookItem = {
  deviceLookup:
    | { type: "phone"; value: string }
    | { type: "waba"; value: string }
  eventType: "inbound_message" | "status_update" | "template_status_update"
  jobEventType: "message" | "statuses" | "template_status_update"
  payload: Prisma.InputJsonValue
}

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const constantTimeEqual = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left, "utf8")
  const rightBuffer = Buffer.from(right, "utf8")
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  )
}

const invalidResponse = (
  set: { status?: number | string },
  status: 403 | 401 | 404 | 422 | 500,
  error: string
) => {
  set.status = status
  return { ok: false, error }
}

const logWebhookRejection = (params: {
  reason: string
  webhookKey: string
  metaAppId?: string
  phoneIds?: string[]
  ip?: string | null
  userAgent?: string | null
  details?: Record<string, unknown>
  rawPayload?: unknown
}) => {
  console.warn(
    `[WhatsApp Webhook] Rejected incoming webhook (${params.reason}): webhookKey=${params.webhookKey}, phoneIds=${JSON.stringify(params.phoneIds ?? [])}, metaAppId=${params.metaAppId ?? "unknown"}`
  )
  logWhatsappAuditEvent({
    action: "WEBHOOK_REJECTED",
    status: "FAILED",
    organizationId: "system",
    message: `Incoming Meta WhatsApp webhook rejected: ${params.reason}`,
    errorMessage: params.reason,
    ip: params.ip ?? null,
    userAgent: params.userAgent ?? null,
    details: {
      webhookKey: params.webhookKey,
      metaAppId: params.metaAppId,
      phoneIds: params.phoneIds,
      rawPayload: params.rawPayload,
      ...params.details,
    },
  }).catch(() => {})
}

function extractWebhookItems(payload: unknown): WebhookItem[] | null {
  if (!isRecord(payload) || payload.object !== "whatsapp_business_account") {
    return null
  }
  if (!Array.isArray(payload.entry) || payload.entry.length === 0) return null

  const items: WebhookItem[] = []
  for (const entry of payload.entry) {
    if (
      !isRecord(entry) ||
      !Array.isArray(entry.changes) ||
      entry.changes.length === 0
    ) {
      return null
    }
    for (const change of entry.changes) {
      if (!isRecord(change) || !isRecord(change.value)) return null

      if (change.field === "message_template_status_update") {
        const templateStatusUpdate = normalizeTemplateStatusUpdate(
          change.value,
          typeof entry.time === "number" ? entry.time : undefined
        )
        if (
          !templateStatusUpdate ||
          typeof entry.id !== "string" ||
          entry.id.length === 0
        ) {
          return null
        }
        items.push({
          deviceLookup: { type: "waba", value: entry.id },
          eventType: "template_status_update",
          jobEventType: "template_status_update",
          payload: templateStatusUpdate as unknown as Prisma.InputJsonValue,
        })
        continue
      }

      // Ignored informational change fields (like template_category_update, account_update, etc.)
      // that are valid Meta webhook payloads but do not require inbound event queueing
      if (
        change.field === "template_category_update" ||
        change.field === "account_update" ||
        change.field === "phone_number_name_update" ||
        change.field === "phone_number_quality_update"
      ) {
        continue
      }

      const metadata = change.value.metadata
      if (
        !isRecord(metadata) ||
        typeof metadata.phone_number_id !== "string" ||
        metadata.phone_number_id.length === 0
      ) {
        return null
      }

      const messages = change.value.messages
      const statuses = change.value.statuses
      if (messages !== undefined && !Array.isArray(messages)) return null
      if (statuses !== undefined && !Array.isArray(statuses)) return null
      if (
        (!messages || messages.length === 0) &&
        (!statuses || statuses.length === 0)
      ) {
        return null
      }

      for (const message of messages ?? []) {
        if (!isRecord(message)) return null
        items.push({
          deviceLookup: { type: "phone", value: metadata.phone_number_id },
          eventType: "inbound_message",
          jobEventType: "message",
          payload: message as unknown as Prisma.InputJsonValue,
        })
      }
      for (const status of statuses ?? []) {
        if (!isRecord(status)) return null
        items.push({
          deviceLookup: { type: "phone", value: metadata.phone_number_id },
          eventType: "status_update",
          jobEventType: "statuses",
          payload: status as unknown as Prisma.InputJsonValue,
        })
      }
    }
  }
  return items
}

export const metaWebhookRoutes = new Elysia({
  prefix: "/whatsapp/meta-webhook",
})
  .onRequest(async ({ request, store }) => {
    if (request.method === "POST") {
      try {
        const rawBody = await readBoundedBody(request)
        if (rawBody === null) return payloadTooLargeResponse()
        ;(store as Record<string, unknown>).rawBody = rawBody
      } catch {
        ;(store as Record<string, unknown>).rawBody = ""
      }
    }
  })
  .get(
    "/:webhookKey",
    async ({ params, query, set }) => {
      let credentials: ResolvedMetaAppCredentials | null
      try {
        credentials = await metaAppsService.resolveCredentialsByWebhookKey(
          params.webhookKey
        )
      } catch {
        return invalidResponse(set, 500, "INTERNAL_ERROR")
      }
      if (!credentials) return invalidResponse(set, 404, "NOT_FOUND")

      const mode = query["hub.mode"]
      const challenge = query["hub.challenge"]
      const verifyToken = query["hub.verify_token"]
      let tokenMatches = false
      if (typeof verifyToken === "string") {
        try {
          tokenMatches = constantTimeEqual(credentials.verifyToken, verifyToken)
        } catch {
          return invalidResponse(set, 500, "INTERNAL_ERROR")
        }
      }
      if (
        mode !== "subscribe" ||
        typeof challenge !== "string" ||
        challenge.length === 0 ||
        !tokenMatches
      ) {
        return invalidResponse(set, 403, "FORBIDDEN")
      }

      return new Response(challenge, {
        status: 200,
        headers: { "content-type": "text/plain; charset=utf-8" },
      })
    },
    {
      params: t.Object({ webhookKey: t.String() }),
      query: t.Object({
        "hub.mode": t.Optional(t.String()),
        "hub.challenge": t.Optional(t.String()),
        "hub.verify_token": t.Optional(t.String()),
      }),
    }
  )
  .post(
    "/:webhookKey",
    async ({ params, request, set, store }) => {
      let credentials: ResolvedMetaAppCredentials | null
      try {
        credentials = await metaAppsService.resolveCredentialsByWebhookKey(
          params.webhookKey
        )
      } catch {
        return invalidResponse(set, 500, "INTERNAL_ERROR")
      }
      if (!credentials) return invalidResponse(set, 404, "NOT_FOUND")

      const ip =
        request.headers.get("x-forwarded-for") ??
        request.headers.get("x-real-ip") ??
        null
      const userAgent = request.headers.get("user-agent") ?? null
      const rawBodyValue = (store as Record<string, unknown>).rawBody
      const rawBody = typeof rawBodyValue === "string" ? rawBodyValue : ""

      const signature = request.headers.get("x-hub-signature-256")
      if (!signature) {
        logWebhookRejection({
          reason: "MISSING_SIGNATURE",
          webhookKey: params.webhookKey,
          metaAppId: credentials.metaAppId,
          ip,
          userAgent,
        })
        return invalidResponse(set, 401, "UNAUTHORIZED")
      }
      let signatureValid = false
      try {
        signatureValid = verifyWebhookSignature(
          credentials.appSecret,
          rawBody,
          signature
        )
      } catch {
        return invalidResponse(set, 500, "INTERNAL_ERROR")
      }
      if (!signatureValid) {
        logWebhookRejection({
          reason: "INVALID_SIGNATURE",
          webhookKey: params.webhookKey,
          metaAppId: credentials.metaAppId,
          ip,
          userAgent,
        })
        return invalidResponse(set, 401, "UNAUTHORIZED")
      }

      let payload: unknown
      try {
        payload = JSON.parse(rawBody) as unknown
      } catch {
        logWebhookRejection({
          reason: "MALFORMED_JSON",
          webhookKey: params.webhookKey,
          metaAppId: credentials.metaAppId,
          ip,
          userAgent,
          rawPayload:
            rawBody.length > 5000 ? `${rawBody.slice(0, 5000)}...` : rawBody,
        })
        return invalidResponse(set, 422, "INVALID_PAYLOAD")
      }
      const extraction = extractWebhookItems(payload)
      if (extraction === null) {
        logWebhookRejection({
          reason: "INVALID_ENVELOPE_OR_EMPTY_ITEMS",
          webhookKey: params.webhookKey,
          metaAppId: credentials.metaAppId,
          ip,
          userAgent,
          rawPayload: payload,
        })
        return invalidResponse(set, 422, "INVALID_PAYLOAD")
      }

      // If payload is valid Meta envelope but contains only ignored informational events, return 200 OK without rejection
      if (extraction.length === 0) {
        return { success: true, ignored: true }
      }

      const items = extraction

      const deviceLookupKeys = [
        ...new Set(
          items.map(
            (item) => `${item.deviceLookup.type}:${item.deviceLookup.value}`
          )
        ),
      ]
      const devices = new Map<
        string,
        Array<{ id: string; organizationId: string }>
      >()
      try {
        await Promise.all(
          deviceLookupKeys.map(async (lookupKey) => {
            const [lookupType, lookupValue] = lookupKey.split(":", 2)
            if (lookupType === "phone") {
              const device = await metaAppsService.resolveDeviceByPhoneId(
                credentials.id,
                lookupValue
              )
              if (device) {
                devices.set(lookupKey, [
                  { id: device.id, organizationId: device.organizationId },
                ])
              }
              return
            }

            const matchedDevices = await metaAppsService.resolveDevicesByWabaId(
              credentials.id,
              lookupValue
            )
            if (matchedDevices.length > 0) {
              devices.set(
                lookupKey,
                matchedDevices.map((device) => ({
                  id: device.id,
                  organizationId: device.organizationId,
                }))
              )
            }
          })
        )
      } catch {
        return invalidResponse(set, 500, "INTERNAL_ERROR")
      }
      if (devices.size !== deviceLookupKeys.length) {
        const unmappedLookupKeys = deviceLookupKeys.filter(
          (key) => !devices.has(key)
        )
        const phoneIds = deviceLookupKeys
          .filter((key) => key.startsWith("phone:"))
          .map((key) => key.slice("phone:".length))
        const unmappedPhoneIds = unmappedLookupKeys
          .filter((key) => key.startsWith("phone:"))
          .map((key) => key.slice("phone:".length))
        const unmappedWabaIds = unmappedLookupKeys
          .filter((key) => key.startsWith("waba:"))
          .map((key) => key.slice("waba:".length))
        logWebhookRejection({
          reason: "UNKNOWN_DEVICE",
          webhookKey: params.webhookKey,
          metaAppId: credentials.metaAppId,
          phoneIds,
          ip,
          userAgent,
          details: { unmappedPhoneIds, unmappedWabaIds },
          rawPayload: payload,
        })
        return invalidResponse(set, 422, "UNKNOWN_DEVICE")
      }

      const phoneIds = deviceLookupKeys
        .filter((key) => key.startsWith("phone:"))
        .map((key) => key.slice("phone:".length))

      let parsedEvent: ParsedEventResult
      try {
        parsedEvent = await handleEventUseCase(payload, { rawBody })
      } catch {
        return invalidResponse(set, 500, "INTERNAL_ERROR")
      }
      if (!isRecord(parsedEvent)) {
        logWebhookRejection({
          reason: "UNEXPECTED_PARSE_RESULT",
          webhookKey: params.webhookKey,
          metaAppId: credentials.metaAppId,
          phoneIds,
          ip,
          userAgent,
          rawPayload: payload,
        })
        return invalidResponse(set, 422, "INVALID_PAYLOAD")
      }
      if (parsedEvent.duplicate === true) {
        return { ok: true, duplicate: true }
      }
      if (parsedEvent.code !== 200) {
        logWebhookRejection({
          reason: parsedEvent.message ?? "HANDLE_EVENT_FAILED",
          webhookKey: params.webhookKey,
          metaAppId: credentials.metaAppId,
          phoneIds,
          ip,
          userAgent,
          rawPayload: payload,
        })
        return invalidResponse(set, 422, "INVALID_PAYLOAD")
      }

      const createdEvents: Array<{
        eventId: string
        item: WebhookItem
        device: { id: string; organizationId: string }
      }> = []
      try {
        for (const item of items) {
          const lookupKey = `${item.deviceLookup.type}:${item.deviceLookup.value}`
          const matchedDevices = devices.get(lookupKey)
          if (!matchedDevices)
            return invalidResponse(set, 422, "UNKNOWN_DEVICE")
          for (const device of matchedDevices) {
            const eventId = await createWebhookEvent(
              device.organizationId,
              device.id,
              item.eventType,
              item.payload
            )
            createdEvents.push({ eventId, item, device })
          }
        }
      } catch {
        await Promise.allSettled(
          createdEvents.map(({ eventId }) =>
            recordProcessingResult(eventId, "FAILED", "CREATE_FAILED")
          )
        )
        return invalidResponse(set, 500, "INTERNAL_ERROR")
      }

      try {
        for (const { eventId, item, device } of createdEvents) {
          await WebhookRetryJob.dispatch({
            eventId,
            eventType: item.jobEventType,
            deviceId: device.id,
            organizationId: device.organizationId,
            payload: item.payload,
          })
        }
      } catch {
        await Promise.allSettled(
          createdEvents.map(({ eventId }) =>
            recordProcessingResult(eventId, "FAILED", "DISPATCH_FAILED")
          )
        )
        return invalidResponse(set, 500, "INTERNAL_ERROR")
      }

      return { ok: true, status: "received" }
    },
    { params: t.Object({ webhookKey: t.String() }) }
  )
