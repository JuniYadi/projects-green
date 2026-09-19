import { generateText } from "ai"
import { SupportTicketDepartment, SupportTicketPriority } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { messageService } from "@/modules/whatsapp/messages/messages.service"
import { searchHybridKnowledge } from "@/modules/ai/ai-rag.service"
import {
  evaluateMustacheTemplate,
  type TemplateContext,
} from "./workflow-template"
import {
  type WorkflowNode,
  PromptInputNodeConfigSchema,
  SendMessageNodeConfigSchema,
  SendInteractiveNodeConfigSchema,
  HttpRequestNodeConfigSchema,
  AiGenerateNodeConfigSchema,
  ConditionNodeConfigSchema,
  ChannelRedirectNodeConfigSchema,
  CsTicketEscalateNodeConfigSchema,
  PaymentLinkDispatchNodeConfigSchema,
} from "./workflow.schema"
import {
  resolveAiProviderConfig,
  createAiLanguageModel,
} from "@/modules/ai/ai-provider.factory"

export type NodeExecutionResult = {
  status: "COMPLETED" | "PAUSED" | "FAILED"
  outputPort: string
  capturedVariable?: { name: string; value: unknown }
  stepOutput?: Record<string, unknown>
  errorMessage?: string
}

export type ExecuteNodeContext = {
  organizationId: string
  deviceId: string
  phoneNumber: string
  node: WorkflowNode
  templateContext: TemplateContext
  inboundAnswer?: string
}

export function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase()
  if (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h === "0.0.0.0" ||
    h === "::1"
  ) {
    return true
  }
  if (
    h.startsWith("10.") ||
    h.startsWith("192.168.") ||
    h.startsWith("169.254.")
  ) {
    return true
  }
  const match = h.match(/^172\.(\d+)\./)
  if (match) {
    const octet = Number(match[1])
    if (octet >= 16 && octet <= 31) {
      return true
    }
  }
  return false
}

/**
 * Maps workflow department config to Prisma SupportTicketDepartment.
 * Note: Workflow department "SUPPORT" explicitly maps to TECHNICAL
 * as the general customer assistance department in console.
 */
function mapDepartment(dept: string): SupportTicketDepartment {
  const d = dept.toUpperCase().trim()
  if (d === "BILLING") return SupportTicketDepartment.BILLING
  if (d === "ACCOUNT") return SupportTicketDepartment.ACCOUNT
  if (d === "COMPLIANCE") return SupportTicketDepartment.COMPLIANCE
  if (d === "SUPPORT") return SupportTicketDepartment.TECHNICAL
  return SupportTicketDepartment.TECHNICAL
}

/**
 * Maps workflow priority config to Prisma SupportTicketPriority.
 * Note: Prisma enum only has LOW | MEDIUM | HIGH.
 * Workflow "NORMAL" maps to MEDIUM, and "URGENT" maps to HIGH.
 */
function mapPriority(prio: string): SupportTicketPriority {
  const p = prio.toUpperCase().trim()
  if (p === "LOW") return SupportTicketPriority.LOW
  if (p === "NORMAL") return SupportTicketPriority.MEDIUM
  if (p === "URGENT") return SupportTicketPriority.HIGH
  return SupportTicketPriority.HIGH
}

export type TelegramNotificationOptions = {
  botToken?: string
  chatId: string
  text: string
  webhookUrl?: string
}

export async function dispatchTelegramNotification(
  options: TelegramNotificationOptions
): Promise<{ sent: boolean; reason?: string }> {
  const botToken =
    options.botToken ||
    process.env.TELEGRAM_BOT_TOKEN ||
    "default-token"
  const endpoint =
    options.webhookUrl ||
    `https://api.telegram.org/bot${botToken}/sendMessage`

  try {
    const parsedUrl = new URL(endpoint)
    if (parsedUrl.protocol !== "https:") {
      return { sent: false, reason: "HTTPS protocol required" }
    }
    if (isPrivateHost(parsedUrl.hostname)) {
      return { sent: false, reason: "Targeting private internal IP blocked" }
    }

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: options.chatId,
        text: options.text,
        parse_mode: "Markdown",
      }),
    })
    return { sent: res.ok }
  } catch (err) {
    return { sent: false, reason: String(err) }
  }
}

