import { createHash } from "node:crypto"

import { generateRawApiKey } from "@/lib/whatsapp/crypto"

export const WHATSAPP_ORGANIZATION_API_KEY_PREFIX = "wa_live_"

const KEY_BODY_PATTERN = "[A-Za-z0-9_-]{43}"
const KEY_PATTERN = new RegExp(
  `^${WHATSAPP_ORGANIZATION_API_KEY_PREFIX}${KEY_BODY_PATTERN}$`
)

export const generateWhatsappOrganizationApiKey = () =>
  generateRawApiKey(WHATSAPP_ORGANIZATION_API_KEY_PREFIX)

export const fingerprintWhatsappOrganizationApiKey = (keyHash: string) =>
  createHash("sha256").update(keyHash, "utf8").digest("hex")

export const isWellFormedWhatsappOrganizationApiKey = (value: string) =>
  KEY_PATTERN.test(value)
