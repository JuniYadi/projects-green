import { WhatsAppDeviceClient } from "@/lib/whatsapp/meta-cloud/device-client"
import { prisma } from "@/lib/prisma"
import { quotaService, InsufficientQuotaError } from "./quota.service"
import { enqueueWhatsAppBroadcast } from "@/lib/queue/whatsapp-broadcast"
import { enqueueQuotaReconciliation } from "@/lib/queue/quota-reconciliation"
import { randomUUID } from "crypto"
import { Prisma } from "@prisma/client"
import Decimal = Prisma.Decimal
import { BalanceGateService } from "@/modules/billing/balance-gate.service"
import { QuotaGateService } from "@/modules/billing/quota-gate.service"
import { UsageLedgerService } from "@/modules/billing/usage-ledger.service"
import { MessageCostService } from "@/modules/billing/message-cost.service"
import { USAGE_CATEGORY_WHATSAPP_OUT } from "@/modules/billing/constants"
import { WhatsappBillingService } from "@/modules/whatsapp/billing/whatsapp-billing.service"
import { BillingTransactionService } from "@/modules/billing/billing-transaction.service"
import {
  InsufficientBalanceError,
  QuotaExceededError,
  DailyLimitExceededError,
} from "@/modules/billing/types"

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

    // Get or create device first (needed for quota gate checks)
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

    // Initialize billing services
    const balanceGate = new BalanceGateService(prisma)
    const quotaGate = new QuotaGateService(prisma)
    const usageLedger = new UsageLedgerService(prisma)
    const messageCostService = new MessageCostService(prisma)
    const whatsappBilling = new WhatsappBillingService(prisma, new BillingTransactionService(prisma))

    // 1. Check WhatsApp allowance or charge overage BEFORE Meta API call
    const unitPrice = await messageCostService.estimateMessageCost({
      organizationId,
      messageType: "text",
      deviceId,
    })

    try {
      await whatsappBilling.consumeAllowanceOrChargeOverage({
        organizationId,
        deviceId: device.id,
        messageCount: 1,
        unitPrice,
        idempotencyKey: `wa-message:${jobId}`,
      })
    } catch (err) {
      if (err instanceof Error && err.message === "INSUFFICIENT_BALANCE") {
        throw new InsufficientBalanceError(unitPrice, new Prisma.Decimal(0))
      }
      throw err
    }

    // 2. Check quota (QuotaGateService) — for outbound messages
    let quotaCheckResult
    try {
      quotaCheckResult = await quotaGate.checkMessageQuota(
        organizationId,
        device.id,
        "OUT"
      )
    } catch (error) {
      // DeviceNotFoundError or OrganizationNotMappedError — allow send
      // These errors indicate no subscription so no quota limits apply
      quotaCheckResult = null
    }

    if (quotaCheckResult && !quotaCheckResult.allowed) {
      throw new QuotaExceededError(
        organizationId,
        device.id,
        "OUT",
        quotaCheckResult.monthlyLimit ?? 0,
        quotaCheckResult.monthlyUsed
      )
    }

    // 3. Find active WhatsApp subscription for usage recording
    const subscription = await prisma.subscription.findFirst({
      where: {
        organizationId,
        package: { code: "WHATSAPP" },
        status: "ACTIVE",
      },
    })

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

    // 4. Deduct quota (QuotaGateService) — atomic check-then-increment
    let quotaPending = false
    if (subscription) {
      try {
        await quotaGate.deductMessageQuota(organizationId, device.id, "OUT")
      } catch (error) {
        // QuotaExceededError or DailyLimitExceededError
        // Message already sent, enqueue reconciliation job for async repair
        quotaPending = true
        console.error("[messageService] Quota deduction failed, enqueuing reconciliation:", error)

        // Fire-and-forget: enqueue reconciliation job
        enqueueQuotaReconciliation(
          organizationId,
          device.id,
          "OUT",
          jobId,
          new Date()
        ).catch((err) => {
          console.error("[messageService] Failed to enqueue quota reconciliation:", err)
        })
      }

      // 5. Record usage in ledger
      if (waMessageId) {
        // Find PAYG pricing for message rate
        let messageRateIdr = new Decimal(0)
        try {
          const pricing = await balanceGate.findPricing({
            planId: subscription.planId,
            regionId: "GLOBAL",
            type: "PAYG",
            billingMode: "PAYG",
          })
          messageRateIdr = pricing.unitRateMessage ?? new Decimal(0)
        } catch {
          // No PAYG pricing found — rate is 0
        }

        const now = new Date()
        const period = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`

        await usageLedger.recordUsage({
          organizationId,
          subscriptionId: subscription.id,
          period,
          entry: {
            category: USAGE_CATEGORY_WHATSAPP_OUT,
            amountIdr: messageRateIdr,
            metadata: {
              messageId: jobId,
              direction: "OUT",
              organizationId,
              deviceId: device.id,
            },
          },
        })
      }

      // NOTE: Balance deduction is handled upfront by
      // WhatsappBillingService.consumeAllowanceOrChargeOverage.
      // No separate deduction needed here.
    }

    // Legacy quota service — deduct from old quota table
    // Keep for backward compatibility with devices using old quota system
    try {
      await quotaService.deductQuota(organizationId, deviceId)
    } catch (err) {
      if (err instanceof InsufficientQuotaError) {
        throw err
      }
      console.error("[messageService] Failed to deduct legacy quota:", err)
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
        metadata: { jobId, quotaPending },
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