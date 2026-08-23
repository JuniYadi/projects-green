import { describe, expect, it, mock, beforeEach } from "bun:test"
import {
  evaluateMustacheTemplate,
  type TemplateContext,
} from "./workflow-session"
import { executeWorkflowNode } from "./workflow-executor"
import { processWhatsappWorkflowInbound } from "./workflow-runner"
import type { WorkflowDefinition } from "./workflow.schema"

const mockRedis = {
  get: mock(async () => null as unknown),
  set: mock(async () => "OK"),
  del: mock(async () => 1),
  eval: mock(async () => 1),
}

const mockMessageService = {
  sendMessage: mock(async () => ({ jobId: "job_1", messageId: "msg_1" })),
}

const mockPrisma = {
  whatsappDevice: {
    findUnique: mock(async () => null as unknown),
  },
}

mock.module("@/lib/redis", () => ({
  redis: mockRedis,
}))

mock.module("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

mock.module("@/modules/whatsapp/messages/messages.service", () => ({
  messageService: mockMessageService,
}))

describe("modules/whatsapp/workflow - Template Evaluator", () => {
  it("resolves nested mustache variables correctly", () => {
    const context: TemplateContext = {
      variables: {
        customer_name: "Budi",
        invoice: { id: "INV-101", total: 75000 },
      },
      steps: {
        http_1: { body: { trackingNumber: "JNE12345" } },
      },
      session: {
        phone_number: "+62812345678",
      },
    }

    const template =
      "Halo {{variables.customer_name}}, tagihan {{variables.invoice.id}} sebesar Rp{{variables.invoice.total}} sedang dikirim dengan no resi {{steps.http_1.body.trackingNumber}}."
    const rendered = evaluateMustacheTemplate(template, context)

    expect(rendered).toBe(
      "Halo Budi, tagihan INV-101 sebesar Rp75000 sedang dikirim dengan no resi JNE12345."
    )
  })

  it("handles missing variables gracefully with empty string", () => {
    const context: TemplateContext = {
      variables: {},
      steps: {},
      session: {},
    }
    const rendered = evaluateMustacheTemplate(
      "Data: {{variables.missing}}",
      context
    )
    expect(rendered).toBe("Data: ")
  })
})

describe("modules/whatsapp/workflow - Node Executor", () => {
  beforeEach(() => {
    mockMessageService.sendMessage.mockClear()
  })

  it("executes send_message node and renders dynamic mustache template", async () => {
    const result = await executeWorkflowNode({
      organizationId: "org_1",
      deviceId: "dev_1",
      phoneNumber: "+62812345678",
      node: {
        id: "msg_node_1",
        type: "send_message",
        name: "Welcome Message",
        config: {
          text: "Selamat datang di toko kami, {{session.phone_number}}!",
          messageType: "text",
        },
      },
      templateContext: {
        variables: {},
        steps: {},
        session: { phone_number: "+62812345678" },
      },
    })

    expect(result.status).toBe("COMPLETED")
    expect(result.outputPort).toBe("default")
    expect(mockMessageService.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Selamat datang di toko kami, +62812345678!",
      })
    )
  })

  it("executes prompt_input node: sends question and pauses on initial execution", async () => {
    const result = await executeWorkflowNode({
      organizationId: "org_1",
      deviceId: "dev_1",
      phoneNumber: "+62812345678",
      node: {
        id: "prompt_name",
        type: "prompt_input",
        name: "Ask Name",
        config: {
          question: "Siapa nama lengkap Anda?",
          captureVariable: "user_name",
        },
      },
      templateContext: {
        variables: {},
        steps: {},
        session: {},
      },
    })

    expect(result.status).toBe("PAUSED")
    expect(mockMessageService.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Siapa nama lengkap Anda?",
      })
    )
  })

  it("executes prompt_input node: validates and captures answer on resume", async () => {
    const result = await executeWorkflowNode({
      organizationId: "org_1",
      deviceId: "dev_1",
      phoneNumber: "+62812345678",
      node: {
        id: "prompt_name",
        type: "prompt_input",
        name: "Ask Name",
        config: {
          question: "Siapa nama lengkap Anda?",
          captureVariable: "user_name",
          validation: { type: "text" },
        },
      },
      templateContext: {
        variables: {},
        steps: {},
        session: {},
      },
      inboundAnswer: "Andi Saputra",
    })

    expect(result.status).toBe("COMPLETED")
    expect(result.capturedVariable).toEqual({
      name: "user_name",
      value: "Andi Saputra",
    })
  })

  it("evaluates condition node branches properly", async () => {
    const result = await executeWorkflowNode({
      organizationId: "org_1",
      deviceId: "dev_1",
      phoneNumber: "+62812345678",
      node: {
        id: "cond_1",
        type: "condition",
        name: "Check Amount",
        config: {
          leftOperand: "{{variables.total}}",
          operator: "greater_than",
          rightOperand: "50000",
        },
      },
      templateContext: {
        variables: { total: 100000 },
        steps: {},
        session: {},
      },
    })

    expect(result.status).toBe("COMPLETED")
    expect(result.outputPort).toBe("true")
  })
})

describe("modules/whatsapp/workflow - Workflow Runner Engine", () => {
  beforeEach(() => {
    mockRedis.get.mockClear()
    mockRedis.set.mockClear()
    mockRedis.del.mockClear()
    mockRedis.eval.mockClear()
    mockRedis.get.mockResolvedValue(null)
    mockRedis.set.mockResolvedValue("OK")
    mockRedis.del.mockResolvedValue(1)
    mockRedis.eval.mockResolvedValue(1)
    mockPrisma.whatsappDevice.findUnique.mockReset()
    mockMessageService.sendMessage.mockClear()
  })

  it("triggers and runs a multi-node workflow sequentially from keyword match", async () => {
    const sampleWorkflow: WorkflowDefinition = {
      id: "wf_cek_ongkir",
      organizationId: "org_1",
      name: "Cek Ongkir",
      isActive: true,
      trigger: {
        id: "trig_1",
        type: "keyword_match",
        keywords: ["ongkir", "cek ongkir"],
      },
      nodes: [
        {
          id: "node_msg",
          type: "send_message",
          name: "Intro",
          config: { text: "Halo, mari cek tarif pengiriman Anda." },
        },
        {
          id: "node_prompt",
          type: "prompt_input",
          name: "Ask City",
          config: {
            question: "Ketik nama kota tujuan Anda:",
            captureVariable: "kota_tujuan",
          },
        },
      ],
      edges: [
        {
          id: "edge_1",
          sourceNodeId: "node_msg",
          sourcePort: "default",
          targetNodeId: "node_prompt",
        },
      ],
      version: 1,
    }

    mockPrisma.whatsappDevice.findUnique.mockResolvedValue({
      id: "dev_1",
      features: { botWorkflow: sampleWorkflow },
    } as never)

    const res = await processWhatsappWorkflowInbound({
      organizationId: "org_1",
      deviceId: "dev_1",
      contactPhone: "+62812345678",
      inboundMessageText: "info ongkir dong",
    })

    expect(res.handled).toBe(true)
    expect(res.reason).toBe("PAUSED_AT_INPUT")
    expect(mockMessageService.sendMessage).toHaveBeenCalledTimes(2)
  })
})
