const API_VERSION = process.env.WHATSAPP_API_VERSION || "v21.0"
const BASE_URL = process.env.graphApiBaseUrl || "https://graph.facebook.com"

export const getEndpoint = (path: string) =>
  `${BASE_URL}/${API_VERSION}/${path}`

export const ENDPOINTS = {
  MESSAGES: (phoneNumberId: string) => getEndpoint(`${phoneNumberId}/messages`),
  MEDIA: (phoneNumberId: string) => getEndpoint(`${phoneNumberId}/media`),
  PHONE_INFO: (phoneNumberId: string) => getEndpoint(phoneNumberId),
  BUSINESS_PROFILE: (phoneNumberId: string) =>
    getEndpoint(`${phoneNumberId}/whatsapp_business_profile`),
  TEMPLATES: (wabaId: string) => getEndpoint(`${wabaId}/message_templates`),
  WABA_INFO: (wabaId: string) => getEndpoint(wabaId),
  WABA_PHONE_NUMBERS: (wabaId: string) =>
    getEndpoint(`${wabaId}/phone_numbers`),
  WEBHOOK_SUBSCRIPTION: (appId: string) =>
    getEndpoint(`${appId}/subscriptions`),
  MEDIA_BY_ID: (mediaId: string) => getEndpoint(mediaId),
  ANALYTICS: (wabaId: string) => getEndpoint(`${wabaId}/analytics`),
}
