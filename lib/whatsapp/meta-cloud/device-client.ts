import { MetaCloudHttpClient } from "./client"
import { ENDPOINTS } from "./endpoints"
import {
  SendMessageInput,
  SendMessageResult,
  SendTemplateMessageInput,
  SendTemplateMessageResult,
  SendReplyInput,
  UploadMediaInput,
  UploadMediaResult,
  PhoneNumberInfo,
  CreateMetaTemplateInput,
  CreateMetaTemplateResult,
} from "./types"
import type { MediaMetadata, DeleteMediaResult } from "./types/media"
import { decryptWhatsAppToken } from "../crypto"
import type {
  AnalyticsQueryParams,
  AnalyticsResponse,
  AnalyticsResult,
  AnalyticsDataItem,
} from "./types/analytics"

function getProviderMessageId(result: unknown): string {
  const messageId = (result as { messages?: Array<{ id?: unknown }> })
    ?.messages?.[0]?.id

  if (typeof messageId !== "string" || messageId.length === 0) {
    throw new Error("Meta Cloud API returned no message ID")
  }

  return messageId
}

export class WhatsAppDeviceClient {
  private readonly httpClient: MetaCloudHttpClient
  private readonly phoneNumberId: string
  private readonly wabaId: string
  private readonly metaAppId?: string
  private readonly organizationId?: string

  constructor(options: {
    accessToken: string
    phoneNumberId: string
    wabaId: string
    metaAppId?: string
    organizationId?: string
    timeoutMs?: number
  }) {
    this.phoneNumberId = options.phoneNumberId
    this.wabaId = options.wabaId
    this.metaAppId = options.metaAppId
    this.organizationId = options.organizationId
    this.httpClient = new MetaCloudHttpClient({
      accessToken: options.accessToken,
      timeoutMs: options.timeoutMs,
      phoneNumberId: this.phoneNumberId,
      organizationId: this.organizationId,
    })
  }

  static async fromDevice(device: {
    accessToken: string
    phoneNumberId: string
    wabaId: string
    metaAppId?: string
    organizationId?: string
  }) {
    const token = await decryptWhatsAppToken(device.accessToken)
    return new WhatsAppDeviceClient({
      accessToken: token,
      phoneNumberId: device.phoneNumberId,
      wabaId: device.wabaId,
      metaAppId: device.metaAppId,
      organizationId: device.organizationId,
    })
  }

  async sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
    const payload = {
      messaging_product: "whatsapp",
      to: input.to,
      type: input.type,
      [input.type]: input.payload,
    }

    const result = await this.httpClient.request<any>(
      "SEND_MESSAGE",
      ENDPOINTS.MESSAGES(this.phoneNumberId),
      "POST",
      payload
    )

