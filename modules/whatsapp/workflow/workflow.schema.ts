import { z } from "zod"

// ─── Trigger Schemas ────────────────────────────────────────────────────────

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

// ─── Node Config Schemas ────────────────────────────────────────────────────

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
  agentProfileId: z.string().optional(),
  agentProfileName: z.string().optional(),
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

export const ChannelRedirectNodeConfigSchema = z.object({
  targetChannel: z.enum(["WEB_LIVECHAT", "WEB_FORM", "TELEGRAM"]),
  redirectUrl: z.string(),
  message: z.string(),
  buttonText: z.string().default("Lanjutkan di Web"),
  includeContext: z.boolean().default(true),
})
export type ChannelRedirectNodeConfig = z.infer<
  typeof ChannelRedirectNodeConfigSchema
>

export const CsTicketEscalateNodeConfigSchema = z.object({
  department: z.string().default("SUPPORT"),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("HIGH"),
  subject: z.string(),
  description: z.string(),
  notifyTelegram: z.boolean().default(true),
  telegramChatId: z.string().optional(),
  autoReplyMessage: z.string().optional(),
})
export type CsTicketEscalateNodeConfig = z.infer<
  typeof CsTicketEscalateNodeConfigSchema
>

export const PaymentLinkDispatchNodeConfigSchema = z.object({
  gateway: z.enum(["MIDTRANS", "XENDIT", "MANUAL"]).default("MANUAL"),
  amountVariable: z.string(),
  orderIdVariable: z.string(),
  paymentUrl: z.string().optional(),
  buttonTitle: z.string().default("Bayar Sekarang"),
  fallbackText: z.string(),
})
export type PaymentLinkDispatchNodeConfig = z.infer<
  typeof PaymentLinkDispatchNodeConfigSchema
>

// ─── Node & Edge Definitions ────────────────────────────────────────────────

export const WorkflowNodeTypeSchema = z.enum([
  "prompt_input",
  "send_message",
  "send_interactive",
  "http_request",
  "ai_generate",
  "condition",
  "channel_redirect",
  "cs_ticket_escalate",
  "payment_link_dispatch",
])
export type WorkflowNodeType = z.infer<typeof WorkflowNodeTypeSchema>

export type WorkflowNodeMeta = {
  type: WorkflowNodeType
  label: string
  description: string
  category: "message" | "logic" | "action_handover" | "integration"
  deprecated?: boolean
  deprecationNotice?: string
  badgeText?: string
}

export const WORKFLOW_NODE_CATALOG: Record<
  WorkflowNodeType,
  WorkflowNodeMeta
> = {
  channel_redirect: {
    type: "channel_redirect",
    label: "Pengalihan Web/Chat",
    description:
      "Arahkan ke Web LiveChat/Form untuk hemat biaya percakapan Meta",
    category: "action_handover",
    badgeText: "Cost-Saving Offload",
  },
  cs_ticket_escalate: {
    type: "cs_ticket_escalate",
    label: "Eskalasi Tiket & Telegram",
    description:
      "Buat tiket CS internal di console dan kirim notifikasi Telegram",
    category: "action_handover",
    badgeText: "Human Handover",
  },
  payment_link_dispatch: {
    type: "payment_link_dispatch",
    label: "Kirim Link Pembayaran",
    description:
      "Kirim tombol link pembayaran tunggal berbiaya utilitas rendah",
    category: "action_handover",
    badgeText: "Single Utility",
  },
  send_message: {
    type: "send_message",
    label: "Kirim Pesan",
    description: "Kirim pesan teks atau media WhatsApp standar",
    category: "message",
  },
  prompt_input: {
    type: "prompt_input",
    label: "Tanya Input (Deprecated)",
    description:
      "Minta input teks pengguna (disarankan pakai channel_redirect)",
    category: "message",
    deprecated: true,
    deprecationNotice:
      "Input berulang di WhatsApp menaikkan biaya percakapan Meta. " +
      "Disarankan alihkan form panjang ke Web LiveChat via channel_redirect.",
  },
  send_interactive: {
    type: "send_interactive",
    label: "Tombol Interaktif",
    description: "Kirim tombol pilihan atau menu opsi cepat",
    category: "message",
  },
  condition: {
    type: "condition",
    label: "Kondisi / If-Else",
    description: "Percabangan alur logika percakapan",
    category: "logic",
  },
  ai_generate: {
    type: "ai_generate",
    label: "AI Generate",
    description: "Respons cerdas menggunakan model AI atau Knowledge Agent",
    category: "integration",
  },
  http_request: {
    type: "http_request",
    label: "HTTP Webhook / API",
    description: "Kirim atau ambil data dari webhook/API eksternal",
    category: "integration",
  },
}

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

// ─── Full Workflow Definition Schema ────────────────────────────────────────

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

// ─── Session State & Context ────────────────────────────────────────────────

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
