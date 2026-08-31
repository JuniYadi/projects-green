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
} from "@phosphor-icons/react"
import type { WorkflowNodeType } from "@/modules/whatsapp/workflow/workflow.schema"

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
      className={`group relative max-w-[230px] min-w-[200px] rounded-xl border bg-card/95 p-2.5 text-card-foreground shadow-md backdrop-blur transition-all ${
        selected
          ? "border-primary ring-2 shadow-primary/10 ring-primary/40"
          : "border-border/80 hover:border-border hover:shadow-sm"
      }`}
    >
      {/* Multi-Directional Target Handles (Top + Left) */}
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
              {details.label}
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
            title="Hapus node"
          >
            <Trash className="h-3 w-3" />
          </button>
        )}
      </div>
      <div className="mt-1.5 space-y-1">
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
