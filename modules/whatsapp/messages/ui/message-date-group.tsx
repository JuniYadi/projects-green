import * as React from "react"

interface MessageDateGroupProps {
  label: string
}

export function MessageDateGroup({ label }: MessageDateGroupProps) {
  return (
    <div className="my-2 flex items-center justify-center">
      <span className="rounded-full bg-muted/80 px-3 py-0.5 text-[11px] font-medium text-muted-foreground shadow-2xs backdrop-blur">
        {label}
      </span>
    </div>
  )
}
