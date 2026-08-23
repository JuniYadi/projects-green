import { generateText } from "ai"
import { messageService } from "@/modules/whatsapp/messages/messages.service"
import {
  evaluateMustacheTemplate,
  type TemplateContext,
} from "./workflow-session"
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
      const config = SendMessageNodeConfigSchema.parse(node.config)
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
      const config = PromptInputNodeConfigSchema.parse(node.config)

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
      const config = SendInteractiveNodeConfigSchema.parse(node.config)
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
      const config = HttpRequestNodeConfigSchema.parse(node.config)
      const renderedUrl = evaluateMustacheTemplate(config.url, templateContext)

      const renderedHeaders: Record<string, string> = {
        "Content-Type": "application/json",
      }
      if (config.headers) {
        for (const [k, v] of Object.entries(config.headers)) {
          renderedHeaders[k] = evaluateMustacheTemplate(v, templateContext)
        }
      }

      let renderedBody: string | undefined
      if (config.bodyJson && ["POST", "PUT", "PATCH"].includes(config.method)) {
        const bodyStr = JSON.stringify(config.bodyJson)
        renderedBody = evaluateMustacheTemplate(bodyStr, templateContext)
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
      const config = ConditionNodeConfigSchema.parse(node.config)
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
      const config = AiGenerateNodeConfigSchema.parse(node.config)
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
        return {
          status: "COMPLETED",
          outputPort: "default",
          capturedVariable: {
            name: config.captureVariable,
            value: generatedText,
          },
          stepOutput: { generatedText },
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
        errorMessage: `Unsupported node type: ${node.type}`,
      }
  }
}
