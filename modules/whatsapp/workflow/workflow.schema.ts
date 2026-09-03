import { z } from "zod"

// ─── Trigger Schemas ──────────────────────────────────────────────────────────

export const WorkflowTriggerTypeSchema = z.enum([
  "whatsapp_inbound",
  "keyword_match",
  "button_payload",
  "webhook_event",
])
export type WorkflowTriggerType = z.infer<typeof WorkflowTriggerTypeSchema>

export const WorkflowTriggerSchema = z.object({
  id: z.string(),
  type: WorkflowTriggerTypeSchema,
  keywords: z.array(z.string()).default([]),
  description: z.string().optional(),
})
export type WorkflowTrigger = z.infer<typeof WorkflowTriggerSchema>

// ─── Node Config Schemas ──────────────────────────────────────────────────────

export const PromptInputNodeConfigSchema = z.object({
  question: z.string(),
  captureVariable: z.string(),
  validation: z
    .object({
      type: z.enum(["text", "number", "regex", "email"]).default("text"),
      pattern: z.string().optional(),
      errorMessage: z.string().optional(),
    })
    .optional(),
})
export type PromptInputNodeConfig = z.infer<typeof PromptInputNodeConfigSchema>

export const SendMessageNodeConfigSchema = z.object({
  messageType: z.enum(["text", "image", "document"]).default("text"),
  text: z.string().optional(),
  mediaUrl: z.string().optional(),
  filename: z.string().optional(),
  caption: z.string().optional(),
})
export type SendMessageNodeConfig = z.infer<typeof SendMessageNodeConfigSchema>

export const SendInteractiveNodeConfigSchema = z.object({
  interactiveType: z.enum(["button", "list"]).default("button"),
  headerText: z.string().optional(),
  bodyText: z.string(),
  footerText: z.string().optional(),
  buttons: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        payload: z.string().optional(),
      })
    )
    .max(3)
    .optional(),
  listSections: z
    .array(
      z.object({
        title: z.string(),
        rows: z.array(
          z.object({
            id: z.string(),
            title: z.string(),
            description: z.string().optional(),
          })
        ),
      })
    )
    .optional(),
})
export type SendInteractiveNodeConfig = z.infer<
  typeof SendInteractiveNodeConfigSchema
>

export const HttpRequestNodeConfigSchema = z.object({
  url: z.string(),
  method: z.enum(["GET", "POST", "PUT", "DELETE"]).default("GET"),
  headers: z.record(z.string(), z.string()).optional(),
  bodyJson: z.record(z.string(), z.unknown()).optional(),
  forwardContext: z.boolean().default(false),
  timeoutMs: z.number().int().positive().default(5000),
})
export type HttpRequestNodeConfig = z.infer<typeof HttpRequestNodeConfigSchema>

export const AiGenerateNodeConfigSchema = z.object({
  prompt: z.string(),
  systemPrompt: z.string().optional(),
  captureVariable: z.string(),
  providerId: z.string().optional(),
  model: z.string().optional(),
  sendReply: z.boolean().default(false),
})
export type AiGenerateNodeConfig = z.infer<typeof AiGenerateNodeConfigSchema>

export const ConditionNodeConfigSchema = z.object({
  leftOperand: z.string(),
  operator: z.enum([
    "equals",
    "not_equals",
    "contains",
    "greater_than",
    "less_than",
  ]),
  rightOperand: z.string(),
})
export type ConditionNodeConfig = z.infer<typeof ConditionNodeConfigSchema>

// ─── Node & Edge Definitions ──────────────────────────────────────────────────

export const WorkflowNodeTypeSchema = z.enum([
  "prompt_input",
  "send_message",
  "send_interactive",
  "http_request",
  "ai_generate",
  "condition",
])
export type WorkflowNodeType = z.infer<typeof WorkflowNodeTypeSchema>

export const WorkflowNodePositionSchema = z.object({
  x: z.number(),
  y: z.number(),
})
export type WorkflowNodePosition = z.infer<typeof WorkflowNodePositionSchema>

export const WorkflowNodeSchema = z.object({
  id: z.string(),
  type: WorkflowNodeTypeSchema,
  name: z.string(),
  config: z.record(z.string(), z.unknown()),
  position: WorkflowNodePositionSchema.optional(),
})
export type WorkflowNode = z.infer<typeof WorkflowNodeSchema>

export const WorkflowEdgeSchema = z.object({
  id: z.string(),
  sourceNodeId: z.string(),
  sourcePort: z
    .enum(["default", "success", "error", "true", "false"])
    .or(z.string())
    .default("default"),
  targetNodeId: z.string(),
})
export type WorkflowEdge = z.infer<typeof WorkflowEdgeSchema>

// ─── Full Workflow Definition Schema ──────────────────────────────────────────

export const WorkflowDefinitionSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().optional().default(false),
  trigger: WorkflowTriggerSchema,
  nodes: z.array(WorkflowNodeSchema),
  edges: z.array(WorkflowEdgeSchema),
  version: z.number().int().default(1),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})
export type WorkflowDefinition = z.infer<typeof WorkflowDefinitionSchema>

// ─── Session State & Context ──────────────────────────────────────────────────

export const WorkflowSessionStateSchema = z.object({
  sessionId: z.string(),
  organizationId: z.string(),
  phoneNumber: z.string(),
  workflowId: z.string(),
  currentNodeId: z.string().nullable(),
  variables: z.record(z.string(), z.unknown()).default({}),
  stepOutputs: z.record(z.string(), z.unknown()).default({}),
  status: z.enum(["ACTIVE", "PAUSED", "COMPLETED", "FAILED"]).default("ACTIVE"),
  updatedAt: z.string(),
})
export type WorkflowSessionState = z.infer<typeof WorkflowSessionStateSchema>