export async function executeChannelRedirectNode(
  context: ExecuteNodeContext
): Promise<NodeExecutionResult> {
  const { organizationId, deviceId, phoneNumber, node, templateContext } =
    context
  const parsed = ChannelRedirectNodeConfigSchema.safeParse(node.config)
  if (!parsed.success) {
    return {
      status: "FAILED",
      outputPort: "error",
      errorMessage: `Invalid channel_redirect config: ${parsed.error.message}`,
    }
  }
  const config = parsed.data

  const evaluatedUrl = evaluateMustacheTemplate(
    config.redirectUrl,
    templateContext
  )
  const evaluatedMessage = evaluateMustacheTemplate(
    config.message,
    templateContext
  )
  const evaluatedButtonText = evaluateMustacheTemplate(
    config.buttonText || "Lanjutkan di Web",
    templateContext
  )

  let finalUrl = evaluatedUrl
  if (config.includeContext) {
    try {
      const u = new URL(finalUrl)
      u.searchParams.set("phone", phoneNumber)
      const sid =
        (templateContext.session?.sessionId as string) ||
        (templateContext.session?.phone_number as string) ||
        phoneNumber
      if (sid) {
        u.searchParams.set("sessionId", sid)
      }
      if (organizationId) {
        u.searchParams.set("orgId", organizationId)
      }
      finalUrl = u.toString()
    } catch {
      const separator = finalUrl.includes("?") ? "&" : "?"
      const params = new URLSearchParams()
      params.set("phone", phoneNumber)
      const sid =
        (templateContext.session?.sessionId as string) ||
        (templateContext.session?.phone_number as string) ||
        phoneNumber
      if (sid) {
        params.set("sessionId", sid)
      }
      finalUrl = `${finalUrl}${separator}${params.toString()}`
    }
  }

  await messageService.sendMessage({
    organizationId,
    phoneNumber,
    deviceId,
    type: "interactive",
    interactivePayload: {
      type: "button",
      body: { text: evaluatedMessage },
      action: {
        buttons: [
          {
            type: "cta_url",
            cta_url: {
              display_text: evaluatedButtonText,
              url: finalUrl,
            },
          },
        ],
      },
    },
  })

  return {
    status: "COMPLETED",
    outputPort: "default",
    stepOutput: {
      redirectUrl: finalUrl,
      targetChannel: config.targetChannel,
      offloaded: true,
      terminateWorkflow: true,
    },
  }
}

export async function executeCsTicketEscalateNode(
  context: ExecuteNodeContext
): Promise<NodeExecutionResult> {
  const { organizationId, deviceId, phoneNumber, node, templateContext } =
    context
  const parsed = CsTicketEscalateNodeConfigSchema.safeParse(node.config)
  if (!parsed.success) {
    return {
      status: "FAILED",
      outputPort: "error",
      errorMessage:
        `Invalid cs_ticket_escalate config: ${parsed.error.message}`,
    }
  }
  const config = parsed.data

  const renderedSubject = evaluateMustacheTemplate(
    config.subject,
    templateContext
  )
  const renderedDescription = evaluateMustacheTemplate(
    config.description,
    templateContext
  )

  const timestamp = Date.now().toString().slice(-8)
  const suffix = crypto.randomUUID().slice(0, 6).toUpperCase()
  const ticketNumber = `TCK-${timestamp}-${suffix}`

  const ticket = await prisma.supportTicket.create({
    data: {
      ticketNumber,
      organizationId,
      requesterWorkosUserId:
        (templateContext.session?.phone_number as string) ||
        phoneNumber ||
        "system",
      department: mapDepartment(config.department),
      priority: mapPriority(config.priority),
      status: "OPEN",
      subject: renderedSubject,
      description: renderedDescription,
    },
  })

  let telegramNotified = false
  if (config.notifyTelegram) {
    const telegramChatId =
      config.telegramChatId ||
      process.env.TELEGRAM_DEFAULT_CHAT_ID ||
      "admin_group"
    const alertText =
      `🚨 *ESKALASI TIKET CS #${ticket.ticketNumber}*\n` +
      `*Dept:* ${config.department} | *Priority:* ${config.priority}\n` +
      `*Pelanggan:* ${phoneNumber}\n` +
      `*Subject:* ${renderedSubject}\n\n` +
      `*Deskripsi:*\n${renderedDescription}`

    const res = await dispatchTelegramNotification({
      chatId: telegramChatId,
      text: alertText,
    })
    telegramNotified = res.sent
  }

  const defaultReply =
    `Tiket bantuan #${ticket.ticketNumber} telah dibuat, ` +
    `tim CS kami akan segera menghubungi Anda.`
  const renderedAutoReply = config.autoReplyMessage
    ? evaluateMustacheTemplate(config.autoReplyMessage, {
        ...templateContext,
        variables: {
          ...templateContext.variables,
          ticketNumber: ticket.ticketNumber,
        },
      })
    : defaultReply

  await messageService.sendMessage({
    organizationId,
    phoneNumber,
    deviceId,
    message: renderedAutoReply,
  })

  return {
    status: "COMPLETED",
    outputPort: "default",
    capturedVariable: {
      name: "ticketNumber",
      value: ticket.ticketNumber,
    },
    stepOutput: {
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
      department: ticket.department,
      priority: ticket.priority,
      telegramNotified,
    },
  }
}

