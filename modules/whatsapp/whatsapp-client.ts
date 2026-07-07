/**
 * WhatsApp API Client
 * Typed fetch-based client for all WhatsApp endpoints.
 * Pattern: factory function returning an object with typed async methods.
 */

// ─── API Response Types ───────────────────────────────────────────────────

type ApiSuccess<T> = { ok: true } & T
type ApiError = { ok: false; error: string; message: string }
type ApiResponse<T> = ApiSuccess<T> | ApiError

// ─── Device Types ─────────────────────────────────────────────────────────

export type DeviceStatus = "ACTIVE" | "NON_ACTIVE"
export type Device = {
  id: string
  organizationId: string
  phoneNumber: string
  balance: number
  quotaBase: number
  quotaBaseOut: number
  dailyLimitMessage: number
  status: DeviceStatus
  token?: string | null
  tokenEncrypted?: string | null
  tokenIv?: string | null
  whatsappBusinessAccountId?: string | null
  whatsappPhoneId?: string | null
  whatsappApplicationId?: string | null
  whatsappProfile?: Record<string, unknown> | null
  features?: Record<string, unknown> | null
  callbackUrl?: string | null
  expiredAt?: string | null
  createdAt: string
  updatedAt: string
}

export type UpdateDeviceInput = {
  phoneNumber?: string
  status?: DeviceStatus
  token?: string
  quotaBase?: number
  dailyLimitMessage?: number
  callbackUrl?: string
}

// ─── Template Types ───────────────────────────────────────────────────────

export type TemplateSyncStatus = "SYNCED" | "NOT_SYNCED" | "NOT_IN_META"
export type TemplateMetaStatus = "APPROVED" | "PENDING" | "REJECTED"

export type TemplateLanguage = {
  id: string
  templateId: string
  lang: string
  headerType?: string | null
  headerUrl?: string | null
  headerText?: string | null
  body?: string | null
  parameters?: Record<string, unknown> | null
  footer?: string | null
  buttons?: Record<string, unknown>[] | null
  authConfig?: Record<string, unknown> | null
  isApproved: boolean
  metaStatus?: TemplateMetaStatus | null
  rejectReason?: string | null
  createdAt: string
  updatedAt: string
}

export type Template = {
  id: string
  organizationId: string
  slug: string
  name: string
  description?: string | null
  syncStatus: TemplateSyncStatus
  metaStatus?: TemplateMetaStatus | null
  category?: "MARKETING" | "UTILITY" | "AUTHENTICATION" | null
  lastSyncedAt?: string | null
  whatsappDeviceId?: string | null
  createdAt: string
  updatedAt: string
  languages: TemplateLanguage[]
}

export type CreateTemplateInput = {
  slug: string
  name: string
  description?: string | null
  whatsappDeviceId?: string | null
  languages: Array<{
    lang: string
    headerType?: string
    headerUrl?: string
    headerText?: string
    body?: string
    parameters?: Record<string, unknown>
    footer?: string
    buttons?: Record<string, unknown>[]
  }>
}

export type UpdateTemplateInput = Partial<
  Omit<CreateTemplateInput, "languages">
>

// ─── Contact Types ────────────────────────────────────────────────────────

export type ContactStatus = "ACTIVE" | "INACTIVE"

export type Contact = {
  id: string
  organizationId: string
  phoneNumber: string
  name: string
  email: string
  status: ContactStatus
  contactGroupId: string
  isWhatsapp: boolean
  waId?: string | null
  lastContactedAt?: string | null
  lastCheckedAt?: string | null
  dynamicValues?: Record<string, unknown> | null
  dynamicRaw?: string | null
  whatsappDeviceId?: string | null
  createdAt: string
  updatedAt: string
  lastMessage?: string | null
  lastMessageAt?: string | null
  lastMessageDirection?: string | null
}

export type CreateContactInput = {
  phoneNumber: string
  name: string
  email: string
  contactGroupId?: string
  status?: ContactStatus
  whatsappDeviceId?: string | null
  dynamicValues?: Record<string, unknown> | null
  dynamicRaw?: string | null
}

export type UpdateContactInput = Partial<CreateContactInput>

// ─── Conversation Types ───────────────────────────────────────────────────

export type MessageDirection = "INBOX" | "OUTBOX"

export type Conversation = {
  id: string
  organizationId: string
  contactPhone: string
  lastMessageAt?: string | null
  lastDirection?: MessageDirection | null
  whatsappDeviceId?: string | null
  _count?: { whatsappMessages: number }
  createdAt: string
  updatedAt: string
  whatsappMessages?: Message[]
}

