import { Prisma } from "@prisma/client"

export type WhatsappContactDTO = Pick<
  Prisma.WhatsappContactGetPayload<Prisma.WhatsappContactDefaultArgs>,
  | "id"
  | "phoneNumber"
  | "name"
  | "email"
  | "status"
  | "lastContactedAt"
  | "waId"
  | "isWhatsapp"
  | "lastCheckedAt"
  | "dynamicValues"
  | "createdAt"
  | "updatedAt"
>

export function toWhatsappContactDTO(
  contact: Prisma.WhatsappContactGetPayload<Prisma.WhatsappContactDefaultArgs>
): WhatsappContactDTO {
  return {
    id: contact.id,
    phoneNumber: contact.phoneNumber,
    name: contact.name,
    email: contact.email,
    status: contact.status,
    lastContactedAt: contact.lastContactedAt,
    waId: contact.waId,
    isWhatsapp: contact.isWhatsapp,
    lastCheckedAt: contact.lastCheckedAt,
    dynamicValues: contact.dynamicValues,
    createdAt: contact.createdAt,
    updatedAt: contact.updatedAt,
  }
}
