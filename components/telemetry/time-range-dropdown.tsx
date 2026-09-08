"use client"

import * as React from "react"
import {
  Clock,
  CaretDown,
  ArrowsClockwise,
  Globe,
  MagnifyingGlass,
  Check,
} from "@phosphor-icons/react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  type PredefinedTimeRange,
  type TimeRangeSelection,
  PRESET_LABELS,
  format24hDateTime,
} from "@/lib/time-range"

const PRESET_OPTIONS: PredefinedTimeRange[] = [
  "5m",
  "15m",
  "30m",
  "1h",
  "3h",
  "6h",
  "12h",
  "24h",
  "2d",
  "7d",
]

export type AutoRefreshInterval = false | 30_000 | 60_000 | 300_000

const REFRESH_OPTIONS: Array<{ label: string; value: AutoRefreshInterval }> = [
  { label: "Off", value: false },
  { label: "30s", value: 30_000 },
  { label: "1m", value: 60_000 },
  { label: "5m", value: 300_000 },
]

export type TimeRangeDropdownProps = {
  value: TimeRangeSelection
  onChange: (value: TimeRangeSelection) => void
  onRefresh?: () => void
  isFetching?: boolean
  refreshInterval?: AutoRefreshInterval
  onRefreshIntervalChange?: (interval: AutoRefreshInterval) => void
  disabled?: boolean
  className?: string
}

