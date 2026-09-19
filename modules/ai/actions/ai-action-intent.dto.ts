import type { AiActionIntent } from "@prisma/client"

export type ActionIntentSlotType = "STRING" | "NUMBER" | "DATE"

export interface ActionIntentSlotDTO {
  name: string
  type: ActionIntentSlotType
  required: boolean
  inquiryQuestion: string
  description?: string
}

export interface AiActionIntentDTO {
  id: string
  organizationId: string
  agentProfileId: string | null
  name: string
  description: string | null
  connectionId: string | null
  connectionName?: string | null
  subpath: string
  method: string
  slots: ActionIntentSlotDTO[]
  requireCustomerConfirmation: boolean
  enableMultimodalVision: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export function parseActionSlots(raw: unknown): ActionIntentSlotDTO[] {
  let list: unknown[] = []
  if (Array.isArray(raw)) {
    list = raw
  } else if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        list = parsed
      }
    } catch {
      list = []
    }
  }

  return list.map((item) => {
    const record =
      item && typeof item === "object"
        ? (item as Record<string, unknown>)
        : {}

    const typeRaw = String(record.type ?? "STRING").toUpperCase()
    const type: ActionIntentSlotType =
      typeRaw === "NUMBER" || typeRaw === "DATE" ? typeRaw : "STRING"

    return {
      name: String(record.name ?? "").trim(),
      type,
      required: Boolean(record.required),
      inquiryQuestion: String(record.inquiryQuestion ?? "").trim(),
      description: record.description
        ? String(record.description).trim()
        : undefined,
    }
  })
}

export function toAiActionIntentDTO(
  entity: AiActionIntent & {
    connection?: { name: string } | null
  }
): AiActionIntentDTO {
  return {
    id: entity.id,
    organizationId: entity.organizationId,
    agentProfileId: entity.agentProfileId,
    name: entity.name,
    description: entity.description,
    connectionId: entity.connectionId,
    connectionName: entity.connection?.name ?? null,
    subpath: entity.subpath,
    method: entity.method,
    slots: parseActionSlots(entity.slots),
    requireCustomerConfirmation: entity.requireCustomerConfirmation,
    enableMultimodalVision: entity.enableMultimodalVision,
    isActive: entity.isActive,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
  }
}
