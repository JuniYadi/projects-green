import { WhatsAppDeviceClient } from "@/lib/whatsapp/meta-cloud/device-client"
import type { InteractivePayload } from "@/lib/whatsapp/meta-cloud/types"
import { prisma } from "@/lib/prisma"
import { enqueueQuotaReconciliation } from "@/lib/queue/quota-reconciliation"
import { randomUUID } from "crypto"
import { Prisma, WhatsappBillingCategory } from "@prisma/client"
import type { WhatsAppTemplateLanguage } from "@/lib/api/whatsapp-client"
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
  SubscriptionNotFoundError,
} from "@/modules/billing/types"
import { quotaAlertService } from "./quota-alert.service"
import { upsertWhatsappContactFromMessage } from "@/modules/whatsapp/contacts/contacts.service"
import { resolveWhatsappQuotaCredit } from "./quota-credit.service"
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
  | "location"
  | "interactive"

export type SendTemplateMessageOptions = {
  organizationId: string
  phoneNumber: string
  templateName: string
  templateLanguage: string
  fields?: string[]
  renderedBody?: string | null
  deviceId?: string
  billingCategory?: WhatsappBillingCategory
  templateLanguageData: WhatsAppTemplateLanguage
}

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
  interactivePayload?: InteractivePayload
}

