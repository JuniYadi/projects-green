"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

type SwitchProps = Omit<React.ComponentProps<"button">, "onChange"> & {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
}

function Switch({
  checked = false,
  onCheckedChange,
  className,
  onClick,
  ...props
}: SwitchProps) {
  return (
    <button
      {...props}
      type="button"
      role="switch"
      aria-checked={checked}
      data-state={checked ? "checked" : "unchecked"}
      className={cn(
        "inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent bg-input transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary",
        className
      )}
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented && !props.disabled) {
          onCheckedChange?.(!checked)
        }
      }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none block size-5 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-5"
        data-state={checked ? "checked" : "unchecked"}
      />
    </button>
  )
}

export { Switch }
