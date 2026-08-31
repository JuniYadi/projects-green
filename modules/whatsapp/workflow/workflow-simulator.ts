import type {
  AiGenerateNodeConfig,
  ConditionNodeConfig,
  HttpRequestNodeConfig,
  PromptInputNodeConfig,
  SendInteractiveNodeConfig,
  SendMessageNodeConfig,
  WorkflowDefinition,
  WorkflowNode,
} from "./workflow.schema"
import {
  evaluateMustacheTemplate,
  type TemplateContext,
} from "./workflow-session"

export type SimulatorMessage = {
  sender: "bot" | "user" | "system"
  text: string
  timestamp: string
}

export type SimulatorSession = {
  currentNodeId: string | null
  variables: Record<string, unknown>
  stepOutputs: Record<string, unknown>
  history: SimulatorMessage[]
  isCompleted: boolean
  isPaused: boolean
}

type HttpSimulatorConfig = HttpRequestNodeConfig & {
  captureVariable?: string
}

const MAX_SIMULATION_STEPS = 25
const SIMULATOR_PHONE_NUMBER = "+6281234567890"

function timestamp(): string {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback
}

function isValidPromptInput(
  answer: string,
  validation: PromptInputNodeConfig["validation"]
): boolean {
  if (!validation) {
    return true
  }

  switch (validation.type) {
    case "number":
      return !Number.isNaN(Number(answer))
    case "email":
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answer)
    case "regex":
      if (!validation.pattern) {
        return true
      }
      try {
        return new RegExp(validation.pattern).test(answer)
      } catch {
        return false
      }
    case "text":
      return true
  }
}

function conditionMatches(
  operator: ConditionNodeConfig["operator"],
  left: string,
  right: string
): boolean {
  switch (operator) {
    case "equals":
      return left.toLowerCase() === right.toLowerCase()
    case "not_equals":
      return left.toLowerCase() !== right.toLowerCase()
    case "contains":
      return left.toLowerCase().includes(right.toLowerCase())
    case "greater_than":
      return Number(left) > Number(right)
    case "less_than":
      return Number(left) < Number(right)
  }
}

function cloneSession(sessionState: SimulatorSession): SimulatorSession {
  return {
    ...sessionState,
    variables: { ...sessionState.variables },
    stepOutputs: { ...sessionState.stepOutputs },
    history: [...sessionState.history],
  }
}

function addSystemMessage(session: SimulatorSession, text: string): void {
  session.history.push({ sender: "system", text, timestamp: timestamp() })
}

export function createSimulatorSession(
  workflow: WorkflowDefinition
): SimulatorSession {
  const firstNode = workflow.nodes[0]

  return {
    currentNodeId: firstNode ? firstNode.id : null,
    variables: {},
    stepOutputs: {},
    history: [],
    isCompleted: !firstNode,
    isPaused: false,
  }
}