function toLocalIsoString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  const yyyy = date.getFullYear()
  const mm = pad(date.getMonth() + 1)
  const dd = pad(date.getDate())
  const hh = pad(date.getHours())
  const min = pad(date.getMinutes())
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`
}

export function TimeRangeDropdown({
  value,
  onChange,
  onRefresh,
  isFetching = false,
  refreshInterval = 30_000,
  onRefreshIntervalChange,
  disabled = false,
  className,
}: TimeRangeDropdownProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [fromInput, setFromInput] = React.useState("")
  const [toInput, setToInput] = React.useState("")
  const [validationError, setValidationError] = React.useState<string | null>(
    null
  )

  const userTimeZone = React.useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
    } catch {
      return "UTC"
    }
  }, [])

  const label = React.useMemo(() => {
    if (value.type === "preset") {
      return PRESET_LABELS[value.preset] ?? value.preset
    }
    const fromStr = format24hDateTime(value.from * 1000, userTimeZone)
    const toStr = format24hDateTime(value.to * 1000, userTimeZone)
    return `${fromStr} - ${toStr}`
  }, [value, userTimeZone])

  const initCustomInputs = React.useCallback(() => {
    if (value.type === "custom") {
      setFromInput(toLocalIsoString(new Date(value.from * 1000)))
      setToInput(toLocalIsoString(new Date(value.to * 1000)))
    } else {
      const now = new Date()
      const past = new Date(now.getTime() - 3600 * 1000)
      setFromInput(toLocalIsoString(past))
      setToInput(toLocalIsoString(now))
    }
    setValidationError(null)
  }, [value])

  const handleOpenChange = (open: boolean) => {
    if (open) {
      initCustomInputs()
      setSearch("")
    }
    setIsOpen(open)
  }

  const handleSelectPreset = (preset: PredefinedTimeRange) => {
    onChange({ type: "preset", preset })
    setIsOpen(false)
  }

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault()
    const fromDate = new Date(fromInput)
    const toDate = new Date(toInput)

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      setValidationError("Please select valid From and To dates.")
      return
    }

    if (fromDate.getTime() >= toDate.getTime()) {
      setValidationError("The 'From' time must be earlier than the 'To' time.")
      return
    }

    const startSec = Math.floor(fromDate.getTime() / 1000)
    const endSec = Math.floor(toDate.getTime() / 1000)

    onChange({ type: "custom", from: startSec, to: endSec })
    setIsOpen(false)
  }

  const filteredPresets = React.useMemo(() => {
    if (!search.trim()) return PRESET_OPTIONS
    const q = search.toLowerCase()
    return PRESET_OPTIONS.filter((p) =>
      PRESET_LABELS[p].toLowerCase().includes(q)
    )
  }, [search])

  const refreshIntervalLabel = React.useMemo(() => {
    const opt = REFRESH_OPTIONS.find((o) => o.value === refreshInterval)
    return opt?.label ?? "30s"
  }, [refreshInterval])

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {/* 1. Time Range Popover (Grafana Style) */}
      <Popover open={isOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="xs"
            disabled={disabled}
            className="h-7 gap-1.5 px-2.5 text-xs font-medium text-foreground hover:bg-muted/50"
            data-testid="time-range-trigger"
          >
            <Clock size={13} className="text-muted-foreground" />
            <span>{label}</span>
            <CaretDown size={11} className="text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          sideOffset={6}
          className="w-[520px] p-0 shadow-xl"
          data-testid="grafana-time-picker-popover"
        >
          <div className="flex flex-col divide-y divide-border/60 sm:flex-row sm:divide-x sm:divide-y-0">
            {/* Left Column: Absolute time range */}
            <form
              onSubmit={handleApplyCustom}
              className="flex flex-1 flex-col justify-between p-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">
                    Absolute time range
                  </span>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="time-range-from"
                    className="text-[11px] font-medium text-muted-foreground"
                  >
                    From
                  </label>
                  <Input
                    id="time-range-from"
                    type="datetime-local"
                    value={fromInput}
                    onChange={(e) => {
                      setFromInput(e.target.value)
                      setValidationError(null)
                    }}
                    className="h-8 font-mono text-xs"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="time-range-to"
                    className="text-[11px] font-medium text-muted-foreground"
                  >
                    To
                  </label>
                  <Input
                    id="time-range-to"
                    type="datetime-local"
                    value={toInput}
                    onChange={(e) => {
                      setToInput(e.target.value)
                      setValidationError(null)
                    }}
                    className="h-8 font-mono text-xs"
                    required
                  />
                </div>

                {validationError && (
                  <p className="text-[11px] text-destructive">
                    {validationError}
                  </p>
                )}

                <div className="flex gap-1.5 pt-1">
                  <Button
                    type="button"
                    variant="secondary"
                    size="xs"
                    onClick={() => {
                      const now = new Date()
                      setToInput(toLocalIsoString(now))
                    }}
                    className="h-6 text-[10px]"
                  >
                    Set To: Now
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="xs"
                    onClick={() => {
                      const now = new Date()
                      const todayStart = new Date(
                        now.getFullYear(),
                        now.getMonth(),
                        now.getDate(),
                        0,
                        0,
                        0
                      )
                      setFromInput(toLocalIsoString(todayStart))
                      setToInput(toLocalIsoString(now))
                    }}
                    className="h-6 text-[10px]"
                  >
                    Today
                  </Button>
                </div>
              </div>

              <div className="mt-4 space-y-3 border-t border-border/50 pt-3">
                <Button
                  type="submit"
                  size="sm"
                  className="h-8 w-full text-xs font-medium"
                >
                  Apply time range
                </Button>

                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <Globe size={12} className="shrink-0" />
                  <span className="truncate">
                    Browser Time: {userTimeZone} (24h)
                  </span>
                </div>
              </div>
            </form>

            {/* Right Column: Quick ranges */}
            <div className="flex w-full flex-col p-3 sm:w-56">
              <div className="relative mb-2">
                <MagnifyingGlass
                  size={12}
                  className="absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  placeholder="Search quick ranges..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-7 pl-7 text-xs"
                />
              </div>

              <div className="max-h-[260px] space-y-0.5 overflow-y-auto pr-1">
                {filteredPresets.map((preset) => {
                  const isSelected =
                    value.type === "preset" && value.preset === preset
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleSelectPreset(preset)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-accent hover:text-accent-foreground",
                        isSelected && "bg-accent/70 font-semibold text-primary"
                      )}
                    >
                      <span>{PRESET_LABELS[preset]}</span>
                      {isSelected && (
                        <Check size={13} className="text-primary" />
                      )}
                    </button>
                  )
                })}
                {filteredPresets.length === 0 && (
                  <p className="py-4 text-center text-xs text-muted-foreground">
                    No ranges match &ldquo;{search}&rdquo;
                  </p>
                )}
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* 2. Manual Refresh Button */}
      {onRefresh && (
        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={onRefresh}
          disabled={disabled || isFetching}
          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
          title="Refresh metrics now"
          data-testid="telemetry-refresh-button"
        >
          <ArrowsClockwise
            size={13}
            className={isFetching ? "animate-spin text-primary" : ""}
          />
        </Button>
      )}

      {/* 3. Auto-Refresh Rate Dropdown */}
      {onRefreshIntervalChange && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="xs"
              disabled={disabled}
              className="h-7 gap-1 px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
              title="Auto-refresh interval"
              data-testid="auto-refresh-trigger"
            >
              <span>{refreshIntervalLabel}</span>
              <CaretDown size={10} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-32">
            <DropdownMenuLabel className="text-[11px] text-muted-foreground">
              Auto refresh
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {REFRESH_OPTIONS.map((opt) => (
              <DropdownMenuItem
                key={opt.label}
                onClick={() => onRefreshIntervalChange(opt.value)}
                className="flex items-center justify-between text-xs"
              >
                <span>{opt.label}</span>
                {refreshInterval === opt.value && (
                  <Check size={13} className="text-primary" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
