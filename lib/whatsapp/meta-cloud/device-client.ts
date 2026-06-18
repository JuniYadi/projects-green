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
  PhoneNumberInfo
} from "./types"
import { decryptWhatsAppToken } from "../crypto"

export class WhatsAppDeviceClient {
  private readonly httpClient: MetaCloudHttpClient
  private readonly phoneNumberId: string // Marked as readonly here.
  private readonly wabaId: string

  constructor(options: {
    accessToken: string
    phoneNumberId: string
    wabaId: string
    timeoutMs?: number
  }) {
    this.phoneNumberId = options.phoneNumberId // Initialize here
    this.httpClient = new MetaCloudHttpClient({
      accessToken: options.accessToken,
      timeoutMs: options.timeoutMs,
      phoneNumberId: this.phoneNumberId,
    })
    this.wabaId = options.wabaId
  }

  static async fromDevice(device: {
    accessToken: string
    phoneNumberId: string
    wabaId: string
  }) {
    const token = await decryptWhatsAppToken(device.accessToken)
    return new WhatsAppDeviceClient({
      accessToken: token,
      phoneNumberId: device.phoneNumberId,
      wabaId: device.wabaId
    })
  }

  async sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
    const payload = {
      messaging_product: "whatsapp",
      to: input.to,
      type: input.type,
      [input.type]: input.payload
    }
    
    const result = await this.httpClient.request<any>(
      "SEND_MESSAGE",
      ENDPOINTS.MESSAGES(this.phoneNumberId),
      "POST",
      payload
    )

    return {
      providerMessageId: result.messages[0].id,
      accepted: true
    }
  }

  async sendTemplateMessage(input: SendTemplateMessageInput): Promise<SendTemplateMessageResult> {
    const components: any[] = []
    
    if (input.header) {
      components.push({
        type: "header",
        parameters: [
          input.header.type === "image" || input.header.type === "video" 
            ? { type: input.header.type, [input.header.type]: { id: input.header.id, link: input.header.url } }
            : { type: "document", document: { id: input.header.id, link: input.header.url, filename: (input.header as any).filename } }
        ]
      })
    }

    if (input.fields && input.fields.length > 0) {
      components.push({
        type: "body",
        parameters: input.fields.map(text => ({ type: "text", text }))
      })
    }

    const payload = {
      messaging_product: "whatsapp",
      to: input.to,
      type: "template",
      template: {
        name: input.templateName,
        language: { code: input.templateLanguage },
        components
      }
    }

    const result = await this.httpClient.request<any>(
      "SEND_TEMPLATE",
      ENDPOINTS.MESSAGES(this.phoneNumberId),
      "POST",
      payload
    )

    return {
      providerMessageId: result.messages[0].id,
      accepted: true
    }
  }

  async sendReply(input: SendReplyInput): Promise<SendMessageResult> {
    const payload: any = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: input.to,
      type: input.type,
      [input.type]: input.type === "text" ? { body: input.payload.body } : input.payload
    }

    const result = await this.httpClient.request<any>(
      "SEND_REPLY",
      ENDPOINTS.MESSAGES(this.phoneNumberId),
      "POST",
      payload
    )

    return {
      providerMessageId: result.messages[0].id,
      accepted: true
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
      mediaId: result.id
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
        message_id: messageId
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

    return this.httpClient.request(
      "LIST_TEMPLATES",
      endpoint.toString(),
      "GET"
    )
  }

  async refreshToken(): Promise<void> {
    // Stub as requested
    return
  }
}