export function stepSimulatorSession(
  sessionState: SimulatorSession,
  workflow: WorkflowDefinition,
  userInput?: string
): SimulatorSession {
  const session = cloneSession(sessionState)

  if (session.isCompleted || !session.currentNodeId) {
    return session
  }

  // A paused session only advances after receiving an answer.
  if (session.isPaused && userInput === undefined) {
    return session
  }

  const isResume = session.isPaused && userInput !== undefined
  if (userInput !== undefined) {
    session.history.push({
      sender: "user",
      text: userInput,
      timestamp: timestamp(),
    })
  }

  let consumingInput = isResume
  let stepCount = 0

  while (session.currentNodeId && stepCount < MAX_SIMULATION_STEPS) {
    stepCount += 1
    const node = workflow.nodes.find(
      (candidate) => candidate.id === session.currentNodeId
    )

    if (!node) {
      session.isCompleted = true
      session.currentNodeId = null
      addSystemMessage(session, "Workflow reached an unknown node.")
      break
    }

    const templateContext: TemplateContext = {
      variables: session.variables,
      steps: session.stepOutputs,
      session: {
        phone_number: SIMULATOR_PHONE_NUMBER,
        organization_id: "org_sim",
      },
    }
    let outputPort = "default"

    switch (node.type) {
      case "send_message": {
        const config = node.config as unknown as SendMessageNodeConfig
        const text = evaluateMustacheTemplate(
          asString(config.text),
          templateContext
        )
        session.history.push({ sender: "bot", text, timestamp: timestamp() })
        session.stepOutputs[node.id] = { sent: true, text }
        break
      }

      case "prompt_input": {
        const config = node.config as unknown as PromptInputNodeConfig
        const captureVariable = asString(
          config.captureVariable,
          `var_${node.id}`
        )

        if (consumingInput && userInput !== undefined) {
          const answer = userInput.trim()
          consumingInput = false

          if (!isValidPromptInput(answer, config.validation)) {
            const errorMessage = asString(
              config.validation?.errorMessage,
              "Your answer is not valid. Please try again."
            )
            session.history.push({
              sender: "bot",
              text: errorMessage,
              timestamp: timestamp(),
            })
            session.isPaused = true
            return session
          }

          session.isPaused = false
          session.variables[captureVariable] = answer
          session.stepOutputs[node.id] = { answer }
          addSystemMessage(session, `Saved: ${captureVariable} = "${answer}"`)
          break
        }

        const question = evaluateMustacheTemplate(
          asString(config.question, "Please reply:"),
          templateContext
        )
        session.history.push({
          sender: "bot",
          text: question,
          timestamp: timestamp(),
        })
        session.isPaused = true
        return session
      }

      case "send_interactive": {
        const config = node.config as unknown as SendInteractiveNodeConfig
        const bodyText = evaluateMustacheTemplate(
          asString(config.bodyText),
          templateContext
        )
        const buttons = Array.isArray(config.buttons) ? config.buttons : []
        const buttonOptions = buttons
          .map((button) => {
            const title = evaluateMustacheTemplate(
              asString(button.title),
              templateContext
            )
            return `[${title}]`
          })
          .join(" ")
        const text = buttonOptions ? `${bodyText}\n${buttonOptions}` : bodyText

        session.history.push({ sender: "bot", text, timestamp: timestamp() })
        session.stepOutputs[node.id] = { sentInteractive: true }
        break
      }

      case "condition": {
        const config = node.config as unknown as ConditionNodeConfig
        const left = evaluateMustacheTemplate(
          asString(config.leftOperand),
          templateContext
        ).trim()
        const right = evaluateMustacheTemplate(
          asString(config.rightOperand),
          templateContext
        ).trim()
        const passed = conditionMatches(config.operator, left, right)

        outputPort = passed ? "true" : "false"
        session.stepOutputs[node.id] = { conditionPassed: passed }
        addSystemMessage(
          session,
          `Condition (${left} ${config.operator} ${right}) => ${
            passed ? "TRUE" : "FALSE"
          }`
        )
        break
      }

      case "ai_generate": {
        const config = node.config as unknown as AiGenerateNodeConfig
        const prompt = evaluateMustacheTemplate(
          asString(config.prompt),
          templateContext
        )
        const mockResponse = `[AI Respon]: Menjawab pertanyaan "${prompt.slice(
          0,
          30
        )}..."`
        const captureVariable = asString(
          config.captureVariable,
          `ai_${node.id}`
        )

        session.variables[captureVariable] = mockResponse
        session.stepOutputs[node.id] = { generatedText: mockResponse }
        session.history.push({
          sender: "bot",
          text: mockResponse,
          timestamp: timestamp(),
        })
        break
      }

      case "http_request": {
        const config = node.config as unknown as HttpSimulatorConfig
        const method = asString(config.method, "GET")
        const url = evaluateMustacheTemplate(
          asString(config.url),
          templateContext
        )
        const mockResponse = { status: 200, mockData: true }
        const captureVariable = asString(
          config.captureVariable,
          `http_${node.id}`
        )

        session.variables[captureVariable] = mockResponse
        session.stepOutputs[node.id] = {
          status: 200,
          body: { mockData: true },
        }
        session.history.push({
          sender: "system",
          text: `HTTP ${method} ${url} => 200 OK`,
          timestamp: timestamp(),
        })
        outputPort = "success"
        break
      }
    }

    const nextEdge =
      workflow.edges.find(
        (edge) =>
          edge.sourceNodeId === node.id && edge.sourcePort === outputPort
      ) ||
      workflow.edges.find(
        (edge) => edge.sourceNodeId === node.id && edge.sourcePort === "default"
      )

    if (!nextEdge) {
      session.isCompleted = true
      session.currentNodeId = null
      session.isPaused = false
      addSystemMessage(session, "Workflow reached end of conversation.")
      break
    }

    session.currentNodeId = nextEdge.targetNodeId
  }

  if (
    session.currentNodeId &&
    stepCount >= MAX_SIMULATION_STEPS &&
    !session.isPaused
  ) {
    session.isCompleted = true
    session.currentNodeId = null
    addSystemMessage(
      session,
      `Workflow stopped after ${MAX_SIMULATION_STEPS} simulation steps.`
    )
  }

  return session
}