export type MessageService = {
  sendMessage(options: SendMessageOptions): Promise<SendMessageResult>
  sendTemplateMessage(
    options: SendTemplateMessageOptions
  ): Promise<SendMessageResult>
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

    // Resolve quota credit for REPLY category (free-form messages)
    const quotaCredit = await resolveWhatsappQuotaCredit({
      category: WhatsappBillingCategory.REPLY,
      phoneNumber,
    })

    // idempotencyKey includes retry context so broadcast retries generate unique keys
    const idempotencyKey = `wa-message:${jobId}:attempt-0`

    // Track billing decision to enable compensation on Meta API failure
    let billingDecision: WhatsappBillingDecision | null = null

    try {
      billingDecision = await whatsappBilling.consumeAllowanceOrChargeOverage({
        organizationId,
        deviceId: device.id,
        quotaCredit: quotaCredit.quotaCredit,
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
      if (error instanceof SubscriptionNotFoundError) {
        // No subscription — no quota limits apply, proceed to balance charging
        quotaCheckResult = null
      } else {
        console.error("[messageService] Quota check failed:", error)
        throw error
      }
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
                      payload: (interactivePayload ?? {}) as InteractivePayload,
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
          .restoreAllowance(device.id, {
            default: billingDecision.defaultConsumed,
            addon: billingDecision.addonConsumed,
          })
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
    }

    // 4. Record billing ledger + deduct quota / count messages
    let quotaPending = false
    const now = new Date()

    // Billing ledger — record on success (always, regardless of subscription)
    if (waMessageId) {
      await prisma.whatsappBillingLedger.create({
        data: {
          organizationId,
          waMessageId,
          phoneNumber,
          category: quotaCredit.category,
          quotaKey: device.id,
          quotaValue: quotaCredit.quotaCredit,
          whatsappDeviceId: device.id,
        },
      })
    }

    // ── Subscription-based quota deduction and cost tracking ──
    if (subscription) {
      if (waMessageId) {
        try {
          await quotaGate.deductMessageQuota(organizationId, device.id, "OUT")
        } catch (error) {
          quotaPending = true
          console.error(
            "[messageService] Quota deduction failed, enqueuing reconciliation:",
            error
          )
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

        const updatedDevice = await prisma.whatsappDevice.update({
          where: { id: device.id },
          data: { currentQuotaUsed: { increment: messageRateIdr } },
          select: { currentQuotaUsed: true },
        })

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
          .catch((err) =>
            console.error("[messageService] Quota alert failed:", err)
          )
      }
    } else {
      // Non-subscription: count messages manually
      if (waMessageId) {
        const today = new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
        )
        const year = now.getUTCFullYear()
        const month = now.getUTCMonth() + 1

        await Promise.all([
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
        ])
      }
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

    // Upsert contact from this outbound send
    await upsertWhatsappContactFromMessage({
      organizationId,
      phoneNumber,
      whatsappDeviceId: device.id,
      messageAt: whatsappMessage.createdAt ?? new Date(),
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
  async sendTemplateMessage(options: SendTemplateMessageOptions) {
    const {
      organizationId,
      phoneNumber,
      deviceId,
      templateName,
      templateLanguage,
      fields,
      renderedBody,
      billingCategory,
      templateLanguageData,
    } = options
    const jobId = `wa-job-${randomUUID()}`

    // Get device
    const device = deviceId
      ? await prisma.whatsappDevice.findFirst({
          where: { id: deviceId, organizationId },
        })
      : await prisma.whatsappDevice.findFirst({ where: { organizationId } })
    if (!device) {
      throw new Error("WhatsApp device not found")
    }

    // Billing checks (same as sendMessage)
    const balanceGate = new BalanceGateService(prisma)
    const quotaGate = new QuotaGateService(prisma)
    const usageLedger = new UsageLedgerService(prisma)
    const messageCostService = new MessageCostService(prisma)
    const whatsappBilling = new WhatsappBillingService(
      prisma,
      new BillingTransactionService(prisma)
    )

    const unitPrice = await messageCostService.estimateMessageCost({
      organizationId,
      messageType: "text",
      deviceId,
    })

    // Resolve quota credit: use template's category or default to UTILITY
    const resolvedCategory = billingCategory ?? WhatsappBillingCategory.UTILITY
    const quotaCredit = await resolveWhatsappQuotaCredit({
      category: resolvedCategory,
      phoneNumber,
    })

    const idempotencyKey = `wa-message:${jobId}:attempt-0`
    let billingDecision:
      | import("@/modules/whatsapp/billing/whatsapp-billing.service").WhatsappBillingDecision
      | null = null

    try {
      billingDecision = await whatsappBilling.consumeAllowanceOrChargeOverage({
        organizationId,
        deviceId: device.id,
        quotaCredit: quotaCredit.quotaCredit,
        unitPrice,
        idempotencyKey,
      })
    } catch (err) {
      if (err instanceof Error && err.message === "INSUFFICIENT_BALANCE") {
        throw new InsufficientBalanceError(unitPrice, new Prisma.Decimal(0))
      }
      throw err
    }

    // Quota check
    let quotaCheckResult
    try {
      quotaCheckResult = await quotaGate.checkMessageQuota(
        organizationId,
        device.id,
        "OUT"
      )
    } catch (error) {
      if (error instanceof SubscriptionNotFoundError) {
        quotaCheckResult = null
      } else {
        console.error("[messageService] Quota check failed:", error)
        throw error
      }
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

    // Get subscription
    const subscription = await prisma.serviceSubscription.findFirst({
      where: {
        organizationId,
        package: { code: "WHATSAPP" },
        status: "ACTIVE",
      },
    })

    // Create device client and send template message
    const client = await WhatsAppDeviceClient.fromDevice({
      accessToken: device.tokenEncrypted ?? "",
      phoneNumberId: device.whatsappPhoneId ?? "",
      wabaId: device.whatsappBusinessAccountId ?? "",
      organizationId,
    })

    let waMessageId: string | undefined
    try {
      const result = await client.sendTemplateMessage({
        to: phoneNumber,
        templateName,
        templateLanguage,
        fields: fields ?? [],
      })
      waMessageId = result.providerMessageId
    } catch (err) {
      console.error(
        "[messageService] Failed to send template via Meta API:",
        err
      )
      if (billingDecision?.kind === "ALLOWANCE") {
        whatsappBilling
          .restoreAllowance(device.id, {
            default: billingDecision.defaultConsumed,
            addon: billingDecision.addonConsumed,
          })
          .catch(() => {})
      } else if (billingDecision?.kind === "OVERAGE_CHARGED") {
        console.warn(
          "[messageService] Overage charged but Meta API failed. Balance not auto-refunded.",
          { adjustmentId: billingDecision.adjustmentId, jobId }
        )
      }
    }

    // ── Record billing ledger + deduct quota / count messages ──
    let quotaPending = false
    const now = new Date()

    // Billing ledger — record on success (always, regardless of subscription)
    if (waMessageId) {
      await prisma.whatsappBillingLedger.create({
        data: {
          organizationId,
          waMessageId,
          phoneNumber,
          category: quotaCredit.category,
          quotaKey: device.id,
          quotaValue: quotaCredit.quotaCredit,
          whatsappDeviceId: device.id,
        },
      })
    }

    // ── Subscription-based quota deduction and cost tracking ──
    if (subscription) {
      if (waMessageId) {
        try {
          await quotaGate.deductMessageQuota(organizationId, device.id, "OUT")
        } catch (error) {
          quotaPending = true
          enqueueQuotaReconciliation(
            organizationId,
            device.id,
            "OUT",
            jobId,
            new Date()
          ).catch(() => {})
        }

        let messageRateIdr = new Decimal(0)
        try {
          const pricing = await balanceGate.findPricing({
            planId: subscription.planId,
            regionId: "GLOBAL",
            type: "PAYG",
            billingMode: "PAYG",
          })
          messageRateIdr = pricing.unitRateMessage ?? new Decimal(0)
        } catch {}

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

        const updatedDevice = await prisma.whatsappDevice.update({
          where: { id: device.id },
          data: { currentQuotaUsed: { increment: messageRateIdr } },
          select: { currentQuotaUsed: true },
        })

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
          .catch(() => {})
      }
    } else {
      // Non-subscription: count messages manually
      if (waMessageId) {
        const today = new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
        )
        const year = now.getUTCFullYear()
        const month = now.getUTCMonth() + 1

        await Promise.all([
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
        ])
      }
    }

    // Conversation
    const conversationId = await messageService.getOrCreateConversation(
      organizationId,
      phoneNumber,
      deviceId
    )

    // Message record
    const whatsappMessage = await prisma.whatsappMessage.create({
      data: {
        conversationId,
        direction: "OUTBOX",
        messageType: "template",
        body: renderedBody ?? null,
        waMessageId,
        metadata: {
          jobId,
          quotaPending,
          templateName,
          templateLanguage,
          fields: fields ?? [],
          templateLanguageData:
            templateLanguageData as unknown as Prisma.InputJsonValue,
        },
      },
    })
    // Upsert contact from this outbound template send
    await upsertWhatsappContactFromMessage({
      organizationId,
      phoneNumber,
      whatsappDeviceId: device.id,
      messageAt: whatsappMessage.createdAt ?? new Date(),
    })

    // Webhook
    if (waMessageId) {
      webhookDispatcher
        .dispatchForDevice(
          device.id,
          "message_sent",
          { message: whatsappMessage, recipient: phoneNumber },
          whatsappMessage.id
        )
        .catch((err) =>
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
    } else {
      // Always update existing conversation with latest direction and timestamp
      await prisma.whatsappConversation.update({
        where: { id: conversation.id },
        data: {
          lastDirection: "OUTBOX",
          lastMessageAt: new Date(),
          ...(deviceId ? { whatsappDeviceId: deviceId } : {}),
        },
      })
    }

    return conversation.id
  },
}
