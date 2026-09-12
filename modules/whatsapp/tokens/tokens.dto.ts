import type { WhatsappApiKey } from "@prisma/client"

// The stored `key` secret never leaves the server once it is saved.
export type WhatsappApiKeyDTO = Omit<WhatsappApiKey, "key">

export const toWhatsappApiKeyDTO = (
  token: WhatsappApiKey
): WhatsappApiKeyDTO => ({
  id: token.id,
  organizationId: token.organizationId,
  name: token.name,
  environment: token.environment,
  isActive: token.isActive,
  lastUsedAt: token.lastUsedAt,
  createdAt: token.createdAt,
  updatedAt: token.updatedAt,
})
