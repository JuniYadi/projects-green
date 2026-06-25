export type SendMessageInputBase = {
  to: string
}

export type SendTextPayload = {
  text: string
}

export type SendTemplatePayload = {
  templateId: string
  languageCode: string
  variables?: Record<string, string>
}

export type MediaReferencePayload = {
  id?: string
  link?: string
}

export type SendImagePayload = MediaReferencePayload & {
  caption?: string
}

export type SendAudioPayload = MediaReferencePayload

export type SendVideoPayload = MediaReferencePayload & {
  caption?: string
}

export type SendStickerPayload = MediaReferencePayload

export type SendDocumentPayload = MediaReferencePayload & {
  caption?: string
  filename?: string
}

export type SendLocationPayload = {
  latitude: number
  longitude: number
  name?: string
  address?: string
}

export type SendContactInput = {
  name: {
    formatted_name: string
    first_name?: string
    last_name?: string
    middle_name?: string
    suffix?: string
    prefix?: string
  }
  phones?: Array<{
    phone?: string
    wa_id?: string
    type?: string
  }>
  emails?: Array<{
    email?: string
    type?: string
  }>
  urls?: Array<{
    url?: string
    type?: string
  }>
  addresses?: Array<{
    street?: string
    city?: string
    state?: string
    zip?: string
    country?: string
    country_code?: string
    type?: string
  }>
  org?: {
    company?: string
    department?: string
    title?: string
  }
  birthday?: string
}

export type SendContactsPayload = {
  contacts: SendContactInput[]
}

// ─── Interactive (Reply Buttons / List / CTA URL) ────────────────────────

export type InteractiveReplyButton = {
  type: "reply"
  reply: { id: string; title: string }
}

export type InteractiveCTAUrlButton = {
  type: "cta_url"
  cta_url: { id?: string; display_text: string; url: string }
}

export type InteractiveButtonPayload = {
  type: "button"
  header?: { type: string; text: string }
  body: { text: string }
  footer?: { text: string }
  action: {
    buttons: Array<InteractiveReplyButton | InteractiveCTAUrlButton>
  }
}

export type InteractiveListSectionRow = {
  id: string
  title: string
  description?: string
}

export type InteractiveListSection = {
  title?: string
  rows: InteractiveListSectionRow[]
}

export type InteractiveListPayload = {
  type: "list"
  header?: { type: string; text: string }
  body: { text: string }
  footer?: { text: string }
  action: {
    button: string
    sections: InteractiveListSection[]
  }
}

export type InteractivePayload = InteractiveButtonPayload | InteractiveListPayload

export type SendInteractivePayload = InteractivePayload

// Convenience input types for sendReplyButtons / sendList
export type SendInteractiveButtonInput = {
  to: string
  header?: { type: string; text: string }
  body: { text: string }
  footer?: { text: string }
  buttons: Array<{ id: string; title: string }>
}

export type SendInteractiveListInput = {
  to: string
  header?: { type: string; text: string }
  body: { text: string }
  footer?: { text: string }
  button: string
  sections: InteractiveListSection[]
}

// ponytail: CTA URL is buttons with type "cta_url" — same structure as reply buttons.
export type SendInteractiveCTAUrlInput = {
  to: string
  header?: { type: string; text: string }
  body: { text: string }
  footer?: { text: string }
  buttons: Array<{ display_text: string; url: string; id?: string }>
}

export type SendReactionPayload = {
  messageId: string
  emoji: string
}

export type SendMessageInput = SendMessageInputBase &
  (
    | { type: "text"; payload: SendTextPayload }
    | { type: "template"; payload: SendTemplatePayload }
    | { type: "image"; payload: SendImagePayload }
    | { type: "audio"; payload: SendAudioPayload }
    | { type: "video"; payload: SendVideoPayload }
    | { type: "sticker"; payload: SendStickerPayload }
    | { type: "document"; payload: SendDocumentPayload }
    | { type: "location"; payload: SendLocationPayload }
    | { type: "contacts"; payload: SendContactsPayload }
    | { type: "interactive"; payload: SendInteractivePayload }
    | { type: "reaction"; payload: SendReactionPayload }
  )

export type SendMessageResult = {
  providerMessageId: string
  accepted: boolean
  rawStatus?: string
}

export type SendTemplateHeaderInput =
  | { type: "image" | "video"; id?: string; url?: string }
  | { type: "document"; id?: string; url?: string; filename?: string }

export type SendTemplateButtonsInput = {
  url?: string
  example?: string
  url_example?: string
  otp_copy_code?: string
  otp_one_tap?: string
  quick_reply?: string
}

export type SendTemplateMessageInput = SendMessageInputBase & {
  templateName: string
  templateLanguage: string
  category?: string
  fields?: string[]
  footer?: string
  header?: SendTemplateHeaderInput
  buttons?: SendTemplateButtonsInput
}

export type SendTemplateMessageResult = {
  providerMessageId: string
  accepted: boolean
  rawStatus?: string
}

export type ReplyPayloadText = {
  body: string
}

export type ReplyPayloadMedia = {
  link: string
  caption?: string
  filename?: string
}

export type SendReplyInput = SendMessageInputBase &
  (
    | { type: "text"; payload: ReplyPayloadText }
    | { type: "image" | "document"; payload: ReplyPayloadMedia }
  )

export type UploadMediaInput = {
  fileName: string
  mimeType: string
  data: ArrayBuffer
  type?: string
}

export type UploadMediaResult = {
  mediaId: string
}

export type PhoneNumberInfo = {
  id: string
  displayPhoneNumber?: string
  verifiedName?: string
  qualityRating?: string
  codeVerificationStatus?: string
  status?: string
}

export type WebhookEventEntry = {
  id: string
  changes: Array<{
    value: {
      messaging_product: "whatsapp"
      metadata: {
        display_phone_number: string
        phone_number_id: string
      }
      contacts?: Array<{
        profile: { name: string }
        wa_id: string
      }>
      messages?: Array<MessageEvent>
      statuses?: Array<StatusUpdateEvent>
    }
    field: "messages"
  }>
}

export type MessageEvent = {
  from: string
  id: string
  timestamp: string
  type:
    | "text"
    | "image"
    | "video"
    | "audio"
    | "document"
    | "sticker"
    | "location"
    | "contacts"
    | "interactive"
    | "button"
    | "reaction"
    | "unsupported"
  text?: { body: string }
  image?: { caption?: string; mime_type: string; sha256: string; id: string }
  video?: { caption?: string; mime_type: string; sha256: string; id: string }
  audio?: { mime_type: string; sha256: string; id: string; voice: boolean }
  document?: {
    caption?: string
    mime_type: string
    sha256: string
    id: string
    filename?: string
  }
  sticker?: { mime_type: string; sha256: string; id: string; animated: boolean }
  location?: {
    latitude: number
    longitude: number
    name?: string
    address?: string
  }
  contacts?: SendContactInput[]
  interactive?: {
    type: string
    button_reply?: { id: string; title: string }
    list_reply?: { id: string; title: string; description?: string }
  }
  button?: { payload: string; text: string }
  reaction?: { message_id: string; emoji: string }
  context?: { from: string; id: string }
}

export type StatusUpdateEvent = {
  id: string
  status: "sent" | "delivered" | "read" | "failed" | "deleted"
  timestamp: string
  recipient_id: string
  conversation?: { id: string; origin: { type: string } }
  pricing?: { billable: boolean; pricing_model: string; category: string }
  errors?: Array<{
    code: number
    title: string
    message: string
    error_data?: { details: string }
  }>
}