export async function executePaymentLinkDispatchNode(
  context: ExecuteNodeContext
): Promise<NodeExecutionResult> {
  const { organizationId, deviceId, phoneNumber, node, templateContext } =
    context
  const parsed = PaymentLinkDispatchNodeConfigSchema.safeParse(node.config)
  if (!parsed.success) {
    return {
      status: "FAILED",
      outputPort: "error",
      errorMessage:
        `Invalid payment_link_dispatch config: ${parsed.error.message}`,
    }
  }
  const config = parsed.data

  const rawAmount =
    templateContext.variables[config.amountVariable] ??
    evaluateMustacheTemplate(
      `{{variables.${config.amountVariable}}}`,
      templateContext
    )
  const rawOrderId =
    templateContext.variables[config.orderIdVariable] ??
    evaluateMustacheTemplate(
      `{{variables.${config.orderIdVariable}}}`,
      templateContext
    )

  const amount = String(rawAmount || "0")
  const orderId = String(rawOrderId || `ORD-${Date.now().toString(36)}`)

  let finalPaymentUrl = ""
  if (config.paymentUrl) {
    finalPaymentUrl = evaluateMustacheTemplate(
      config.paymentUrl,
      templateContext
    )
  } else if (config.gateway === "MIDTRANS") {
    finalPaymentUrl =
      `https://app.midtrans.com/snap/v2/vtweb/${encodeURIComponent(orderId)}`
  } else if (config.gateway === "XENDIT") {
    finalPaymentUrl =
      `https://checkout.xendit.co/web/${encodeURIComponent(orderId)}`
  } else {
    const encOrder = encodeURIComponent(orderId)
    const encAmount = encodeURIComponent(amount)
    finalPaymentUrl =
      `https://pay.example.com/checkout?orderId=${encOrder}` +
      `&amount=${encAmount}`
  }

  const renderedButtonTitle = evaluateMustacheTemplate(
    config.buttonTitle || "Bayar Sekarang",
    templateContext
  )
  const renderedFallbackText = evaluateMustacheTemplate(
    config.fallbackText,
    templateContext
  )

  await messageService.sendMessage({
    organizationId,
    phoneNumber,
    deviceId,
    type: "interactive",
    interactivePayload: {
      type: "button",
      body: { text: renderedFallbackText },
      action: {
        buttons: [
          {
            type: "cta_url",
            cta_url: {
              display_text: renderedButtonTitle,
              url: finalPaymentUrl,
            },
          },
        ],
      },
    },
  })

  return {
    status: "COMPLETED",
    outputPort: "default",
    capturedVariable: {
      name: "paymentUrl",
      value: finalPaymentUrl,
    },
    stepOutput: {
      gateway: config.gateway,
      orderId,
      amount,
      paymentUrl: finalPaymentUrl,
    },
  }
}

/**
 * Node Executor Engine: Executes modular graph nodes.
 */
