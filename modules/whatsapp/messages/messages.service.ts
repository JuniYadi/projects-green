import { WhatsAppDeviceClient } from "@/lib/whatsapp/meta-cloud/device-client"
import { prisma } from "@/lib/prisma"
import { quotaService, InsufficientQuotaError } from "./quota.service"
import { enqueueQuotaReconciliation } from "@/lib/queue/quota-reconciliation"
import { randomUUID } from "crypto"
import { Prisma } from "@prisma/client"
import Decimal = Prisma.Decimal

import { webhookDispatcher } from "@/modules/whatsapp/webhooks/webhook-dispatcher.service"

import { BalanceGateService } from "@/modules/billing/balance-gate.service"
import { QuotaGateService } from "@/modules/billing/quota-gate.service"
import { UsageLedgerService } from "@/modules/billing/usage-ledger.service"
import { MessageCostService } from "@/modules/billing/message-cost.service"
import { USAGE_CATEGORY_WHATSAPP_OUT } from "@/modules/billing/constants"
import {
  WhatsappBillingService,
  type WhatsappBillingDecision,
} from "@/modules/whatsapp/billing/whatsapp-billing.service"
import { BillingTransactionService } from "@/modules/billing/billing-transaction.service"
import {
  InsufficientBalanceError,
  QuotaExceededError,
} from "@/modules/billing/types"
import { quotaAlertService } from "./quota-alert.service"

export type SendMessageResult = {
  jobId: string
  messageId: string
  waMessageId?: string
  status: "queued" | "sent" | "failed"
  error?: string
}

export type SendMessageType =
  | "text"
  | "image"
  | "document"
  | "audio"
  | "video"
  | "location"
  | "interactive"

export type SendMessageOptions = {
  organizationId: string
  phoneNumber: string
  type?: SendMessageType
  message?: string
  mediaUrl?: string
  caption?: string
  filename?: string
  latitude?: number
  longitude?: number
  name?: string
  address?: string
  deviceId?: string
  // ponytail: used when type="interactive" — direct payload for sendMessage client
  interactivePayload?: Record<string, unknown>
}

export type MessageService = {
  sendMessage(options: SendMessageOptions): Promise<SendMessageResult>
  getOrCreateConversation(
    organizationId: string,
    phoneNumber: string,
    deviceId?: string
  ): Promise<string>
}

