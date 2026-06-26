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
} from "./types"
import { decryptWhatsAppToken } from "../crypto"

export class WhatsAppDeviceClient {
  private readonly httpClient: MetaCloudHttpClient
  private readonly phoneNumberId: string
  private readonly wabaId: string
  private readonly organizationId?: string

  constructor(options: {
    accessToken: string
    phoneNumberId: string
    wabaId: string
    organizationId?: string
    timeoutMs?: number
  }) {
    this.phoneNumberId = options.phoneNumberId
    this.wabaId = options.wabaId
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
    organizationId?: string
  }) {
    const token = await decryptWhatsAppToken(device.accessToken)
    return new WhatsAppDeviceClient({
      accessToken: token,
      phoneNumberId: device.phoneNumberId,
      wabaId: device.wabaId,
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
      providerMessageId: result.messages[0].id,
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
      providerMessageId: result.messages[0].id,
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
      providerMessageId: result.messages[0].id,
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

  async uploadProfilePicture(
    file: { data: ArrayBuffer; mimeType: string; fileName: string }
  ): Promise<{ handle: string }> {
    // ponytail: Resumable Upload — single-session for files <16MB.
    // Meta's Resumable Upload API uses a 3-step flow for large files
    // but for profile pictures (typically <5MB) single part upload works.
    const uploadEndpoint = ENDPOINTS.BUSINESS_PROFILE(this.phoneNumberId).replace(
      "/whatsapp_business_profile",
      "/uploads"
    )

    const formData = new FormData()
    formData.append("file_length", String(file.data.byteLength))
    formData.append("file_type", file.mimeType)
    formData.append("file_name", file.fileName)
    formData.append("messaging_product", "whatsapp")

    const session = await this.httpClient.request<{ id: string }>(
      "CREATE_UPLOAD_SESSION",
      uploadEndpoint,
      "POST",
      formData
    )

    // Append file data to the session
    const blob = new Blob([file.data], { type: file.mimeType })
    const appendForm = new FormData()
    appendForm.append("file", blob, file.fileName)
    appendForm.append("messaging_product", "whatsapp")

    const result = await this.httpClient.request<{ handle: string }>(
      "UPLOAD_FILE_PART",
      `${uploadEndpoint}/${session.id}`,
      "POST",
      appendForm
    )

    return { handle: result.handle }
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
      providerMessageId: result.messages[0].id,
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
      providerMessageId: result.messages[0].id,
      accepted: true,
    }
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
      providerMessageId: result.messages[0].id,
      accepted: true,
    }
  }
}
