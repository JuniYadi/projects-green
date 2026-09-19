import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import {
  type ActionIntentSlotDTO,
  type AiActionIntentDTO,
  toAiActionIntentDTO,
} from "./ai-action-intent.dto"

export interface CreateActionIntentInput {
  organizationId: string
  agentProfileId?: string | null
  name: string
  description?: string | null
  connectionId?: string | null
  subpath?: string
  method?: string
  slots?: ActionIntentSlotDTO[]
  requireCustomerConfirmation?: boolean
  enableMultimodalVision?: boolean
  isActive?: boolean
}

export interface UpdateActionIntentInput {
  agentProfileId?: string | null
  name?: string
  description?: string | null
  connectionId?: string | null
  subpath?: string
  method?: string
  slots?: ActionIntentSlotDTO[]
  requireCustomerConfirmation?: boolean
  enableMultimodalVision?: boolean
  isActive?: boolean
}

export async function listActionIntents(options: {
  organizationId: string
  agentProfileId?: string
}): Promise<AiActionIntentDTO[]> {
  const where: {
    organizationId: string
    agentProfileId?: string
  } = {
    organizationId: options.organizationId,
  }

  if (options.agentProfileId) {
    where.agentProfileId = options.agentProfileId
  }

  const items = await prisma.aiActionIntent.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      connection: {
        select: { name: true },
      },
    },
  })

  return items.map(toAiActionIntentDTO)
}

export async function getActionIntent(
  id: string,
  organizationId: string
): Promise<AiActionIntentDTO | null> {
  const item = await prisma.aiActionIntent.findFirst({
    where: { id, organizationId },
    include: {
      connection: {
        select: { name: true },
      },
    },
  })

  if (!item) {
    return null
  }

  return toAiActionIntentDTO(item)
}

export async function createActionIntent(
  input: CreateActionIntentInput
): Promise<AiActionIntentDTO> {
  if (input.connectionId) {
    const conn = await prisma.aiIntegrationConnection.findFirst({
      where: {
        id: input.connectionId,
        organizationId: input.organizationId,
      },
    })
    if (!conn) {
      throw new Error("Connection not found in current organization")
    }
  }

  if (input.agentProfileId) {
    const agent = await prisma.aiAgentProfile.findFirst({
      where: {
        id: input.agentProfileId,
        organizationId: input.organizationId,
      },
    })
    if (!agent) {
      throw new Error("Agent profile not found in current organization")
    }
  }

  const created = await prisma.aiActionIntent.create({
    data: {
      organizationId: input.organizationId,
      agentProfileId: input.agentProfileId ?? null,
      name: input.name.trim(),
      description: input.description?.trim() ?? null,
      connectionId: input.connectionId ?? null,
      subpath: input.subpath?.trim() || "/",
      method: (input.method?.trim() || "GET").toUpperCase(),
      slots: (input.slots ?? []) as unknown as Prisma.InputJsonValue,
      requireCustomerConfirmation: Boolean(input.requireCustomerConfirmation),
      enableMultimodalVision: Boolean(input.enableMultimodalVision),
      isActive: input.isActive ?? true,
    },
    include: {
      connection: {
        select: { name: true },
      },
    },
  })

  return toAiActionIntentDTO(created)
}

export async function updateActionIntent(
  id: string,
  organizationId: string,
  input: UpdateActionIntentInput
): Promise<AiActionIntentDTO> {
  const existing = await prisma.aiActionIntent.findFirst({
    where: { id, organizationId },
  })
  if (!existing) {
    throw new Error("Action intent not found")
  }

  if (input.connectionId) {
    const conn = await prisma.aiIntegrationConnection.findFirst({
      where: {
        id: input.connectionId,
        organizationId,
      },
    })
    if (!conn) {
      throw new Error("Connection not found in current organization")
    }
  }

  if (input.agentProfileId) {
    const agent = await prisma.aiAgentProfile.findFirst({
      where: {
        id: input.agentProfileId,
        organizationId,
      },
    })
    if (!agent) {
      throw new Error("Agent profile not found in current organization")
    }
  }

  const updated = await prisma.aiActionIntent.update({
    where: { id },
    data: {
      agentProfileId:
        input.agentProfileId !== undefined
          ? input.agentProfileId
          : existing.agentProfileId,
      name: input.name !== undefined ? input.name.trim() : existing.name,
      description:
        input.description !== undefined
          ? input.description?.trim() ?? null
          : existing.description,
      connectionId:
        input.connectionId !== undefined
          ? input.connectionId
          : existing.connectionId,
      subpath:
        input.subpath !== undefined
          ? input.subpath.trim() || "/"
          : existing.subpath,
      method:
        input.method !== undefined
          ? input.method.trim().toUpperCase()
          : existing.method,
      slots:
        input.slots !== undefined
          ? (input.slots as unknown as Prisma.InputJsonValue)
          : (existing.slots as Prisma.InputJsonValue),
      requireCustomerConfirmation:
        input.requireCustomerConfirmation !== undefined
          ? Boolean(input.requireCustomerConfirmation)
          : existing.requireCustomerConfirmation,
      enableMultimodalVision:
        input.enableMultimodalVision !== undefined
          ? Boolean(input.enableMultimodalVision)
          : existing.enableMultimodalVision,
      isActive:
        input.isActive !== undefined
          ? Boolean(input.isActive)
          : existing.isActive,
    },
    include: {
      connection: {
        select: { name: true },
      },
    },
  })

  return toAiActionIntentDTO(updated)
}

export async function deleteActionIntent(
  id: string,
  organizationId: string
): Promise<boolean> {
  const result = await prisma.aiActionIntent.deleteMany({
    where: { id, organizationId },
  })

  return result.count > 0
}
