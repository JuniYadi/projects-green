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
} from "@phosphor-icons/react"
import type { WorkflowNodeType } from "@/modules/whatsapp/workflow/workflow.schema"

export type WorkflowCustomNodeData = {
  id: string
  name: string
  type: WorkflowNodeType
  config: Record<string, unknown>
  isSelected?: boolean
}

const nodeTypeDetails: Record<
  WorkflowNodeType | "trigger",
  {
    icon: React.ElementType
    label: string
    color: string
    badgeClass: string
  }
> = {
  trigger: {
    icon: Lightning,
    label: "Trigger",
    color: "border-amber-500/50 bg-amber-500/10 text-amber-500",
    badgeClass: "bg-amber-500/20 text-amber-300 border-amber-500/30",
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
    color: "border-emerald-500/50 bg-emerald-500/10 text-emerald-400",
    badgeClass: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
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
    previewText = `${(nodeData.config?.method as string) || "GET"} ${(nodeData.config?.url as string) || "https://api..."}`
  } else if (type === "send_interactive") {
    previewText = (nodeData.config?.bodyText as string) || "Pilihan tombol..."
  }

  const isCondition = type === "condition"

  return (
    <div
      className={`group relative max-w-[320px] min-w-[280px] rounded-xl border bg-card/95 p-4 text-card-foreground shadow-lg backdrop-blur transition-all ${
        selected
          ? "border-primary ring-2 shadow-primary/10 ring-primary/40"
          : "border-border/80 hover:border-border hover:shadow-md"
      }`}
    >
      {/* Target input handle at Top */}
      <Handle
        type="target"
        position={Position.Top}
        className="!h-3 !w-3 !rounded-full !border-2 !border-background !bg-muted-foreground transition-all group-hover:!bg-primary"
      />

      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-2.5">
        <div className="flex items-center gap-2 overflow-hidden">
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${details.color}`}
          >
            <Icon weight="duotone" className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h4 className="truncate text-sm font-semibold tracking-tight">
              {nodeData.name}
            </h4>
            <span
              className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium tracking-wider uppercase ${details.badgeClass}`}
            >
              {details.label}
            </span>
          </div>
        </div>
      </div>

      {/* Body preview */}
      <div className="mt-3 space-y-1.5">
        <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {previewText}
        </p>

        {nodeData.config?.captureVariable && (
          <div className="inline-flex items-center gap-1 rounded border border-border/40 bg-secondary/80 px-2 py-0.5 font-mono text-[10px] text-secondary-foreground">
            <span>save:</span>
            <span className="font-semibold text-primary">
              {String(nodeData.config.captureVariable)}
            </span>
          </div>
        )}
      </div>

      {/* Output handles */}
      {isCondition ? (
        <div className="mt-4 flex items-center justify-between border-t border-border/40 pt-2.5 text-[11px] font-medium">
          {/* True Port (Left/Green) */}
          <div className="relative flex items-center gap-1 text-emerald-400">
            <Handle
              type="source"
              position={Position.Bottom}
              id="true"
              style={{ left: "25%" }}
              className="!h-3 !w-3 !rounded-full !border-2 !border-background !bg-emerald-500 transition-transform hover:scale-125"
            />
            <span className="ml-1 font-mono text-[10px] font-bold">TRUE</span>
          </div>

          {/* False Port (Right/Rose) */}
          <div className="relative flex items-center gap-1 text-rose-400">
            <span className="mr-1 font-mono text-[10px] font-bold">FALSE</span>
            <Handle
              type="source"
              position={Position.Bottom}
              id="false"
              style={{ left: "75%" }}
              className="!h-3 !w-3 !rounded-full !border-2 !border-background !bg-rose-500 transition-transform hover:scale-125"
            />
          </div>
        </div>
      ) : (
        <div className="mt-3 flex justify-center">
          <Handle
            type="source"
            position={Position.Bottom}
            id="default"
            className="!h-3 !w-3 !rounded-full !border-2 !border-background !bg-primary transition-all group-hover:scale-125"
          />
        </div>
      )}
    </div>
  )
})
