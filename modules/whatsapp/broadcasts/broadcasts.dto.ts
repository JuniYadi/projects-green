import { Prisma } from "@prisma/client"

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
> & {
  recipients?: WhatsappBroadcastRecipientDTO[]
  recipientCount?: number
}

type CampaignWithRecipients = Prisma.WhatsappBroadcastCampaignGetPayload<{
  include: { recipients: true }
}>

type CampaignWithCount = Prisma.WhatsappBroadcastCampaignGetPayload<{
  include: { _count: { select: { recipients: true } } }
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
    | CampaignWithRecipients
    | CampaignWithCount
): WhatsappBroadcastCampaignDTO {
  return {
    id: campaign.id,
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
    recipients:
      "recipients" in campaign
        ? campaign.recipients.map(toWhatsappBroadcastRecipientDTO)
        : undefined,
    recipientCount:
      "_count" in campaign ? campaign._count.recipients : undefined,
  }
}
