import { Prisma } from "@prisma/client"

export type WhatsappTemplateLanguageDTO = Pick<
  Prisma.WhatsappTemplateLanguageGetPayload<Prisma.WhatsappTemplateLanguageDefaultArgs>,
  | "id"
  | "lang"
  | "headerType"
  | "headerUrl"
  | "headerText"
  | "body"
  | "parameters"
  | "footer"
  | "buttons"
  | "isApproved"
  | "metaStatus"
  | "rejectReason"
  | "createdAt"
  | "updatedAt"
> & {
  /** Meta's `reason` webhook field or `rejected_reason` query field. */
  metaReason: string | null
}

export type WhatsappTemplateDeviceDTO = {
  id: string
  phoneNumber: string
  status: string
  whatsappBusinessAccountId?: string | null
  whatsappPhoneId?: string | null
}

export type WhatsappTemplateDTO = Pick<
  Prisma.WhatsappTemplateGetPayload<Prisma.WhatsappTemplateDefaultArgs>,
  | "id"
  | "slug"
  | "name"
  | "description"
  | "organizationId"
  | "whatsappDeviceId"
  | "syncStatus"
  | "metaStatus"
  | "lastSyncedAt"
  | "createdAt"
  | "updatedAt"
  | "category"
> & {
  languages?: WhatsappTemplateLanguageDTO[]
  device?: WhatsappTemplateDeviceDTO | null
}

type TemplateWithLanguagesAndDevice = Prisma.WhatsappTemplateGetPayload<{
  include: {
    languages: true
    whatsappDevice: {
      select: {
        id: true
        phoneNumber: true
        status: true
        whatsappBusinessAccountId: true
        whatsappPhoneId: true
      }
    }
  }
}>

type TemplateWithLanguages = Prisma.WhatsappTemplateGetPayload<{
  include: { languages: true }
}>

function toWhatsappTemplateLanguageDTO(
  language: Prisma.WhatsappTemplateLanguageGetPayload<Prisma.WhatsappTemplateLanguageDefaultArgs>
): WhatsappTemplateLanguageDTO {
  return {
    id: language.id,
    lang: language.lang,
    headerType: language.headerType,
    headerUrl: language.headerUrl,
    headerText: language.headerText,
    body: language.body,
    parameters: language.parameters,
    footer: language.footer,
    buttons: language.buttons,
    isApproved: language.isApproved,
    metaStatus: language.metaStatus,
    rejectReason: language.rejectReason,
    metaReason: language.rejectReason,
    createdAt: language.createdAt,
    updatedAt: language.updatedAt,
  }
}

export function toWhatsappTemplateDTO(
  template:
    | Prisma.WhatsappTemplateGetPayload<Prisma.WhatsappTemplateDefaultArgs>
    | TemplateWithLanguages
    | TemplateWithLanguagesAndDevice
): WhatsappTemplateDTO {
  const rawDevice =
    "whatsappDevice" in template ? template.whatsappDevice : undefined

  return {
    id: template.id,
    slug: template.slug,
    name: template.name,
    description: template.description,
    organizationId: template.organizationId,
    whatsappDeviceId: template.whatsappDeviceId,
    syncStatus: template.syncStatus,
    metaStatus: template.metaStatus,
    lastSyncedAt: template.lastSyncedAt,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
    category: template.category,
    device: rawDevice
      ? {
          id: rawDevice.id,
          phoneNumber: rawDevice.phoneNumber,
          status: rawDevice.status,
          whatsappBusinessAccountId: rawDevice.whatsappBusinessAccountId,
          whatsappPhoneId: rawDevice.whatsappPhoneId,
        }
      : null,
    languages:
      "languages" in template && Array.isArray(template.languages)
        ? template.languages.map(toWhatsappTemplateLanguageDTO)
        : undefined,
  }
}
