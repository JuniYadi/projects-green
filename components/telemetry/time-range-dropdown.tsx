"use client"

import * as React from "react"
import { Clock, CaretDown, Calendar, Check } from "@phosphor-icons/react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  PredefinedTimeRange,
  TimeRangeSelection,
  PRESET_LABELS,
  format24hDateTime,
  resolveTimeRangeBounds,
} from "@/lib/time-range"
import { cn } from "@/lib/utils"

export type TimeRangeDropdownProps = {
  value: TimeRangeSelection
  onChange: (value: TimeRangeSelection) => void
  disabled?: boolean
  className?: string
}

const PRESET_OPTIONS: PredefinedTimeRange[] = [
  "5m",
  "15m",
  "30m",
  "1h",
  "6h",
  "24h",
  "7d",
]

function toDatetimeLocalString(timestampMs: number): string {
  const d = new Date(timestampMs)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  const hours = String(d.getHours()).padStart(2, "0")
  const minutes = String(d.getMinutes()).padStart(2, "0")
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

export function TimeRangeDropdown({
  value,
  onChange,
  disabled = false,
  className,
}: TimeRangeDropdownProps) {
  const [isCustomOpen, setIsCustomOpen] = React.useState(false)
  const [fromInput, setFromInput] = React.useState("")
  const [toInput, setToInput] = React.useState("")

  const userTimeZone = React.useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
    } catch {
      return "UTC"
    }
  }, [])

  const openCustomDialog = React.useCallback(() => {
    if (value.type === "custom") {
      setFromInput(toDatetimeLocalString(value.from * 1000))
      setToInput(toDatetimeLocalString(value.to * 1000))
    } else {
      const bounds = resolveTimeRangeBounds(value)
      setFromInput(toDatetimeLocalString(bounds.startSeconds * 1000))
      setToInput(toDatetimeLocalString(bounds.endSeconds * 1000))
    }
    setIsCustomOpen(true)
  }, [value])

  const label =
    value.type === "preset"
      ? PRESET_LABELS[value.preset]
      : `${format24hDateTime(value.from * 1000)} - ${format24hDateTime(value.to * 1000)}`

  const isValidCustomRange = React.useMemo(() => {
    if (!fromInput || !toInput) return false
    const startMs = new Date(fromInput).getTime()
    const endMs = new Date(toInput).getTime()
    return !isNaN(startMs) && !isNaN(endMs) && startMs <= endMs
  }, [fromInput, toInput])

  const handleApplyCustom = () => {
    if (!isValidCustomRange) return
    const startSec = Math.floor(new Date(fromInput).getTime() / 1000)
    const endSec = Math.floor(new Date(toInput).getTime() / 1000)
    onChange({ type: "custom", from: startSec, to: endSec })
    setIsCustomOpen(false)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="xs"
            disabled={disabled}
            className={cn("h-7 gap-1.5 px-2.5 text-xs", className)}
          >
            <Clock size={13} />
            <span>{label}</span>
            <CaretDown size={11} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="text-xs">
            Quick presets
          </DropdownMenuLabel>
          {PRESET_OPTIONS.map((preset) => {
            const isSelected =
              value.type === "preset" && value.preset === preset
            return (
              <DropdownMenuItem
                key={preset}
                onClick={() => onChange({ type: "preset", preset })}
                onSelect={() => onChange({ type: "preset", preset })}
                className="flex items-center justify-between text-xs"
              >
                <span>{PRESET_LABELS[preset]}</span>
                {isSelected && <Check size={14} className="ml-auto" />}
              </DropdownMenuItem>
            )
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={openCustomDialog}
            onSelect={openCustomDialog}
            className="flex items-center gap-2 text-xs"
          >
            <Calendar size={13} />
            <span>Custom range...</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={isCustomOpen}
        onOpenChange={(open) => {
          if (open) {
            openCustomDialog()
          } else {
            setIsCustomOpen(false)
          }
        }}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Select Custom Time Range</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <label
                htmlFor="time-range-from"
                className="text-xs font-medium text-foreground"
              >
                From
              </label>
              <input
                id="time-range-from"
                type="datetime-local"
                value={fromInput}
                onChange={(e) => setFromInput(e.target.value)}
                className="flex h-8 w-full rounded-lg border border-input bg-background px-3 py-1 text-xs shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <div className="grid gap-1.5">
              <label
                htmlFor="time-range-to"
                className="text-xs font-medium text-foreground"
              >
                To
              </label>
              <input
                id="time-range-to"
                type="datetime-local"
                value={toInput}
                onChange={(e) => setToInput(e.target.value)}
                className="flex h-8 w-full rounded-lg border border-input bg-background px-3 py-1 text-xs shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Local 24-hour time ({userTimeZone})
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCustomOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!isValidCustomRange}
              onClick={handleApplyCustom}
            >
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default TimeRangeDropdown