export async function executeWorkflowNode(
  context: ExecuteNodeContext
): Promise<NodeExecutionResult> {
  const {
    organizationId,
    deviceId,
    phoneNumber,
    node,
    templateContext,
    inboundAnswer,
  } = context

  switch (node.type) {
    case "send_message": {
      const parsed = SendMessageNodeConfigSchema.safeParse(node.config)
      if (!parsed.success) {
        return {
          status: "FAILED",
          outputPort: "error",
          errorMessage: `Invalid send_message config: ${parsed.error.message}`,
        }
      }
      const config = parsed.data

      const renderedText = config.text
        ? evaluateMustacheTemplate(config.text, templateContext)
        : undefined

      const renderedMediaUrl = config.mediaUrl
        ? evaluateMustacheTemplate(config.mediaUrl, templateContext)
        : undefined

      await messageService.sendMessage({
        organizationId,
        phoneNumber,
        deviceId,
        message: renderedText || "",
        type:
          config.messageType === "document"
            ? "document"
            : config.messageType === "image"
              ? "image"
              : "text",
        mediaUrl: renderedMediaUrl,
        caption: config.caption
          ? evaluateMustacheTemplate(config.caption, templateContext)
          : undefined,
      })

      return {
        status: "COMPLETED",
        outputPort: "default",
        stepOutput: { sent: true },
      }
    }

    case "prompt_input": {
      const parsed = PromptInputNodeConfigSchema.safeParse(node.config)
      if (!parsed.success) {
        return {
          status: "FAILED",
          outputPort: "error",
          errorMessage: `Invalid prompt_input config: ${parsed.error.message}`,
        }
      }
      const config = parsed.data

      // If this is the resume phase with the user's answer
      if (inboundAnswer !== undefined) {
        const answer = inboundAnswer.trim()

        // Validation
        if (config.validation) {
          const { type, pattern, errorMessage } = config.validation
          let isValid = true

          if (type === "number" && isNaN(Number(answer))) {
            isValid = false
          } else if (
            type === "email" &&
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answer)
          ) {
            isValid = false
          } else if (
            type === "regex" &&
            pattern &&
            !new RegExp(pattern).test(answer)
          ) {
            isValid = false
          }

          if (!isValid) {
            const fallbackMsg =
              errorMessage || "Jawaban Anda tidak valid. Silakan coba lagi."
            await messageService.sendMessage({
              organizationId,
              phoneNumber,
              deviceId,
              message: fallbackMsg,
            })
            // Stay paused at this prompt
            return {
              status: "PAUSED",
              outputPort: "default",
              errorMessage: "INVALID_INPUT",
            }
          }
        }

        return {
          status: "COMPLETED",
          outputPort: "default",
          capturedVariable: {
            name: config.captureVariable,
            value: answer,
          },
          stepOutput: { answer },
        }
      }

      // Initial execution: send the question and pause
      const questionText = evaluateMustacheTemplate(
        config.question,
        templateContext
      )
      await messageService.sendMessage({
        organizationId,
        phoneNumber,
        deviceId,
        message: questionText,
      })

      return {
        status: "PAUSED",
        outputPort: "default",
      }
    }

    case "send_interactive": {
      const parsed = SendInteractiveNodeConfigSchema.safeParse(node.config)
      if (!parsed.success) {
        return {
          status: "FAILED",
          outputPort: "error",
          errorMessage:
            `Invalid send_interactive config: ${parsed.error.message}`,
        }
      }
      const config = parsed.data

      const bodyText = evaluateMustacheTemplate(
        config.bodyText,
        templateContext
      )

      if (config.interactiveType === "button" && config.buttons?.length) {
        await messageService.sendMessage({
          organizationId,
          phoneNumber,
          deviceId,
          type: "interactive",
          interactivePayload: {
            type: "button",
            body: { text: bodyText },
            action: {
              buttons: config.buttons.map((b) => ({
                type: "reply",
                reply: {
                  id: b.id,
                  title: b.title,
                },
              })),
            },
          },
        })
      } else {
        await messageService.sendMessage({
          organizationId,
          phoneNumber,
          deviceId,
          message: bodyText,
        })
      }

      return {
        status: "COMPLETED",
        outputPort: "default",
        stepOutput: { sentInteractive: true },
      }
    }

    case "http_request": {
      const parsed = HttpRequestNodeConfigSchema.safeParse(node.config)
      if (!parsed.success) {
        return {
          status: "FAILED",
          outputPort: "error",
          errorMessage: `Invalid http_request config: ${parsed.error.message}`,
        }
      }
      const config = parsed.data

      const renderedUrl = evaluateMustacheTemplate(config.url, templateContext)

      // SSRF guard: validate URL protocol and prevent internal network requests
      let parsedUrl: URL
      try {
        parsedUrl = new URL(renderedUrl)
      } catch {
        return {
          status: "FAILED",
          outputPort: "error",
          errorMessage: "Invalid URL format",
        }
      }

      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        return {
          status: "FAILED",
          outputPort: "error",
          errorMessage: "URL must be http or https",
        }
      }

      if (isPrivateHost(parsedUrl.hostname)) {
        return {
          status: "FAILED",
          outputPort: "error",
          errorMessage: "URL targets a private or internal network address",
        }
      }

      const renderedHeaders: Record<string, string> = {
        "Content-Type": "application/json",
      }
      if (config.headers) {
        for (const [k, v] of Object.entries(config.headers)) {
          renderedHeaders[k] = evaluateMustacheTemplate(v, templateContext)
        }
      }

      let renderedBody: string | undefined
      if (config.method === "POST" || config.method === "PUT") {
        if (config.bodyJson) {
          const bodyStr = JSON.stringify(config.bodyJson)
          renderedBody = evaluateMustacheTemplate(bodyStr, templateContext)
        } else if (config.forwardContext) {
          // Auto-forward prior context (variables, step outputs, session)
          renderedBody = JSON.stringify({
            variables: templateContext.variables,
            steps: templateContext.steps,
            session: templateContext.session,
            nodeId: node.id,
          })
        }
      }
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), config.timeoutMs)

        const response = await fetch(renderedUrl, {
          method: config.method,
          headers: renderedHeaders,
          body: renderedBody,
          signal: controller.signal,
        })
        clearTimeout(timeout)

        let responseBody: unknown
        try {
          responseBody = await response.json()
        } catch {
          responseBody = await response.text()
        }

        if (response.ok) {
          return {
            status: "COMPLETED",
            outputPort: "success",
            stepOutput: {
              status: response.status,
              body: responseBody,
            },
          }
        } else {
          return {
            status: "COMPLETED",
            outputPort: "error",
            stepOutput: {
              status: response.status,
              error: responseBody,
            },
          }
        }
      } catch (error) {
        return {
          status: "COMPLETED",
          outputPort: "error",
          stepOutput: {
            error: String(error),
          },
        }
      }
    }

    case "condition": {
      const parsed = ConditionNodeConfigSchema.safeParse(node.config)
      if (!parsed.success) {
        return {
          status: "FAILED",
          outputPort: "error",
          errorMessage: `Invalid condition config: ${parsed.error.message}`,
        }
      }
      const config = parsed.data

      const left = evaluateMustacheTemplate(config.leftOperand, templateContext)
      const right = evaluateMustacheTemplate(
        config.rightOperand,
        templateContext
      )

      let conditionPassed = false
      switch (config.operator) {
        case "equals":
          conditionPassed =
            left.trim().toLowerCase() === right.trim().toLowerCase()
          break
        case "not_equals":
          conditionPassed =
            left.trim().toLowerCase() !== right.trim().toLowerCase()
          break
        case "contains":
          conditionPassed = left.toLowerCase().includes(right.toLowerCase())
          break
        case "greater_than":
          conditionPassed = Number(left) > Number(right)
          break
        case "less_than":
          conditionPassed = Number(left) < Number(right)
          break
      }

      return {
        status: "COMPLETED",
        outputPort: conditionPassed ? "true" : "false",
        stepOutput: { conditionPassed },
      }
    }

    case "ai_generate": {
      const parsed = AiGenerateNodeConfigSchema.safeParse(node.config)
      if (!parsed.success) {
        return {
          status: "FAILED",
          outputPort: "error",
          errorMessage: `Invalid ai_generate config: ${parsed.error.message}`,
        }
      }
      const config = parsed.data

      const renderedPrompt = evaluateMustacheTemplate(
        config.prompt,
        templateContext
      )
      let renderedSystem = config.systemPrompt
        ? evaluateMustacheTemplate(config.systemPrompt, templateContext)
        : "Anda adalah asisten cerdas yang ringkas dan tepat."

      try {
        // If AI Agent Template profile is bound, inherit persona & guardrails
        if (config.agentProfileId) {
          const agent = await prisma.aiAgentProfile.findFirst({
            where: {
              id: config.agentProfileId,
              organizationId,
            },
            include: {
              knowledgeDocuments: {
                where: { status: "READY" },
                select: { id: true, title: true },
              },
            },
          })

          if (agent && agent.isActive) {
            // Guardrail 1: Max character length
            const maxChar = agent.maxCharLength || 1000
            if (renderedPrompt.length > maxChar) {
              return {
                status: "FAILED",
                outputPort: "error",
                errorMessage:
                  `Input prompt exceeds agent max length (${maxChar} chars)`,
              }
            }

            // Guardrail 2: Profanity filter and blocked words
            if (
              agent.enableProfanityFilter &&
              agent.customBlockedWords?.length
            ) {
              const isBlocked = agent.customBlockedWords.some(
                (word: string) => {
                  const trimmed = word.trim()
                  if (!trimmed) return false
                  const escaped = trimmed
                    .toLowerCase()
                    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
                  return new RegExp(`\\b${escaped}\\b`, "i").test(
                    renderedPrompt
                  )
                }
              )
              if (isBlocked) {
                const fallback =
                  agent.fallbackMessage ||
                  "Maaf, pertanyaan Anda belum dapat diproses."
                if (config.sendReply) {
                  await messageService.sendMessage({
                    organizationId,
                    phoneNumber,
                    deviceId,
                    message: fallback,
                  })
                }
                return {
                  status: "COMPLETED",
                  outputPort: "default",
                  capturedVariable: {
                    name: config.captureVariable,
                    value: fallback,
                  },
                  stepOutput: {
                    generatedText: fallback,
                    blockedByFilter: true,
                    sentReply: config.sendReply,
                  },
                }
              }
            }

            // In-Database Hybrid RAG (pgvector + BM25)
            if (
              agent.knowledgeDocuments &&
              agent.knowledgeDocuments.length > 0
            ) {
              try {
                const knowledgeChunks = await searchHybridKnowledge({
                  organizationId,
                  agentProfileId: agent.id,
                  query: renderedPrompt,
                  limit: 3,
                })
                if (knowledgeChunks.length > 0) {
                  const contextText = knowledgeChunks
                    .map(
                      (chunk, idx) =>
                        `[Dokumen ${idx + 1}: ${chunk.title}]\n` +
                        `${chunk.contentMarkdown}`
                    )
                    .join("\n\n")
                  renderedSystem =
                    `${agent.systemPrompt || renderedSystem}\n\n` +
                    `### KONTEKS DOKUMEN RESMI:\n${contextText}\n\n` +
                    `Jawab pertanyaan berdasarkan konteks dokumen di atas ` +
                    `secara ramah dan ringkas.`
                } else if (agent.systemPrompt) {
                  renderedSystem = config.systemPrompt
                    ? `${agent.systemPrompt}\n\n${config.systemPrompt}`
                    : agent.systemPrompt
                }
              } catch (ragError) {
                console.warn("[workflow-executor] RAG search error:", ragError)
                if (agent.systemPrompt) {
                  renderedSystem = config.systemPrompt
                    ? `${agent.systemPrompt}\n\n${config.systemPrompt}`
                    : agent.systemPrompt
                }
              }
            } else if (agent.systemPrompt) {
              renderedSystem = config.systemPrompt
                ? `${agent.systemPrompt}\n\n${config.systemPrompt}`
                : agent.systemPrompt
            }
          }
        }

        const providerConfig = await resolveAiProviderConfig({
          organizationId,
          providerId: config.providerId,
          modelOverride: config.model,
        })
        const model = createAiLanguageModel(providerConfig)

        const result = await generateText({
          model,
          system: renderedSystem,
          prompt: renderedPrompt,
        })

        const generatedText = result.text.trim()

        // Auto-reply to customer if sendReply is enabled
        if (config.sendReply && generatedText) {
          await messageService.sendMessage({
            organizationId,
            phoneNumber,
            deviceId,
            message: generatedText,
          })
        }

        return {
          status: "COMPLETED",
          outputPort: "default",
          capturedVariable: {
            name: config.captureVariable,
            value: generatedText,
          },
          stepOutput: { generatedText, sentReply: config.sendReply },
        }
      } catch (error) {
        return {
          status: "FAILED",
          outputPort: "error",
          errorMessage: String(error),
        }
      }
    }

    case "channel_redirect":
      return executeChannelRedirectNode(context)

    case "cs_ticket_escalate":
      return executeCsTicketEscalateNode(context)

    case "payment_link_dispatch":
      return executePaymentLinkDispatchNode(context)

    default:
      return {
        status: "FAILED",
        outputPort: "error",
        errorMessage: `Unsupported node type: ${(node as WorkflowNode).type}`,
      }
  }
}
