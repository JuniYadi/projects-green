"use client"

import React, { memo } from "react"
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from "@xyflow/react"
import { X } from "@phosphor-icons/react"

export type DeletableEdgeData = {
  onDelete?: (id: string) => void
  label?: string
}

export const DeletableEdge = memo(function DeletableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
  label,
  selected,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  const edgeData = data as DeletableEdgeData | undefined
  const displayLabel = label || edgeData?.label

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          ...style,
          strokeWidth: selected ? 3 : 2,
        }}
        markerEnd={markerEnd}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: "all",
          }}
          className="nodrag nopan flex items-center gap-1"
        >
          {displayLabel && (
            <span
              className={`rounded-full border px-1.5 py-0.5 font-mono text-[9px] font-bold shadow-xs ${
                displayLabel === "TRUE"
                  ? "border-emerald-500/30 bg-emerald-950/90 text-emerald-400"
                  : displayLabel === "FALSE"
                    ? "border-rose-500/30 bg-rose-950/90 text-rose-400"
                    : "border-zinc-700 bg-zinc-900/90 text-zinc-300"
              }`}
            >
              {displayLabel}
            </span>
          )}
          {edgeData?.onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                edgeData.onDelete?.(id)
              }}
              className="hover:text-destructive-foreground flex h-4 w-4 items-center justify-center rounded-full border border-border/80 bg-card/95 text-muted-foreground shadow-sm transition-all hover:scale-110 hover:border-destructive hover:bg-destructive"
              title="Delete edge"
              aria-label="Delete edge"
            >
              <X className="h-2.5 w-2.5" weight="bold" />
            </button>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  )
})
