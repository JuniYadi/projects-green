import { generateText } from "ai"
import { messageService } from "@/modules/whatsapp/messages/messages.service"
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

/**
 * Node Executor Engine: Executes modular graph nodes and determines next output port.
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
          errorMessage: `Invalid send_interactive config: ${parsed.error.message}`,
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

      const hostname = parsedUrl.hostname.toLowerCase()
      if (
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname === "0.0.0.0" ||
        hostname === "::1" ||
        hostname.startsWith("169.254.") ||
        hostname.startsWith("10.") ||
        hostname.startsWith("172.16.") ||
        hostname.startsWith("172.17.") ||
        hostname.startsWith("172.18.") ||
        hostname.startsWith("172.19.") ||
        hostname.startsWith("172.20.") ||
        hostname.startsWith("172.21.") ||
        hostname.startsWith("172.22.") ||
        hostname.startsWith("172.23.") ||
        hostname.startsWith("172.24.") ||
        hostname.startsWith("172.25.") ||
        hostname.startsWith("172.26.") ||
        hostname.startsWith("172.27.") ||
        hostname.startsWith("172.28.") ||
        hostname.startsWith("172.29.") ||
        hostname.startsWith("172.30.") ||
        hostname.startsWith("172.31.") ||
        hostname.startsWith("192.168.")
      ) {
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
          // Auto-forward entire prior graph context (variables, previous step outputs, phone session)
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
      const renderedSystem = config.systemPrompt
        ? evaluateMustacheTemplate(config.systemPrompt, templateContext)
        : "Anda adalah asisten cerdas yang ringkas dan tepat."

      try {
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

    default:
      return {
        status: "FAILED",
        outputPort: "error",
        errorMessage: `Unsupported node type: ${(node as WorkflowNode).type}`,
      }
  }
}