export type CreateConversationInput = {
  contactPhone: string
  whatsappDeviceId?: string | null
}

// ─── Message Types ────────────────────────────────────────────────────────

export type MessageDeliveryStatus = "SENT" | "DELIVERED" | "READ" | "FAILED"

export type Message = {
  id: string
  conversationId: string
  direction: MessageDirection
  messageType: string
  body?: string | null
  mediaUrl?: string | null
  waMessageId?: string | null
  metadata?: Record<string, unknown> | null
  statusHistory?: MessageStatus[]
  createdAt: string
  updatedAt: string
}

export type MessageStatus = {
  id: string
  messageId: string
  status: MessageDeliveryStatus
  timestamp: string
}

export type SendMessageInput = {
  phoneNumber: string
  message: string
  deviceId?: string
}

export type SendMessageResult = {
  jobId: string
  messageId: string
  waMessageId?: string | null
  status: string
}

// ─── Group Types ──────────────────────────────────────────────────────────

export type GroupStatus = "ACTIVE" | "INACTIVE"
export type GroupType = "STATIC" | "DYNAMIC"

export type ContactGroup = {
  id: string
  organizationId: string
  name: string
  description: string
  type: GroupType
  status: GroupStatus
  throttleMaxMessages?: number | null
  throttlePerMinutes?: number | null
  whatsappDeviceId?: string | null
  createdAt: string
  updatedAt: string
}

export type CreateGroupInput = {
  name: string
  description: string
  type?: GroupType
  status?: GroupStatus
  throttleMaxMessages?: number | null
  throttlePerMinutes?: number | null
  whatsappDeviceId?: string | null
}

export type UpdateGroupInput = Partial<CreateGroupInput>

// ─── Broadcast Types ──────────────────────────────────────────────────────

export type BroadcastStatus =
  | "QUEUED"
  | "PROCESSING"
  | "COMPLETED"
  | "COMPLETED_WITH_ERRORS"

export type BroadcastRecipientStatus = "QUEUED" | "SENT" | "FAILED"

export type BroadcastRecipient = {
  id: string
  phoneNumber: string
  name?: string | null
  dynamicValues?: Record<string, unknown> | null
  status: BroadcastRecipientStatus
  attempts: number
  waMessageId?: string | null
  lastError?: string | null
  createdAt: string
  updatedAt: string
}

export type Broadcast = {
  id: string
  organizationId?: string
  templateName: string
  templateLanguage: string
  templateParams?: Record<string, unknown> | null
  throttleMaxMessages?: number | null
  throttlePerMinutes?: number | null
  status: BroadcastStatus
  total: number
  queued: number
  sent: number
  failed: number
  startedAt?: string | null
  endedAt?: string | null
  whatsappDeviceId?: string | null
  whatsappContactGroupId?: string | null
  recipients?: BroadcastRecipient[]
  recipientCount?: number
  createdAt: string
  updatedAt: string
}

export type CreateBroadcastInput = {
  templateName: string
  templateLanguage: string
  templateParams?: Record<string, unknown> | null
  throttleMaxMessages?: number | null
  throttlePerMinutes?: number | null
  whatsappDeviceId?: string | null
  whatsappContactGroupId?: string | null
  recipients: Array<{
    phoneNumber: string
    name?: string | null
    dynamicValues?: Record<string, unknown> | null
  }>
}

export type UpdateBroadcastInput = Partial<
  Omit<CreateBroadcastInput, "recipients">
>

// ─── Webhook Types ────────────────────────────────────────────────────────

export type Webhook = {
  id: string
  organizationId: string
  name: string
  url: string
  events?: Record<string, unknown> | null
  secret?: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type CreateWebhookInput = {
  name: string
  url: string
  events?: string[]
  secret?: string
}

export type UpdateWebhookInput = Partial<CreateWebhookInput>

// ─── User Types (WhatsApp team users) ─────────────────────────────────────

export type WhatsAppUser = {
  id: string
  workosUserId: string
  email: string
  role: string
  name: string
  organizationId: string
  avatarUrl?: string | null
}

export type CreateWhatsAppUserInput = {
  email: string
  role?: string
}

export type UpdateWhatsAppUserInput = {
  role: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────

const parseJsonSafely = async (response: Response) => {
  try {
    return await response.json()
  } catch {
    return null
  }
}

const toErrorMessage = (payload: unknown, fallback: string) => {
  if (!payload || typeof payload !== "object") {
    return fallback
  }

  if ("message" in payload && typeof payload.message === "string") {
    return payload.message
  }

  return fallback
}

const requestJson = async <T>(
  path: string,
  init?: RequestInit,
  fallbackErrorMessage = "Request failed",
  timeout = 15_000
): Promise<T> => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(path, { ...init, signal: controller.signal })
    const payload = await parseJsonSafely(response)

    if (!response.ok) {
      throw new Error(toErrorMessage(payload, fallbackErrorMessage))
    }

    return payload as T
  } finally {
    clearTimeout(timeoutId)
  }
}

