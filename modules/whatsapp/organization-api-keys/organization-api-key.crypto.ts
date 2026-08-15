import { generateRawApiKey } from "@/lib/whatsapp/crypto"

export const WHATSAPP_ORGANIZATION_API_KEY_PREFIX = "wa_live_"

const KEY_BODY_PATTERN = "[A-Za-z0-9_-]{43}"
const KEY_FINGERPRINT_LENGTH = 16
const KEY_PATTERN = new RegExp(
  `^${WHATSAPP_ORGANIZATION_API_KEY_PREFIX}${KEY_BODY_PATTERN}$`
)

export const generateWhatsappOrganizationApiKey = () =>
  generateRawApiKey(WHATSAPP_ORGANIZATION_API_KEY_PREFIX)

// Derive a public identifier from the one-way stored hash, never the raw key.
export const fingerprintWhatsappOrganizationApiKey = (keyHash: string) =>
  `wa_key_${keyHash.slice(-KEY_FINGERPRINT_LENGTH)}`

export const isWellFormedWhatsappOrganizationApiKey = (value: string) =>
  KEY_PATTERN.test(value)
