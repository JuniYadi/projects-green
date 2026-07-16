import * as React from "react"
import { XIcon } from "@phosphor-icons/react"
import { Badge } from "@/components/ui/badge"

export interface FilterPill {
  id: string
  label: string
  color?: string | null
}

interface FilterPillsProps {
  pills: FilterPill[]
  onRemove: (id: string) => void
  className?: string
}

export function FilterPills({ pills, onRemove, className }: FilterPillsProps) {
  if (pills.length === 0) return null
  return (
    <div className={`flex flex-wrap gap-1.5 ${className ?? ""}`}>
      {pills.map((pill) => (
        <Badge
          key={pill.id}
          variant="secondary"
          className="flex items-center gap-1 px-2 py-0.5 text-xs"
          style={pill.color ? { backgroundColor: pill.color + "20", borderColor: pill.color } : undefined}
        >
          {pill.label}
          <button
            type="button"
            onClick={() => onRemove(pill.id)}
            className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
            aria-label={`Remove filter ${pill.label}`}
          >
            <XIcon className="size-3" />
          </button>
        </Badge>
      ))}
    </div>
  )
}
