import { WhatsAppDeviceClient } from "@/lib/whatsapp/meta-cloud/device-client"
import { prisma } from "@/lib/prisma"
import { quotaService, InsufficientQuotaError } from "./quota.service"
import { enqueueWhatsAppBroadcast } from "@/lib/queue/whatsapp-broadcast"
import { randomUUID } from "crypto"

export type SendMessageResult = {
  jobId: string
  messageId: string
  waMessageId?: string
  status: "queued" | "sent" | "failed"
  error?: string
}

export type SendMessageOptions = {
  organizationId: string
  phoneNumber: string
  message: string
  deviceId?: string
}

export type MessageService = {
  sendMessage(options: SendMessageOptions): Promise<SendMessageResult>
  getOrCreateConversation(organizationId: string, phoneNumber: string, deviceId?: string): Promise<string>
}

export const messageService: MessageService = {
  async sendMessage({ organizationId, phoneNumber, message, deviceId }) {
    const jobId = `wa-job-${randomUUID()}`

    // Check quota before sending
    const quotaCheck = await quotaService.checkQuota(organizationId, deviceId)

    if (!quotaCheck.hasQuota) {
      throw new InsufficientQuotaError(`Insufficient quota. Remaining: ${quotaCheck.remaining}`)
    }

    // Get or create device
    const device = deviceId
      ? await prisma.whatsappDevice.findFirst({
          where: { id: deviceId, organizationId },
        })
      : await prisma.whatsappDevice.findFirst({
          where: { organizationId },
        })

    if (!device) {
      throw new Error("WhatsApp device not found")
    }

    // Create device client
    const client = await WhatsAppDeviceClient.fromDevice({
      accessToken: device.tokenEncrypted ?? "",
      phoneNumberId: device.whatsappPhoneId ?? "",
      wabaId: device.whatsappBusinessAccountId ?? "",
    })

    // Send message via Meta Cloud API
    let waMessageId: string | undefined
    try {
      const result = await client.sendMessage({
        to: phoneNumber,
        type: "text",
        payload: { text: message },
      })
      waMessageId = result.providerMessageId
    } catch (err) {
      console.error("[messageService] Failed to send via Meta API:", err)
      // Continue to enqueue for retry
    }

    // Deduct quota (atomic transaction)
    try {
      await quotaService.deductQuota(organizationId, deviceId)
    } catch (err) {
      if (err instanceof InsufficientQuotaError) {
        throw err
      }
      // Log but don't fail the send
      console.error("[messageService] Failed to deduct quota:", err)
    }

    // Get or create conversation
    const conversationId = await messageService.getOrCreateConversation(
      organizationId,
      phoneNumber,
      deviceId
    )

    // Create message record
    const whatsappMessage = await prisma.whatsappMessage.create({
      data: {
        conversationId,
        direction: "OUTBOX",
        messageType: "text",
        body: message,
        waMessageId,
        metadata: { jobId },
      },
    })

    // Create broadcast recipient for async processing
    const campaign = await prisma.whatsappBroadcastCampaign.create({
      data: {
        organizationId,
        templateName: "direct_message",
        templateLanguage: "en",
        status: waMessageId ? "COMPLETED" : "QUEUED",
        total: 1,
        queued: waMessageId ? 0 : 1,
        sent: waMessageId ? 1 : 0,
        whatsappDeviceId: deviceId,
      },
    })

    await prisma.whatsappBroadcastRecipient.create({
      data: {
        broadcastId: campaign.id,
        phoneNumber,
        status: waMessageId ? "SENT" : "QUEUED",
        waMessageId,
      },
    })

    // Enqueue broadcast job for async processing
    await enqueueWhatsAppBroadcast(campaign.id, "", "dispatch")

    return {
      jobId,
      messageId: whatsappMessage.id,
      waMessageId,
      status: waMessageId ? "sent" : "queued",
    }
  },

  async getOrCreateConversation(organizationId: string, phoneNumber: string, deviceId?: string) {
    let conversation = await prisma.whatsappConversation.findFirst({
      where: {
        organizationId,
        contactPhone: phoneNumber,
      },
    })

    if (!conversation) {
      conversation = await prisma.whatsappConversation.create({
        data: {
          organizationId,
          contactPhone: phoneNumber,
          lastDirection: "OUTBOX",
          lastMessageAt: new Date(),
          whatsappDeviceId: deviceId,
        },
      })
    }

    return conversation.id
  },
}