export const messageService: MessageService = {
  async sendMessage(options) {
    const {
      organizationId,
      phoneNumber,
      deviceId,
      type = "text",
      message,
      mediaUrl,
      caption,
      filename,
      latitude,
      longitude,
      name,
      address,
      interactivePayload,
    } = options
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
    const whatsappBilling = new WhatsappBillingService(
      prisma,
      new BillingTransactionService(prisma)
    )

    // 1. Check WhatsApp allowance or charge overage BEFORE Meta API call
    const unitPrice = await messageCostService.estimateMessageCost({
      organizationId,
      messageType: "text",
      deviceId,
    })

    // Calculate message count (1 for single text messages)
    const messageCount = 1

    // idempotencyKey includes retry context so broadcast retries generate unique keys
    const idempotencyKey = `wa-message:${jobId}:attempt-0`

    // Track billing decision to enable compensation on Meta API failure
    let billingDecision: WhatsappBillingDecision | null = null

    try {
      billingDecision = await whatsappBilling.consumeAllowanceOrChargeOverage({
        organizationId,
        deviceId: device.id,
        messageCount,
        unitPrice,
        idempotencyKey,
      })
    } catch (err) {
      if (err instanceof Error && err.message === "INSUFFICIENT_BALANCE") {
        throw new InsufficientBalanceError(unitPrice, new Prisma.Decimal(0))
      }
      console.error("[messageService] Billing check failed:", err)
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
    const subscription = await prisma.serviceSubscription.findFirst({
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
      organizationId,
    })

    // Send message via Meta Cloud API
    let waMessageId: string | undefined
    try {
      const result =
        type === "text"
          ? await client.sendMessage({
              to: phoneNumber,
              type: "text",
              payload: { text: message ?? "" },
            })
          : type === "location"
            ? await client.sendMessage({
                to: phoneNumber,
                type: "location",
                payload: {
                  latitude: latitude ?? 0,
                  longitude: longitude ?? 0,
                  name,
                  address,
                },
              })
            : type === "document"
              ? await client.sendMessage({
                  to: phoneNumber,
                  type: "document",
                  payload: { link: mediaUrl ?? "", caption, filename },
                })
              : type === "audio"
                ? await client.sendMessage({
                    to: phoneNumber,
                    type: "audio",
                    payload: { link: mediaUrl ?? "" },
                  })
                : type === "interactive"
                  ? await client.sendMessage({
                      to: phoneNumber,
                      type: "interactive",
                      payload: (interactivePayload ?? {}) as any,
                    })
                  : await client.sendMessage({
                    to: phoneNumber,
                    type,
                    payload: { link: mediaUrl ?? "", caption },
                  })
      waMessageId = result.providerMessageId
    } catch (err) {
      console.error("[messageService] Failed to send via Meta API:", err)
      // Compensate: restore allowance if it was consumed
      if (billingDecision?.kind === "ALLOWANCE") {
        whatsappBilling
          .restoreAllowance(device.id, messageCount)
          .catch((restoreErr) => {
            console.error(
              "[messageService] Failed to restore allowance:",
              restoreErr
            )
          })
      } else if (billingDecision?.kind === "OVERAGE_CHARGED") {
        console.warn(
          "[messageService] Overage charged but Meta API failed. Balance not auto-refunded.",
          { adjustmentId: billingDecision.adjustmentId, jobId }
        )
      }
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
        console.error(
          "[messageService] Quota deduction failed, enqueuing reconciliation:",
          error
        )

        // Fire-and-forget: enqueue reconciliation job
        enqueueQuotaReconciliation(
          organizationId,
          device.id,
          "OUT",
          jobId,
          new Date()
        ).catch((err) => {
          console.error(
            "[messageService] Failed to enqueue quota reconciliation:",
            err
          )
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

        // Increment daily + monthly outbound counters
        const today = new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
        )
        const year = now.getUTCFullYear()
        const month = now.getUTCMonth() + 1

        const [, , , updatedDevice] = await Promise.all([
          prisma.whatsappDailyCount.upsert({
            where: {
              organizationId_date_whatsappDeviceId: {
                organizationId,
                date: today,
                whatsappDeviceId: device.id,
              },
            },
            update: { messageOutboxCount: { increment: 1 } },
            create: {
              organizationId,
              date: today,
              whatsappDeviceId: device.id,
              messageOutboxCount: 1,
            },
          }),
          prisma.whatsappMonthlyCount.upsert({
            where: {
              organizationId_year_month_whatsappDeviceId: {
                organizationId,
                year,
                month,
                whatsappDeviceId: device.id,
              },
            },
            update: { messageOutboxCount: { increment: 1 } },
            create: {
              organizationId,
              year,
              month,
              whatsappDeviceId: device.id,
              messageOutboxCount: 1,
            },
          }),
          // Record per-message billing entry in WhatsApp Billing Ledger
          prisma.whatsappBillingLedger.create({
            data: {
              organizationId,
              waMessageId,
              phoneNumber,
              category: "SERVICE",
              quotaKey: device.id,
              quotaValue: messageRateIdr,
              whatsappDeviceId: device.id,
            },
          }),
          prisma.whatsappDevice.update({
            where: { id: device.id },
            data: { currentQuotaUsed: { increment: messageRateIdr } },
            select: { currentQuotaUsed: true },
          }),
        ])

        // Check quota alerts after successful message send
        // ponytail: fire-and-forget — alert failures shouldn't block message delivery
        const currentCost = Number(updatedDevice.currentQuotaUsed)
        const quotaBase = Number(device.quotaBase)
        const quotaPercent = quotaBase > 0 ? (currentCost / quotaBase) * 100 : 0

        quotaAlertService
          .checkAndSendAlerts(
            organizationId,
            device.id,
            quotaPercent,
            currentCost,
            quotaBase
          )
          .catch((err) => console.error("[messageService] Quota alert failed:", err))
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
        messageType: type,
        body: type === "text" ? message : caption,
        mediaUrl,
        waMessageId,
        metadata: { jobId, quotaPending },
      },
    })

    // Fire-and-forget: dispatch webhook for sent message
    if (waMessageId) {
      webhookDispatcher
        .dispatchForDevice(
          device.id,
          "message_sent",
          { message: whatsappMessage, recipient: phoneNumber },
          whatsappMessage.id
        )
        .catch((err: unknown) =>
          console.error(
            `[messages] dispatch failed for message_sent device=${device.id}`,
            err
          )
        )
    }

    return {
      jobId,
      messageId: whatsappMessage.id,
      waMessageId,
      status: waMessageId ? "sent" : "queued",
    }
  },

  async getOrCreateConversation(
    organizationId: string,
    phoneNumber: string,
    deviceId?: string
  ) {
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
