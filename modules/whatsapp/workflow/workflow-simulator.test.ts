import { describe, expect, it } from "bun:test"
import type { WorkflowDefinition, WorkflowNode } from "./workflow.schema"
import {
  createSimulatorSession,
  stepSimulatorSession,
} from "./workflow-simulator"

const makeWorkflow = (
  nodes: WorkflowNode[],
  edges: WorkflowDefinition["edges"] = []
): WorkflowDefinition => ({
  id: "wf_test",
  organizationId: "org_1",
  name: "Test Flow",
  isActive: true,
  isDefault: false,
  trigger: { id: "trig_1", type: "whatsapp_inbound", keywords: [] },
  nodes,
  edges,
  version: 1,
})

const node = (
  id: string,
  type: WorkflowNode["type"],
  config: Record<string, unknown>
): WorkflowNode => ({ id, name: id, type, config })

const edge = (
  id: string,
  sourceNodeId: string,
  targetNodeId: string,
  sourcePort = "default"
): WorkflowDefinition["edges"][number] => ({
  id,
  sourceNodeId,
  targetNodeId,
  sourcePort,
})

describe("workflow simulator", () => {
  it("starts at the first node and completes an empty workflow", () => {
    const workflow = makeWorkflow([])
    const session = createSimulatorSession(workflow)

    expect(session.currentNodeId).toBeNull()
    expect(session.isCompleted).toBe(true)
    expect(session.isPaused).toBe(false)
  })

  it("traverses messages and pauses at a prompt", () => {
    const workflow = makeWorkflow(
      [
        node("greeting", "send_message", {
          text: "Hello {{variables.name}}!",
        }),
        node("name", "prompt_input", {
          question: "What is your name?",
          captureVariable: "name",
          validation: { type: "text" },
        }),
      ],
      [edge("greeting-name", "greeting", "name")]
    )

    const session = stepSimulatorSession(
      createSimulatorSession(workflow),
      workflow
    )

    expect(session.history.map((message) => message.text)).toEqual([
      "Hello !",
      "What is your name?",
    ])
    expect(session.currentNodeId).toBe("name")
    expect(session.isPaused).toBe(true)
    expect(session.isCompleted).toBe(false)
    expect(session.stepOutputs.greeting).toEqual({
      sent: true,
      text: "Hello !",
    })
  })

  it("captures valid prompt input and follows the true condition edge", () => {
    const workflow = makeWorkflow(
      [
        node("ask", "prompt_input", {
          question: "Order ID?",
          captureVariable: "order_id",
          validation: { type: "number" },
        }),
        node("check", "condition", {
          leftOperand: "{{variables.order_id}}",
          operator: "equals",
          rightOperand: "100",
        }),
        node("vip", "send_message", { text: "Order 100 is VIP!" }),
        node("normal", "send_message", {
          text: "Order {{variables.order_id}} received.",
        }),
      ],
      [
        edge("ask-check", "ask", "check"),
        edge("check-vip", "check", "vip", "true"),
        edge("check-normal", "check", "normal", "false"),
      ]
    )

    let session = stepSimulatorSession(
      createSimulatorSession(workflow),
      workflow
    )
    session = stepSimulatorSession(session, workflow, "100")

    expect(session.variables.order_id).toBe("100")
    expect(
      session.history.some((message) => message.text.includes("VIP"))
    ).toBe(true)
    expect(session.isCompleted).toBe(true)
    expect(session.currentNodeId).toBeNull()
  })

  it("captures input and follows the false condition edge", () => {
    const workflow = makeWorkflow(
      [
        node("ask", "prompt_input", {
          question: "Order ID?",
          captureVariable: "order_id",
        }),
        node("check", "condition", {
          leftOperand: "{{variables.order_id}}",
          operator: "equals",
          rightOperand: "100",
        }),
        node("vip", "send_message", { text: "VIP" }),
        node("normal", "send_message", {
          text: "Order {{variables.order_id}} received.",
        }),
      ],
      [
        edge("ask-check", "ask", "check"),
        edge("check-vip", "check", "vip", "true"),
        edge("check-normal", "check", "normal", "false"),
      ]
    )

    let session = stepSimulatorSession(
      createSimulatorSession(workflow),
      workflow
    )
    session = stepSimulatorSession(session, workflow, "500")

    expect(session.variables.order_id).toBe("500")
    expect(
      session.history.some((message) => message.text.includes("500"))
    ).toBe(true)
    expect(session.history.some((message) => message.text === "VIP")).toBe(
      false
    )
    expect(session.isCompleted).toBe(true)
  })

  it("keeps a prompt paused when validation fails", () => {
    const workflow = makeWorkflow([
      node("email", "prompt_input", {
        question: "Email?",
        captureVariable: "email",
        validation: {
          type: "email",
          errorMessage: "Enter a valid email",
        },
      }),
    ])

    let session = stepSimulatorSession(
      createSimulatorSession(workflow),
      workflow
    )
    session = stepSimulatorSession(session, workflow, "not-an-email")

    expect(session.variables.email).toBeUndefined()
    expect(session.currentNodeId).toBe("email")
    expect(session.isPaused).toBe(true)
    expect(session.history.at(-1)?.text).toBe("Enter a valid email")
  })

  it("evaluates every supported condition operator", () => {
    const cases = [
      ["equals", "Hello", "hello", true],
      ["not_equals", "Hello", "goodbye", true],
      ["contains", "Hello world", "WORLD", true],
      ["greater_than", "10", "2", true],
      ["less_than", "2", "10", true],
    ] as const

    for (const [operator, left, right, expected] of cases) {
      const workflow = makeWorkflow(
        [
          node("condition", "condition", {
            leftOperand: left,
            operator,
            rightOperand: right,
          }),
          node("true", "send_message", { text: "true" }),
          node("false", "send_message", { text: "false" }),
        ],
        [
          edge("condition-true", "condition", "true", "true"),
          edge("condition-false", "condition", "false", "false"),
        ]
      )

      const session = stepSimulatorSession(
        createSimulatorSession(workflow),
        workflow
      )
      const expectedText = expected ? "true" : "false"
      expect(
        session.history.some((message) => message.text === expectedText)
      ).toBe(true)
      expect(session.isCompleted).toBe(true)
    }
  })

  it("renders interactive buttons and records AI and HTTP mock outputs", () => {
    const workflow = makeWorkflow(
      [
        node("interactive", "send_interactive", {
          bodyText: "Choose {{variables.name}}",
          buttons: [
            { id: "yes", title: "Yes" },
            { id: "no", title: "No" },
          ],
        }),
        node("ai", "ai_generate", {
          prompt: "Help {{variables.name}}",
          captureVariable: "answer",
        }),
        node("http", "http_request", {
          method: "GET",
          url: "https://example.com/{{variables.name}}",
          captureVariable: "response",
        }),
      ],
      [
        edge("interactive-ai", "interactive", "ai"),
        edge("ai-http", "ai", "http"),
      ]
    )

    const session = stepSimulatorSession(
      createSimulatorSession(workflow),
      workflow
    )

    expect(session.history[0]?.text).toBe("Choose \n[Yes] [No]")
    expect(session.variables.answer).toBe(
      '[AI Response]: Answering question "Help ..."'
    )
    expect(session.variables.response).toEqual({ status: 200, mockData: true })
    expect(session.stepOutputs.ai).toEqual({
      generatedText: '[AI Response]: Answering question "Help ..."',
    })
    expect(session.isCompleted).toBe(true)
  })

  it("does not duplicate a paused prompt without an answer", () => {
    const workflow = makeWorkflow([
      node("ask", "prompt_input", {
        question: "Answer?",
        captureVariable: "answer",
      }),
    ])
    const initial = stepSimulatorSession(
      createSimulatorSession(workflow),
      workflow
    )
    const repeated = stepSimulatorSession(initial, workflow)

    expect(repeated.history).toHaveLength(1)
    expect(repeated.isPaused).toBe(true)
  })

  it("stops cyclic graphs at the simulation step limit", () => {
    const workflow = makeWorkflow(
      [node("loop", "send_message", { text: "loop" })],
      [edge("loop-loop", "loop", "loop")]
    )

    const session = stepSimulatorSession(
      createSimulatorSession(workflow),
      workflow
    )

    expect(
      session.history.filter((message) => message.text === "loop")
    ).toHaveLength(25)
    expect(session.isCompleted).toBe(true)
    expect(session.currentNodeId).toBeNull()
    expect(session.history.at(-1)?.sender).toBe("system")
  })
})