    return {
      providerMessageId: getProviderMessageId(result),
      accepted: true,
    }
  }

  async sendTemplateMessage(
    input: SendTemplateMessageInput
  ): Promise<SendTemplateMessageResult> {
    const components: any[] = []

    if (input.header) {
      components.push({
        type: "header",
        parameters: [
          input.header.type === "image" || input.header.type === "video"
            ? {
                type: input.header.type,
                [input.header.type]: {
                  id: input.header.id,
                  link: input.header.url,
                },
              }
            : {
                type: "document",
                document: {
                  id: input.header.id,
                  link: input.header.url,
                  filename: (input.header as any).filename,
                },
              },
        ],
      })
    }

    if (input.fields && input.fields.length > 0) {
      components.push({
        type: "body",
        parameters: input.fields.map((text) => ({ type: "text", text })),
      })
    }

    const payload = {
      messaging_product: "whatsapp",
      to: input.to,
      type: "template",
      template: {
        name: input.templateName,
        language: { code: input.templateLanguage },
        components,
      },
    }

    const result = await this.httpClient.request<any>(
      "SEND_TEMPLATE",
      ENDPOINTS.MESSAGES(this.phoneNumberId),
      "POST",
      payload
    )

    return {
      providerMessageId: getProviderMessageId(result),
      accepted: true,
    }
  }

  async sendReply(input: SendReplyInput): Promise<SendMessageResult> {
    const payload: any = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: input.to,
      type: input.type,
      [input.type]:
        input.type === "text" ? { body: input.payload.body } : input.payload,
    }

    const result = await this.httpClient.request<any>(
      "SEND_REPLY",
      ENDPOINTS.MESSAGES(this.phoneNumberId),
      "POST",
      payload
    )

    return {
      providerMessageId: getProviderMessageId(result),
      accepted: true,
    }
  }

  async uploadMedia(input: UploadMediaInput): Promise<UploadMediaResult> {
    const formData = new FormData()
    formData.append("messaging_product", "whatsapp")
    formData.append("type", input.type || "image")

    const blob = new Blob([input.data], { type: input.mimeType })
    formData.append("file", blob, input.fileName)

    const result = await this.httpClient.request<any>(
      "UPLOAD_MEDIA",
      ENDPOINTS.MEDIA(this.phoneNumberId),
      "POST",
      formData
    )

    return {
      mediaId: result.id,
    }
  }

  async completeUploadMedia(
    file: ArrayBuffer,
    fileName: string,
    mimeType: string
  ): Promise<{ mediaId: string }> {
    const formData = new FormData()
    formData.append("messaging_product", "whatsapp")
    const blob = new Blob([file], { type: mimeType })
    formData.append("file", blob, fileName)

    const result = await this.httpClient.request<any>(
      "UPLOAD_MEDIA",
      ENDPOINTS.MEDIA(this.phoneNumberId),
      "POST",
      formData
    )

    return { mediaId: result.id }
  }

  async getMedia(mediaId: string): Promise<MediaMetadata> {
    return this.httpClient.request<MediaMetadata>(
      "GET_MEDIA",
      ENDPOINTS.MEDIA_BY_ID(mediaId),
      "GET"
    )
  }

  async downloadMedia(mediaId: string): Promise<ArrayBuffer> {
    const endpoint = ENDPOINTS.MEDIA_BY_ID(mediaId)
    const token = this.httpClient.getAccessToken()
    const response = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      redirect: "follow",
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(
        errorData.error?.message ||
          `Download failed with status ${response.status}`
      )
    }

    return response.arrayBuffer()
  }

  async deleteMedia(mediaId: string): Promise<DeleteMediaResult> {
    return this.httpClient.request<DeleteMediaResult>(
      "DELETE_MEDIA",
      ENDPOINTS.MEDIA_BY_ID(mediaId),
      "DELETE"
    )
  }

  async getPhoneInfo(): Promise<PhoneNumberInfo> {
    return this.httpClient.request<PhoneNumberInfo>(
      "PHONE_INFO",
      ENDPOINTS.PHONE_INFO(this.phoneNumberId),
      "GET"
    )
  }

  async markMessageAsRead(messageId: string): Promise<{ success: boolean }> {
    await this.httpClient.request(
      "MARK_READ",
      ENDPOINTS.MESSAGES(this.phoneNumberId),
      "POST",
      {
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId,
      }
    )
    return { success: true }
  }

  async listTemplates(): Promise<any> {
    return this.listTemplatesPage()
  }
  async createTemplate(
    input: CreateMetaTemplateInput
  ): Promise<CreateMetaTemplateResult> {
    const endpoint = ENDPOINTS.TEMPLATES(this.wabaId)
    const payload: Record<string, unknown> = {
      name: input.name,
      category: input.category,
      language: input.language,
      components: input.components,
    }

    if (
      typeof input.message_send_ttl_seconds === "number" &&
      input.message_send_ttl_seconds >= 60 &&
      input.message_send_ttl_seconds <= 900
    ) {
      payload.message_send_ttl_seconds = input.message_send_ttl_seconds
    }

    return this.httpClient.request<CreateMetaTemplateResult>(
      "CREATE_TEMPLATE",
      endpoint,
      "POST",
      payload
    )
  }

  async listTemplatesPage(after?: string): Promise<any> {
    const endpoint = new URL(ENDPOINTS.TEMPLATES(this.wabaId))
    endpoint.searchParams.set(
      "fields",
      "name,language,status,category,components,rejected_reason"
    )
    endpoint.searchParams.set("limit", "100")

    if (after) {
      endpoint.searchParams.set("after", after)
    }

    return this.httpClient.request("LIST_TEMPLATES", endpoint.toString(), "GET")
  }

  async refreshToken(): Promise<void> {
    // Stub as requested
    return
  }

  // ─── Business Profile ────────────────────────────────────────────────────────────

  async getBusinessProfile(
    fields?: string[]
  ): Promise<Record<string, unknown> | null> {
    const endpoint = new URL(ENDPOINTS.BUSINESS_PROFILE(this.phoneNumberId))
    endpoint.searchParams.set(
      "fields",
      fields?.join(",") ??
        "messaging_product,about,address,description,email,profile_picture_url,websites,vertical"
    )

    const result = await this.httpClient.request<{
      data: Array<{ business_profile: Record<string, unknown> }>
    }>("GET_BUSINESS_PROFILE", endpoint.toString(), "GET")

    // ponytail: Meta returns empty data[] when no profile exists
    if (!result.data?.[0]?.business_profile) return null
    return result.data[0].business_profile
  }

  async updateBusinessProfile(
    data: Record<string, unknown>
  ): Promise<{ success: boolean }> {
    return this.httpClient.request<{ success: boolean }>(
      "UPDATE_BUSINESS_PROFILE",
      ENDPOINTS.BUSINESS_PROFILE(this.phoneNumberId),
      "POST",
      data
    )
  }

  async createResumableUpload(file: {
    data: ArrayBuffer
    mimeType: string
    fileName: string
  }): Promise<{ handle: string }> {
    if (!this.metaAppId) {
      throw new Error("Meta app ID is required for resumable upload")
    }

    const uploadEndpoint = new URL(ENDPOINTS.UPLOAD_SESSION(this.metaAppId))
    uploadEndpoint.searchParams.set("file_name", file.fileName)
    uploadEndpoint.searchParams.set("file_length", String(file.data.byteLength))
    uploadEndpoint.searchParams.set("file_type", file.mimeType)

    const session = await this.httpClient.request<{ id: string }>(
      "CREATE_UPLOAD_SESSION",
      uploadEndpoint.toString(),
      "POST"
    )

    const blob = new Blob([file.data], { type: file.mimeType })

    const result = await this.httpClient.request<{
      h?: string
      handle?: string
    }>(
      "UPLOAD_FILE_PART",
      ENDPOINTS.UPLOAD_SESSION_PART(session.id),
      "POST",
      blob,
      3,
      {
        "Content-Type": file.mimeType,
        file_offset: "0",
      }
    )

    const handle = result.h ?? result.handle
    if (!handle) {
      throw new Error("Meta Cloud API returned no media handle")
    }
    return { handle }
  }

  async uploadProfilePicture(file: {
    data: ArrayBuffer
    mimeType: string
    fileName: string
  }): Promise<{ handle: string }> {
    return this.createResumableUpload(file)
  }

  async sendSingleProduct(
    to: string,
    catalogId: string,
    productRetailerId: string,
    body?: { text: string }
  ): Promise<SendMessageResult> {
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "interactive",
      interactive: {
        type: "product",
        ...(body?.text ? { body: { text: body.text } } : {}),
        action: {
          catalog_id: catalogId,
          product_retailer_id: productRetailerId,
        },
      },
    }

    const result = await this.httpClient.request<any>(
      "SEND_CATALOG_PRODUCT",
      ENDPOINTS.MESSAGES(this.phoneNumberId),
      "POST",
      payload
    )

    return {
      providerMessageId: getProviderMessageId(result),
      accepted: true,
    }
  }

  async sendMultiProductList(
    to: string,
    catalogId: string,
    sections: { title: string; productItems: string[] }[],
    header?: { text: string },
    body?: { text: string },
    footer?: { text: string }
  ): Promise<SendMessageResult> {
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "interactive",
      interactive: {
        type: "product_list",
        header: { type: "text" as const, text: header?.text ?? "" },
        body: { text: body?.text ?? "" },
        ...(footer?.text ? { footer: { text: footer.text } } : {}),
        action: {
          catalog_id: catalogId,
          sections: sections.map((s) => ({
            title: s.title,
            product_items: s.productItems.map((id) => ({
              product_retailer_id: id,
            })),
          })),
        },
      },
    }

    const result = await this.httpClient.request<any>(
      "SEND_CATALOG_PRODUCT_LIST",
      ENDPOINTS.MESSAGES(this.phoneNumberId),
      "POST",
      payload
    )

    return {
      providerMessageId: getProviderMessageId(result),
      accepted: true,
    }
  }

  /**
   * Query the WhatsApp Analytics API for a WABA.
   * Handles cursor-based pagination internally, capped at 10 pages.
   * ponytail: 10-page cap, raise if reports cover >90d at DAY granularity.
   */
  async getAnalytics<T = AnalyticsDataItem>(
    params: AnalyticsQueryParams
  ): Promise<AnalyticsResult<T>> {
    const endpoint = new URL(ENDPOINTS.ANALYTICS(this.wabaId))
    endpoint.searchParams.set("start", String(params.start))
    endpoint.searchParams.set("end", String(params.end))
    endpoint.searchParams.set("granularity", params.granularity)

    if (params.metric_types) {
      endpoint.searchParams.set("metric_types", params.metric_types)
    }
    if (params.phone_numbers?.length) {
      endpoint.searchParams.set("phone_numbers", params.phone_numbers.join(","))
    }

    const allData: T[] = []
    let nextCursor: string | undefined
    let pageCount = 0
    const MAX_PAGES = 10

    do {
      if (nextCursor) {
        endpoint.searchParams.set("after", nextCursor)
      }
      const response = await this.httpClient.request<AnalyticsResponse<T>>(
        "GET_ANALYTICS",
        endpoint.toString(),
        "GET"
      )
      allData.push(...response.data)
      nextCursor = response.paging?.next
        ? response.paging.cursors?.after
        : undefined
      pageCount++
    } while (nextCursor && pageCount < MAX_PAGES)

    return { data: allData, totalPages: pageCount }
  }

  async sendCatalogMessage(
    to: string,
    catalogId: string,
    thumbnailProductRetailerId?: string,
    body?: { text: string }
  ): Promise<SendMessageResult> {
    const payload: Record<string, unknown> = {
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "catalog_message",
        body: { text: body?.text ?? "Browse our catalog:" },
        action: {
          catalog_id: catalogId,
          name: "catalog_message",
          ...(thumbnailProductRetailerId
            ? {
                parameters: {
                  thumbnail_product_retailer_id: thumbnailProductRetailerId,
                },
              }
            : {}),
        },
      },
    }

    const result = await this.httpClient.request<any>(
      "SEND_CATALOG_MESSAGE",
      ENDPOINTS.MESSAGES(this.phoneNumberId),
      "POST",
      payload
    )

    return {
      providerMessageId: getProviderMessageId(result),
      accepted: true,
    }
  }
}
