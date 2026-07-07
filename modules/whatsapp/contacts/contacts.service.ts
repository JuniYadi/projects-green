import { prisma } from "@/lib/prisma"

export const DEFAULT_CONTACT_GROUP_NAME = "Ungrouped"

export type ResolveContactGroupResult =
  | { ok: true; id: string }
  | { ok: false; message: string }

/**
 * Resolve a usable contact group id for an organization. When the caller does
 * not provide one, fall back to (or lazily create) a default "Ungrouped" group
 * so contacts can be added without a dedicated Groups UI (WhatsApp MVP).
 */
export async function resolveWhatsappContactGroupId(
  organizationId: string,
  requestedGroupId?: string
): Promise<ResolveContactGroupResult> {
  if (requestedGroupId) {
    const group = await prisma.whatsappContactGroup.findFirst({
      where: { id: requestedGroupId, organizationId },
    })
    if (!group) {
      return { ok: false, message: "Contact group not found or access denied." }
    }
    return { ok: true, id: group.id }
  }

  const existingDefault = await prisma.whatsappContactGroup.findFirst({
    where: { organizationId, name: DEFAULT_CONTACT_GROUP_NAME },
  })
  if (existingDefault) {
    return { ok: true, id: existingDefault.id }
  }

  const created = await prisma.whatsappContactGroup.create({
    data: {
      organizationId,
      name: DEFAULT_CONTACT_GROUP_NAME,
      description: "Default audience for ungrouped contacts.",
    },
  })
  return { ok: true, id: created.id }
}

export type UpsertWhatsappContactFromMessageOptions = {
  organizationId: string
  phoneNumber: string
  whatsappDeviceId?: string | null
  messageAt?: Date
  isWhatsapp?: boolean
  waId?: string | null
  markChecked?: boolean
}

/**
 * Upsert a contact record when a message is sent or received.
 * Used by outbound sends, inbound webhooks, delivery status updates, and broadcasts.
 * Never sets `isWhatsapp` back to false from a queued/outbound send.
 */
export async function upsertWhatsappContactFromMessage(
  options: UpsertWhatsappContactFromMessageOptions
): Promise<void> {
  const {
    organizationId,
    phoneNumber,
    whatsappDeviceId,
    messageAt,
    isWhatsapp,
    waId,
    markChecked,
  } = options

  const now = messageAt ?? new Date()

  // Build update data — only set fields that should always update
  const updateData: Record<string, unknown> = {
    lastContactedAt: now,
    status: "ACTIVE",
  }

  if (whatsappDeviceId) {
    updateData.whatsappDeviceId = whatsappDeviceId
  }

  // Only promote to isWhatsapp, never demote
  if (isWhatsapp === true) {
    updateData.isWhatsapp = true
  }

  if (waId !== undefined && waId !== null) {
    updateData.waId = waId
  }

  if (markChecked === true) {
    updateData.lastCheckedAt = now
  }

  // Resolve default group — throw on failure only during create
  const groupResult = await resolveWhatsappContactGroupId(organizationId)
  if (!groupResult.ok) {
    throw new Error(groupResult.message)
  }

  await prisma.whatsappContact.upsert({
    where: {
      organizationId_phoneNumber: { organizationId, phoneNumber },
    },
    create: {
      organizationId,
      phoneNumber,
      name: phoneNumber,
      email: "",
      status: "ACTIVE",
      contactGroupId: groupResult.id,
      lastContactedAt: now,
      whatsappDeviceId: whatsappDeviceId ?? undefined,
      isWhatsapp: isWhatsapp ?? false,
      waId: waId ?? null,
      lastCheckedAt: markChecked ? now : null,
    },
    update: updateData,
  })
}
