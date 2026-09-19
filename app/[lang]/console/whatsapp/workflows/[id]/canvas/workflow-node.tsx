"use client"

import React, { memo } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import {
  ChatCircleText,
  Question,
  Brain,
  GitBranch,
  Globe,
  SlidersHorizontal,
  Lightning,
  Trash,
  Robot,
  ArrowSquareOut,
  Headset,
  CreditCard,
} from "@phosphor-icons/react"
import type {
  WorkflowNodeType,
} from "@/modules/whatsapp/workflow/workflow.schema"

export type WorkflowCustomNodeData = {
  id: string
  name: string
  type: WorkflowNodeType
  config: Record<string, unknown>
  isSelected?: boolean
  onDelete?: (id: string) => void
}
const nodeTypeDetails: Record<
  WorkflowNodeType | "trigger",
  {
    icon: React.ElementType
    label: string
    color: string
    badgeClass: string
    subBadge?: string
  }
> = {
  trigger: {
    icon: Lightning,
    label: "Trigger",
    color: "border-amber-500/50 bg-amber-500/10 text-amber-500",
    badgeClass: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  },
  channel_redirect: {
    icon: ArrowSquareOut,
    label: "Pengalihan Web/Chat",
    color: "border-emerald-500/50 bg-emerald-500/10 text-emerald-400",
    badgeClass: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    subBadge: "Cost-Saving Offload",
  },
  cs_ticket_escalate: {
    icon: Headset,
    label: "Eskalasi Tiket & Telegram",
    color: "border-orange-500/50 bg-orange-500/10 text-orange-400",
    badgeClass: "bg-orange-500/20 text-orange-300 border-orange-500/30",
    subBadge: "Human Handover",
  },
  payment_link_dispatch: {
    icon: CreditCard,
    label: "Kirim Link Pembayaran",
    color: "border-teal-500/50 bg-teal-500/10 text-teal-400",
    badgeClass: "bg-teal-500/20 text-teal-300 border-teal-500/30",
    subBadge: "Single Utility",
  },
  send_message: {
    icon: ChatCircleText,
    label: "Kirim Pesan",
    color: "border-sky-500/50 bg-sky-500/10 text-sky-400",
    badgeClass: "bg-sky-500/20 text-sky-300 border-sky-500/30",
  },
  prompt_input: {
    icon: Question,
    label: "Tanya Input",
    color: "border-zinc-500/50 bg-zinc-500/10 text-zinc-400",
    badgeClass: "bg-zinc-500/20 text-zinc-300 border-zinc-500/30",
    subBadge: "Deprecated",
  },
  ai_generate: {
    icon: Brain,
    label: "AI Generate",
    color: "border-purple-500/50 bg-purple-500/10 text-purple-400",
    badgeClass: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  },
  condition: {
    icon: GitBranch,
    label: "Kondisi / If-Else",
    color: "border-amber-500/50 bg-amber-500/10 text-amber-400",
    badgeClass: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  },
  http_request: {
    icon: Globe,
    label: "HTTP Webhook / API",
    color: "border-pink-500/50 bg-pink-500/10 text-pink-400",
    badgeClass: "bg-pink-500/20 text-pink-300 border-pink-500/30",
  },
  send_interactive: {
    icon: SlidersHorizontal,
    label: "Tombol Interaktif",
    color: "border-indigo-500/50 bg-indigo-500/10 text-indigo-400",
    badgeClass: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
  },
}

