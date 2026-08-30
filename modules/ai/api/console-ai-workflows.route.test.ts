import { describe, it, expect } from "bun:test"
import {
  buildTemplateWorkflow,
  createConsoleAiWorkflowsRoutes,
} from "./console-ai-workflows.route"
import { WorkflowDefinitionSchema } from "@/modules/whatsapp/workflow/workflow.schema"

describe("modules/ai/api - Console AI Workflows Route", () => {
  it("generates resi tracking workflow from natural prompt", () => {
    const { workflow, summary } = buildTemplateWorkflow(
      "tolong buatkan bot untuk lacak nomor resi pengiriman"
    )
    expect(workflow.name).toContain("Resi")
    expect(workflow.nodes.length).toBe(2)
    expect(workflow.nodes[0].type).toBe("prompt_input")
    expect(workflow.nodes[1].type).toBe("send_message")
    expect(summary).toContain("resi")

    const parsed = WorkflowDefinitionSchema.safeParse(workflow)
    expect(parsed.success).toBe(true)
  })

  it("generates registration lead workflow from natural prompt", () => {
    const { workflow, summary } = buildTemplateWorkflow(
      "bikin form pendaftaran calon siswa baru"
    )
    expect(workflow.nodes.length).toBe(3)
    expect(workflow.nodes[0].type).toBe("prompt_input")
    expect(workflow.nodes[1].type).toBe("prompt_input")
    expect(workflow.nodes[2].type).toBe("send_message")
    expect(summary).toContain("pendaftaran")

    const parsed = WorkflowDefinitionSchema.safeParse(workflow)
    expect(parsed.success).toBe(true)
  })

  it("generates welcome menu interactive workflow by default", () => {
    const { workflow, summary } = buildTemplateWorkflow("sapa pelanggan")
    expect(workflow.nodes.length).toBe(1)
    expect(workflow.nodes[0].type).toBe("send_interactive")
    expect(summary).toContain("sambutan")

    const parsed = WorkflowDefinitionSchema.safeParse(workflow)
    expect(parsed.success).toBe(true)
  })

  it("registers generator endpoint", () => {
    const router = createConsoleAiWorkflowsRoutes()
    expect(router).toBeDefined()
  })
})
