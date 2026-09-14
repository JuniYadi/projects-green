import { Prisma } from "@prisma/client"

export type WhatsappBroadcastDeviceDTO = {
  id: string
  phoneNumber: string
  name?: string | null
  verifiedName?: string | null
  status?: string | null
}

export type WhatsappBroadcastRecipientDTO = Pick<
  Prisma.WhatsappBroadcastRecipientGetPayload<Prisma.WhatsappBroadcastRecipientDefaultArgs>,
  | "id"
  | "phoneNumber"
  | "name"
  | "dynamicValues"
  | "status"
  | "attempts"
  | "waMessageId"
  | "lastError"
  | "createdAt"
  | "updatedAt"
>

export type WhatsappBroadcastCampaignDTO = Pick<
  Prisma.WhatsappBroadcastCampaignGetPayload<Prisma.WhatsappBroadcastCampaignDefaultArgs>,
  | "id"
  | "templateId"
  | "templateName"
  | "templateLanguage"
  | "templateParams"
  | "status"
  | "total"
  | "queued"
  | "sent"
  | "failed"
  | "startedAt"
  | "endedAt"
  | "createdAt"
  | "updatedAt"
  | "throttleMaxMessages"
  | "throttlePerMinutes"
  | "acknowledgeMultiDay"
  | "whatsappDeviceId"
  | "whatsappContactGroupId"
> & {
  recipients?: WhatsappBroadcastRecipientDTO[]
  recipientCount?: number
  whatsappDevice?: WhatsappBroadcastDeviceDTO | null
}

type CampaignDeviceRecord = {
  id: string
  phoneNumber: string
  whatsappProfile?: Prisma.JsonValue | null
  status?: string | null
}

type CampaignWithRelations = Prisma.WhatsappBroadcastCampaignGetPayload<{
  include: {
    recipients?: true
    whatsappDevice?: {
      select: {
        id: true
        phoneNumber: true
        whatsappProfile: true
        status: true
      }
    }
    _count?: { select: { recipients: true } }
  }
}>

export function toWhatsappBroadcastRecipientDTO(
  recipient: Prisma.WhatsappBroadcastRecipientGetPayload<Prisma.WhatsappBroadcastRecipientDefaultArgs>
): WhatsappBroadcastRecipientDTO {
  return {
    id: recipient.id,
    phoneNumber: recipient.phoneNumber,
    name: recipient.name,
    dynamicValues: recipient.dynamicValues,
    status: recipient.status,
    attempts: recipient.attempts,
    waMessageId: recipient.waMessageId,
    lastError: recipient.lastError,
    createdAt: recipient.createdAt,
    updatedAt: recipient.updatedAt,
  }
}

export function toWhatsappBroadcastCampaignDTO(
  campaign:
    | Prisma.WhatsappBroadcastCampaignGetPayload<Prisma.WhatsappBroadcastCampaignDefaultArgs>
    | CampaignWithRelations
    | (Prisma.WhatsappBroadcastCampaignGetPayload<Prisma.WhatsappBroadcastCampaignDefaultArgs> & {
        whatsappDevice?: CampaignDeviceRecord | null
        recipients?: Prisma.WhatsappBroadcastRecipientGetPayload<Prisma.WhatsappBroadcastRecipientDefaultArgs>[]
        _count?: { recipients: number }
      })
): WhatsappBroadcastCampaignDTO {
  let device: WhatsappBroadcastDeviceDTO | null = null

  if ("whatsappDevice" in campaign && campaign.whatsappDevice) {
    const rawDevice = campaign.whatsappDevice as CampaignDeviceRecord
    const profile =
      rawDevice.whatsappProfile &&
      typeof rawDevice.whatsappProfile === "object" &&
      !Array.isArray(rawDevice.whatsappProfile)
        ? (rawDevice.whatsappProfile as Record<string, unknown>)
        : null

    const verifiedName =
      profile &&
      typeof profile.verified_name === "string" &&
      profile.verified_name.trim().length > 0
        ? profile.verified_name.trim()
        : null

    device = {
      id: rawDevice.id,
      phoneNumber: rawDevice.phoneNumber,
      name: rawDevice.phoneNumber,
      verifiedName,
      status: rawDevice.status,
    }
  }

  return {
    id: campaign.id,
    templateId: campaign.templateId,
    templateName: campaign.templateName,
    templateLanguage: campaign.templateLanguage,
    templateParams: campaign.templateParams,
    status: campaign.status,
    total: campaign.total,
    queued: campaign.queued,
    sent: campaign.sent,
    failed: campaign.failed,
    startedAt: campaign.startedAt,
    endedAt: campaign.endedAt,
    createdAt: campaign.createdAt,
    updatedAt: campaign.updatedAt,
    throttleMaxMessages: campaign.throttleMaxMessages,
    throttlePerMinutes: campaign.throttlePerMinutes,
    acknowledgeMultiDay: campaign.acknowledgeMultiDay,
    whatsappDeviceId: campaign.whatsappDeviceId,
    whatsappContactGroupId: campaign.whatsappContactGroupId,
    whatsappDevice: device,
    recipients:
      "recipients" in campaign && Array.isArray(campaign.recipients)
        ? campaign.recipients.map(toWhatsappBroadcastRecipientDTO)
        : undefined,
    recipientCount:
      "_count" in campaign && campaign._count
        ? campaign._count.recipients
        : undefined,
  }
}