export const WorkflowNodeComponent = memo(function WorkflowNodeComponent({
  data,
  selected,
}: NodeProps) {
  const nodeData = data as unknown as WorkflowCustomNodeData
  const type = nodeData.type || "send_message"
  const details = nodeTypeDetails[type] || nodeTypeDetails.send_message
  const Icon = details.icon

  // Summary preview from config
  let previewText = ""
  if (type === "send_message") {
    previewText = (nodeData.config?.text as string) || "Pesan WhatsApp..."
  } else if (type === "channel_redirect") {
    const ch = (nodeData.config?.targetChannel as string) || "WEB_LIVECHAT"
    const url = (nodeData.config?.redirectUrl as string) || "https://..."
    previewText = `Offload -> ${ch} (${url})`
  } else if (type === "cs_ticket_escalate") {
    const dept = (nodeData.config?.department as string) || "SUPPORT"
    const subj = (nodeData.config?.subject as string) || "Kendala Pengguna"
    previewText = `Tiket ${dept}: ${subj}`
  } else if (type === "payment_link_dispatch") {
    const gw = (nodeData.config?.gateway as string) || "MANUAL"
    const amtVar = (nodeData.config?.amountVariable as string) || "amount"
    previewText = `Bayar via ${gw} (var: ${amtVar})`
  } else if (type === "prompt_input") {
    previewText = (nodeData.config?.question as string) || "Pertanyaan..."
  } else if (type === "ai_generate") {
    previewText = (nodeData.config?.prompt as string) || "Prompt AI..."
  } else if (type === "condition") {
    const left = (nodeData.config?.leftOperand as string) || "var"
    const op = (nodeData.config?.operator as string) || "equals"
    const right = (nodeData.config?.rightOperand as string) || "val"
    previewText = `IF ${left} ${op} ${right}`
  } else if (type === "http_request") {
    const m = (nodeData.config?.method as string) || "GET"
    const u = (nodeData.config?.url as string) || "https://api..."
    previewText = `${m} ${u}`
  } else if (type === "send_interactive") {
    previewText = (nodeData.config?.bodyText as string) || "Pilihan tombol..."
  }

  const isCondition = type === "condition"

  return (
    <div
      className={`group relative max-w-[240px] min-w-[210px] rounded-xl border bg-card p-3 text-card-foreground shadow-md transition-all dark:bg-card/95 dark:shadow-xl ${
        selected
          ? "border-primary ring-2 shadow-primary/20 ring-primary/50"
          : "border-border/90 hover:border-border hover:shadow-lg dark:border-border/70 dark:hover:border-zinc-500"
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        id="target-top"
        className="!h-2.5 !w-2.5 !rounded-full !border-2 !border-background !bg-muted-foreground transition-all group-hover:!bg-primary"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="target-left"
        className="!h-2.5 !w-2.5 !rounded-full !border-2 !border-background !bg-muted-foreground transition-all group-hover:!bg-primary"
      />

      {/* Header with Quick Delete Button */}
      <div className="flex items-center justify-between gap-1.5 border-b border-border/50 pb-1.5">
        <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
          <div
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${details.color}`}
          >
            <Icon weight="duotone" className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <h4 className="truncate text-xs font-semibold tracking-tight">
              {nodeData.name}
            </h4>
            <span
              className={`py-0.2 inline-block rounded border px-1 text-[9px] font-medium tracking-wider uppercase ${details.badgeClass}`}
            >
              {details.subBadge || details.label}
            </span>
          </div>
        </div>

        {nodeData.onDelete && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              nodeData.onDelete?.(nodeData.id)
            }}
            className="shrink-0 rounded p-1 text-muted-foreground opacity-60 transition-opacity group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
            title="Delete node"
            aria-label="Delete node"
          >
            <Trash className="h-3 w-3" />
          </button>
        )}
      </div>
      <div className="mt-1.5 space-y-1">
        {Boolean(nodeData.config?.agentProfileName) && (
          <div className="flex items-center gap-1 rounded border border-purple-500/30 bg-purple-500/10 px-1.5 py-0.5 text-[9px] font-medium text-purple-400">
            <Robot className="h-3 w-3 shrink-0" weight="fill" />
            <span className="truncate">
              Template: {String(nodeData.config.agentProfileName)}
            </span>
          </div>
        )}
        <p className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">
          {previewText}
        </p>

        {Boolean(nodeData.config?.captureVariable) && (
          <div className="py-0.2 inline-flex items-center gap-1 rounded border border-border/40 bg-secondary/80 px-1.5 font-mono text-[9px] text-secondary-foreground">
            <span>save:</span>
            <span className="font-semibold text-primary">
              {String(nodeData.config.captureVariable)}
            </span>
          </div>
        )}
      </div>

      {/* Multi-Directional Source Handles */}
      {isCondition ? (
        <>
          {/* True Port (Right side) */}
          <Handle
            type="source"
            position={Position.Right}
            id="true"
            className="!h-2.5 !w-2.5 !rounded-full !border-2 !border-background !bg-emerald-500 transition-transform hover:scale-125"
          />
          {/* False Port (Bottom side) */}
          <Handle
            type="source"
            position={Position.Bottom}
            id="false"
            className="!h-2.5 !w-2.5 !rounded-full !border-2 !border-background !bg-rose-500 transition-transform hover:scale-125"
          />
        </>
      ) : (
        <>
          {/* Default Right Source */}
          <Handle
            type="source"
            position={Position.Right}
            id="default"
            className="!h-2.5 !w-2.5 !rounded-full !border-2 !border-background !bg-primary transition-all group-hover:scale-125"
          />
          {/* Default Bottom Source */}
          <Handle
            type="source"
            position={Position.Bottom}
            id="default-bottom"
            className="!h-2.5 !w-2.5 !rounded-full !border-2 !border-background !bg-primary transition-all group-hover:scale-125"
          />
        </>
      )}
    </div>
  )
})
