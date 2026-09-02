import { describe, expect, it } from "bun:test"
import { WORKFLOW_TEMPLATES } from "./workflow-templates"
import { WorkflowDefinitionSchema } from "./workflow.schema"

describe("workflow-templates", () => {
  it("exports the starter templates", () => {
    expect(WORKFLOW_TEMPLATES).toHaveLength(4)
    expect(WORKFLOW_TEMPLATES.map((template) => template.id)).toEqual([
      "template_customer_support",
      "template_ai_sales_catalog",
      "template_order_tracking",
      "template_lead_qualification",
    ])
  })

  it("provides valid workflow definitions with positioned nodes", () => {
    for (const template of WORKFLOW_TEMPLATES) {
      expect(template.titleKey).toBeTruthy()
      expect(template.descKey).toBeTruthy()
      expect(["support", "sales", "utility"]).toContain(template.category)

      const parsed = WorkflowDefinitionSchema.safeParse(template.workflow)
      expect(parsed.success).toBe(true)

      const nodeIds = new Set<string>()
      for (const node of template.workflow.nodes) {
        expect(nodeIds.has(node.id)).toBe(false)
        nodeIds.add(node.id)
        expect(node.position).toBeDefined()
        expect(Number.isFinite(node.position?.x)).toBe(true)
        expect(Number.isFinite(node.position?.y)).toBe(true)
        expect(Object.keys(node.config).length).toBeGreaterThan(0)
      }

      const edgeIds = new Set<string>()
      for (const edge of template.workflow.edges) {
        expect(edgeIds.has(edge.id)).toBe(false)
        edgeIds.add(edge.id)
        expect(nodeIds.has(edge.sourceNodeId)).toBe(true)
        expect(nodeIds.has(edge.targetNodeId)).toBe(true)
      }
    }
  })
})
