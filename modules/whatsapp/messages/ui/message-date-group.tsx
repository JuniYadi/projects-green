import * as React from "react"

interface MessageDateGroupProps {
  label: string
}

export function MessageDateGroup({ label }: MessageDateGroupProps) {
  return (
    <div className="sticky top-0 z-10 flex items-center justify-center">
      <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
        {label}
      </span>
    </div>
  )
}
