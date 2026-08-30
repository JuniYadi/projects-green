import { describe, expect, it, mock, beforeEach } from "bun:test"
import type { WorkflowDefinition } from "./workflow.schema"

const mockRedis = {
  get: mock(async () => null),
  set: mock(async () => "OK"),
  del: mock(async () => 1),
  eval: mock(async () => 1),
}

const mockMessageService = {
  sendMessage: mock(async () => ({ jobId: "job_1", messageId: "msg_1" })),
}

const mockPrisma = {
  whatsappDevice: {
    findUnique: mock(async () => null),
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

import {
  evaluateMustacheTemplate,
  type TemplateContext,
} from "./workflow-session"
import { executeWorkflowNode } from "./workflow-executor"
import { processWhatsappWorkflowInbound } from "./workflow-runner"
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
  it("handles malformed node config with FAILED and error port safely", async () => {
    const result = await executeWorkflowNode({
      organizationId: "org_1",
      deviceId: "dev_1",
      phoneNumber: "+62812345678",
      node: {
        id: "bad_node",
        type: "send_message",
        name: "Bad Node",
        config: {
          messageType: "invalid_type" as never,
        },
      },
      templateContext: { variables: {}, steps: {}, session: {} },
    })

    expect(result.status).toBe("FAILED")
    expect(result.outputPort).toBe("error")
  })

  it("blocks SSRF attempts to private or internal addresses in http_request node", async () => {
    const result = await executeWorkflowNode({
      organizationId: "org_1",
      deviceId: "dev_1",
      phoneNumber: "+62812345678",
      node: {
        id: "ssrf_node",
        type: "http_request",
        name: "Cloud Metadata",
        config: {
          url: "http://169.254.169.254/latest/meta-data",
          method: "GET",
        },
      },
      templateContext: { variables: {}, steps: {}, session: {} },
    })

    expect(result.status).toBe("FAILED")
    expect(result.outputPort).toBe("error")
    expect(result.errorMessage).toContain("private or internal network")
  })

  it("executes interactive button sending in send_interactive node", async () => {
    const result = await executeWorkflowNode({
      organizationId: "org_1",
      deviceId: "dev_1",
      phoneNumber: "+62812345678",
      node: {
        id: "inter_1",
        type: "send_interactive",
        name: "Menu",
        config: {
          interactiveType: "button",
          bodyText: "Pilih menu:",
          buttons: [{ id: "btn_1", title: "Cek Status" }],
        },
      },
      templateContext: { variables: {}, steps: {}, session: {} },
    })

    expect(result.status).toBe("COMPLETED")
    expect(result.outputPort).toBe("default")
    expect(mockMessageService.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "interactive",
      })
    )
  })

  it("executes prompt_input validation failure with retry prompt", async () => {
    const result = await executeWorkflowNode({
      organizationId: "org_1",
      deviceId: "dev_1",
      phoneNumber: "+62812345678",
      node: {
        id: "prompt_email",
        type: "prompt_input",
        name: "Ask Email",
        config: {
          question: "Masukkan email:",
          captureVariable: "email",
          validation: { type: "email", errorMessage: "Format email salah." },
        },
      },
      templateContext: { variables: {}, steps: {}, session: {} },
      inboundAnswer: "bukan-email",
    })

    expect(result.status).toBe("PAUSED")
    expect(result.outputPort).toBe("default")
    expect(mockMessageService.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Format email salah.",
      })
    )
  })

  it("executes prompt_input number and regex validation failures", async () => {
    const resultNumber = await executeWorkflowNode({
      organizationId: "org_1",
      deviceId: "dev_1",
      phoneNumber: "+62812345678",
      node: {
        id: "prompt_num",
        type: "prompt_input",
        name: "Ask Number",
        config: {
          question: "Berapa umur Anda?",
          captureVariable: "age",
          validation: { type: "number" },
        },
      },
      templateContext: { variables: {}, steps: {}, session: {} },
      inboundAnswer: "dua puluh",
    })
    expect(resultNumber.status).toBe("PAUSED")

    const resultRegex = await executeWorkflowNode({
      organizationId: "org_1",
      deviceId: "dev_1",
      phoneNumber: "+62812345678",
      node: {
        id: "prompt_code",
        type: "prompt_input",
        name: "Ask Code",
        config: {
          question: "Masukkan kode:",
          captureVariable: "code",
          validation: { type: "regex", pattern: "^[A-Z]{3}$" },
        },
      },
      templateContext: { variables: {}, steps: {}, session: {} },
      inboundAnswer: "1234",
    })
    expect(resultRegex.status).toBe("PAUSED")
  })

  it("handles condition operators: not_equals, contains, less_than", async () => {
    const condNotEquals = await executeWorkflowNode({
      organizationId: "org_1",
      deviceId: "dev_1",
      phoneNumber: "+62812345678",
      node: {
        id: "c_ne",
        type: "condition",
        name: "Check Not Equal",
        config: {
          leftOperand: "A",
          operator: "not_equals",
          rightOperand: "B",
        },
      },
      templateContext: { variables: {}, steps: {}, session: {} },
    })
    expect(condNotEquals.outputPort).toBe("true")

    const condContains = await executeWorkflowNode({
      organizationId: "org_1",
      deviceId: "dev_1",
      phoneNumber: "+62812345678",
      node: {
        id: "c_ct",
        type: "condition",
        name: "Check Contains",
        config: {
          leftOperand: "Hello World",
          operator: "contains",
          rightOperand: "world",
        },
      },
      templateContext: { variables: {}, steps: {}, session: {} },
    })
    expect(condContains.outputPort).toBe("true")

    const condLessThan = await executeWorkflowNode({
      organizationId: "org_1",
      deviceId: "dev_1",
      phoneNumber: "+62812345678",
      node: {
        id: "c_lt",
        type: "condition",
        name: "Check Less Than",
        config: {
          leftOperand: "10",
          operator: "less_than",
          rightOperand: "20",
        },
      },
      templateContext: { variables: {}, steps: {}, session: {} },
    })
    expect(condLessThan.outputPort).toBe("true")
  })
})

describe("modules/whatsapp/workflow - Workflow Runner Engine", () => {
  beforeEach(() => {
    mockRedis.get.mockClear()
    mockRedis.set.mockClear()
    mockRedis.del.mockClear()
    mockRedis.get.mockImplementation(async () => null)
    mockRedis.set.mockImplementation(async () => "OK")
    mockRedis.del.mockImplementation(async () => 1)
    mockRedis.eval.mockImplementation(async () => 1)
    mockPrisma.whatsappDevice.findUnique.mockResolvedValue(null as never)
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
            validation: { type: "text" },
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