const API_BASE = "/api/whatsapp"

// ─── Factory ──────────────────────────────────────────────────────────────

export const createWhatsAppClient = () => {
  return {
    // ── Devices ────────────────────────────────────────────────────────

    async listDevices() {
      const payload = await requestJson<ApiSuccess<{ devices: Device[] }>>(
        `${API_BASE}/devices`,
        undefined,
        "Unable to load WhatsApp devices."
      )
      return payload.devices
    },

    async getDevice(id: string) {
      const payload = await requestJson<ApiSuccess<{ device: Device }>>(
        `${API_BASE}/devices/${id}`,
        undefined,
        "Unable to load WhatsApp device."
      )
      return payload.device
    },

    async updateDevice(id: string, input: UpdateDeviceInput) {
      const payload = await requestJson<ApiSuccess<{ device: Device }>>(
        `${API_BASE}/devices/${id}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        },
        "Unable to update WhatsApp device."
      )
      return payload.device
    },

    async verifyDevice(id: string) {
      const payload = await requestJson<ApiSuccess<{ device: Device }>>(
        `${API_BASE}/devices/${id}/verify`,
        { method: "POST" },
        "Unable to verify WhatsApp device."
      )
      return payload.device
    },

    async reconnectDevice(id: string) {
      const payload = await requestJson<ApiSuccess<{ device: Device }>>(
        `${API_BASE}/devices/${id}/reconnect`,
        { method: "POST" },
        "Unable to reconnect WhatsApp device."
      )
      return payload.device
    },

    // ── Templates ──────────────────────────────────────────────────────

    async listTemplates() {
      const payload = await requestJson<ApiSuccess<{ templates: Template[] }>>(
        `${API_BASE}/templates`,
        undefined,
        "Unable to load WhatsApp templates."
      )
      return payload.templates
    },

    async getTemplate(id: string) {
      const payload = await requestJson<ApiSuccess<{ template: Template }>>(
        `${API_BASE}/templates/${id}`,
        undefined,
        "Unable to load WhatsApp template."
      )
      return payload.template
    },

    async createTemplate(input: CreateTemplateInput) {
      const payload = await requestJson<ApiSuccess<{ template: Template }>>(
        `${API_BASE}/templates`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        },
        "Unable to create WhatsApp template."
      )
      return payload.template
    },

    async updateTemplate(id: string, input: UpdateTemplateInput) {
      const payload = await requestJson<ApiSuccess<{ template: Template }>>(
        `${API_BASE}/templates/${id}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        },
        "Unable to update WhatsApp template."
      )
      return payload.template
    },

    async deleteTemplate(id: string) {
      await requestJson<ApiSuccess<object>>(
        `${API_BASE}/templates/${id}`,
        { method: "DELETE" },
        "Unable to delete WhatsApp template."
      )
    },

    async syncTemplate(id: string) {
      const payload = await requestJson<ApiSuccess<{ message: string }>>(
        `${API_BASE}/templates/${id}/sync`,
        { method: "POST" },
        "Unable to sync WhatsApp template."
      )
      return payload.message
    },

    // ── Contacts ────────────────────────────────────────────────────────

    async listContacts(params?: {
      contactGroupId?: string
      status?: ContactStatus
      phoneNumber?: string
    }) {
      const searchParams = new URLSearchParams()
      if (params?.contactGroupId)
        searchParams.set("contactGroupId", params.contactGroupId)
      if (params?.status) searchParams.set("status", params.status)
      if (params?.phoneNumber)
        searchParams.set("phoneNumber", params.phoneNumber)
      const qs = searchParams.toString()

      const payload = await requestJson<ApiSuccess<{ contacts: Contact[] }>>(
        `${API_BASE}/contacts${qs ? `?${qs}` : ""}`,
        undefined,
        "Unable to load WhatsApp contacts."
      )
      return payload.contacts
    },

    async getContact(id: string) {
      const payload = await requestJson<ApiSuccess<{ contact: Contact }>>(
        `${API_BASE}/contacts/${id}`,
        undefined,
        "Unable to load WhatsApp contact."
      )
      return payload.contact
    },

    async createContact(input: CreateContactInput) {
      const payload = await requestJson<ApiSuccess<{ contact: Contact }>>(
        `${API_BASE}/contacts`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        },
        "Unable to create WhatsApp contact."
      )
      return payload.contact
    },

    async updateContact(id: string, input: UpdateContactInput) {
      const payload = await requestJson<ApiSuccess<{ contact: Contact }>>(
        `${API_BASE}/contacts/${id}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        },
        "Unable to update WhatsApp contact."
      )
      return payload.contact
    },

    async deleteContact(id: string) {
      await requestJson<ApiSuccess<object>>(
        `${API_BASE}/contacts/${id}`,
        { method: "DELETE" },
        "Unable to delete WhatsApp contact."
      )
    },

    // ── Conversations ───────────────────────────────────────────────────

    async listConversations(params?: { contactPhone?: string }) {
      const searchParams = new URLSearchParams()
      if (params?.contactPhone)
        searchParams.set("contactPhone", params.contactPhone)
      const qs = searchParams.toString()

      const payload = await requestJson<
        ApiSuccess<{ conversations: Conversation[] }>
      >(
        `${API_BASE}/conversations${qs ? `?${qs}` : ""}`,
        undefined,
        "Unable to load WhatsApp conversations."
      )
      return payload.conversations
    },

    async getConversation(id: string) {
      const payload = await requestJson<
        ApiSuccess<{ conversation: Conversation }>
      >(
        `${API_BASE}/conversations/${id}`,
        undefined,
        "Unable to load WhatsApp conversation."
      )
      return payload.conversation
    },

    async createConversation(input: CreateConversationInput) {
      const payload = await requestJson<
        ApiSuccess<{ conversation: Conversation }>
      >(
        `${API_BASE}/conversations`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        },
        "Unable to create WhatsApp conversation."
      )
      return payload.conversation
    },

    // ── Messages ─────────────────────────────────────────────────────────

    async listMessages(params?: {
      conversationId?: string
      direction?: MessageDirection
      messageType?: string
    }) {
      const searchParams = new URLSearchParams()
      if (params?.conversationId)
        searchParams.set("conversationId", params.conversationId)
      if (params?.direction) searchParams.set("direction", params.direction)
      if (params?.messageType)
        searchParams.set("messageType", params.messageType)
      const qs = searchParams.toString()

      const payload = await requestJson<ApiSuccess<{ messages: Message[] }>>(
        `${API_BASE}/messages${qs ? `?${qs}` : ""}`,
        undefined,
        "Unable to load WhatsApp messages."
      )
      return payload.messages
    },

    async getMessage(id: string) {
      const payload = await requestJson<ApiSuccess<{ message: Message }>>(
        `${API_BASE}/messages/${id}`,
        undefined,
        "Unable to load WhatsApp message."
      )
      return payload.message
    },

    async sendMessage(input: SendMessageInput) {
      const payload = await requestJson<ApiSuccess<SendMessageResult>>(
        `${API_BASE}/messages/send`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        },
        "Unable to send WhatsApp message."
      )
      return payload
    },

    // ── Groups ──────────────────────────────────────────────────────────

    async listGroups() {
      const payload = await requestJson<ApiSuccess<{ groups: ContactGroup[] }>>(
        `${API_BASE}/groups`,
        undefined,
        "Unable to load WhatsApp groups."
      )
      return payload.groups
    },

    async getGroup(id: string) {
      const payload = await requestJson<ApiSuccess<{ group: ContactGroup }>>(
        `${API_BASE}/groups/${id}`,
        undefined,
        "Unable to load WhatsApp group."
      )
      return payload.group
    },

    async createGroup(input: CreateGroupInput) {
      const payload = await requestJson<ApiSuccess<{ group: ContactGroup }>>(
        `${API_BASE}/groups`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        },
        "Unable to create WhatsApp group."
      )
      return payload.group
    },

    async updateGroup(id: string, input: UpdateGroupInput) {
      const payload = await requestJson<ApiSuccess<{ group: ContactGroup }>>(
        `${API_BASE}/groups/${id}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        },
        "Unable to update WhatsApp group."
      )
      return payload.group
    },

    async deleteGroup(id: string) {
      await requestJson<ApiSuccess<object>>(
        `${API_BASE}/groups/${id}`,
        { method: "DELETE" },
        "Unable to delete WhatsApp group."
      )
    },

    // ── Broadcasts ──────────────────────────────────────────────────────

    async listBroadcasts() {
      const payload = await requestJson<
        ApiSuccess<{ broadcasts?: Broadcast[]; campaigns?: Broadcast[] }>
      >(
        `${API_BASE}/broadcasts`,
        undefined,
        "Unable to load WhatsApp broadcasts."
      )
      return payload.broadcasts ?? payload.campaigns ?? []
    },

    async getBroadcast(id: string) {
      const payload = await requestJson<
        ApiSuccess<{ broadcast?: Broadcast; campaign?: Broadcast }>
      >(
        `${API_BASE}/broadcasts/${id}`,
        undefined,
        "Unable to load WhatsApp broadcast."
      )
      const broadcast = payload.broadcast ?? payload.campaign
      if (!broadcast) {
        throw new Error("Unable to load WhatsApp broadcast.")
      }
      return broadcast
    },

    async createBroadcast(input: CreateBroadcastInput) {
      const payload = await requestJson<
        ApiSuccess<{ broadcast?: Broadcast; campaign?: Broadcast }>
      >(
        `${API_BASE}/broadcasts`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        },
        "Unable to create WhatsApp broadcast."
      )
      const broadcast = payload.broadcast ?? payload.campaign
      if (!broadcast) {
        throw new Error("Unable to create WhatsApp broadcast.")
      }
      return broadcast
    },

    async updateBroadcast(id: string, input: UpdateBroadcastInput) {
      const payload = await requestJson<
        ApiSuccess<{ broadcast?: Broadcast; campaign?: Broadcast }>
      >(
        `${API_BASE}/broadcasts/${id}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        },
        "Unable to update WhatsApp broadcast."
      )
      const broadcast = payload.broadcast ?? payload.campaign
      if (!broadcast) {
        throw new Error("Unable to update WhatsApp broadcast.")
      }
      return broadcast
    },

    async deleteBroadcast(id: string) {
      await requestJson<ApiSuccess<object>>(
        `${API_BASE}/broadcasts/${id}`,
        { method: "DELETE" },
        "Unable to delete WhatsApp broadcast."
      )
    },

    async sendBroadcast(id: string) {
      const payload = await requestJson<ApiSuccess<{ message: string }>>(
        `${API_BASE}/broadcasts/${id}/send`,
        { method: "POST" },
        "Unable to send WhatsApp broadcast."
      )
      return payload.message
    },

    // ── Webhooks ────────────────────────────────────────────────────────

    async listWebhooks() {
      const payload = await requestJson<ApiSuccess<{ webhooks: Webhook[] }>>(
        `${API_BASE}/webhooks`,
        undefined,
        "Unable to load WhatsApp webhooks."
      )
      return payload.webhooks
    },

    async getWebhook(id: string) {
      const payload = await requestJson<ApiSuccess<{ webhook: Webhook }>>(
        `${API_BASE}/webhooks/${id}`,
        undefined,
        "Unable to load WhatsApp webhook."
      )
      return payload.webhook
    },

    async createWebhook(input: CreateWebhookInput) {
      const payload = await requestJson<ApiSuccess<{ webhook: Webhook }>>(
        `${API_BASE}/webhooks`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        },
        "Unable to create WhatsApp webhook."
      )
      return payload.webhook
    },

    async updateWebhook(id: string, input: UpdateWebhookInput) {
      const payload = await requestJson<ApiSuccess<{ webhook: Webhook }>>(
        `${API_BASE}/webhooks/${id}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        },
        "Unable to update WhatsApp webhook."
      )
      return payload.webhook
    },

    async deleteWebhook(id: string) {
      await requestJson<ApiSuccess<object>>(
        `${API_BASE}/webhooks/${id}`,
        { method: "DELETE" },
        "Unable to delete WhatsApp webhook."
      )
    },

    // ── Users ───────────────────────────────────────────────────────────

    async listWhatsAppUsers() {
      const payload = await requestJson<ApiSuccess<{ users: WhatsAppUser[] }>>(
        `${API_BASE}/users`,
        undefined,
        "Unable to load WhatsApp users."
      )
      return payload.users
    },

    async getWhatsAppUser(id: string) {
      const payload = await requestJson<ApiSuccess<{ user: WhatsAppUser }>>(
        `${API_BASE}/users/${id}`,
        undefined,
        "Unable to load WhatsApp user."
      )
      return payload.user
    },

    async createWhatsAppUser(input: CreateWhatsAppUserInput) {
      const payload = await requestJson<ApiSuccess<{ user: WhatsAppUser }>>(
        `${API_BASE}/users`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        },
        "Unable to invite WhatsApp user."
      )
      return payload.user
    },

    async updateWhatsAppUser(id: string, input: UpdateWhatsAppUserInput) {
      const payload = await requestJson<ApiSuccess<{ user: WhatsAppUser }>>(
        `${API_BASE}/users/${id}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        },
        "Unable to update WhatsApp user."
      )
      return payload.user
    },

    async deleteWhatsAppUser(id: string) {
      await requestJson<ApiSuccess<object>>(
        `${API_BASE}/users/${id}`,
        { method: "DELETE" },
        "Unable to remove WhatsApp user."
      )
    },

    // ── Catalogs ──────────────────────────────────────────────────────────

    async listCatalogs() {
      const payload = await requestJson<ApiSuccess<{ data: Catalog[] }>>(
        `${API_BASE}/catalogs`,
        undefined,
        "Unable to load WhatsApp catalogs."
      )
      return payload.data
    },

    async getCatalog(id: string) {
      const payload = await requestJson<ApiSuccess<{ data: Catalog }>>(
        `${API_BASE}/catalogs/${id}`,
        undefined,
        "Unable to load WhatsApp catalog."
      )
      return payload.data
    },

    async createCatalog(input: CreateCatalogInput) {
      const payload = await requestJson<ApiSuccess<{ data: Catalog }>>(
        `${API_BASE}/catalogs`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        },
        "Unable to create WhatsApp catalog."
      )
      return payload.data
    },

    async updateCatalog(id: string, input: UpdateCatalogInput) {
      const payload = await requestJson<ApiSuccess<{ data: Catalog }>>(
        `${API_BASE}/catalogs/${id}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        },
        "Unable to update WhatsApp catalog."
      )
      return payload.data
    },

    async deleteCatalog(id: string) {
      await requestJson<ApiSuccess<object>>(
        `${API_BASE}/catalogs/${id}`,
        { method: "DELETE" },
        "Unable to delete WhatsApp catalog."
      )
    },

    async syncCatalog(id: string) {
      const payload = await requestJson<ApiSuccess<{ data: { synced: number } }>>(
        `${API_BASE}/catalogs/${id}/sync`,
        { method: "POST" },
        "Unable to sync WhatsApp catalog."
      )
      return payload.data
    },

    async listCatalogProducts(catalogId: string) {
      const payload = await requestJson<ApiSuccess<{ data: CatalogProduct[] }>>(
        `${API_BASE}/catalogs/${catalogId}/products`,
        undefined,
        "Unable to load catalog products."
      )
      return payload.data
    },

    async sendCatalogMessage(input: SendCatalogMessageInput) {
      const payload = await requestJson<ApiSuccess<{ data: { providerMessageId: string } }>>(
        `${API_BASE}/catalogs/send`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        },
        "Unable to send catalog message."
      )
      return payload.data
    },
  }
}

// ─── Catalog Types ────────────────────────────────────────────────────────

export type Catalog = {
  id: string
  organizationId: string
  name: string
  metaCatalogId: string
  deviceId?: string | null
  productCount?: number
  createdAt: string
  updatedAt: string
}

export type CatalogProduct = {
  id: string
  catalogId: string
  productRetailerId: string
  name: string
  description?: string | null
  price?: string | null
  currency?: string | null
  imageUrl?: string | null
  url?: string | null
  createdAt: string
}

export type CreateCatalogInput = {
  name: string
  metaCatalogId: string
  deviceId?: string
}

export type UpdateCatalogInput = {
  name?: string
  metaCatalogId?: string
  deviceId?: string | null
}

export type SendCatalogMessageInput = {
  to: string
  catalogId: string
  type: "product" | "product_list" | "catalog_message"
  productRetailerId?: string
  body?: string
  header?: string
  footer?: string
  sections?: { title: string; productItems: string[] }[]
  thumbnailProductRetailerId?: string
}

// Singleton for convenience
export const whatsappClient = createWhatsAppClient()
