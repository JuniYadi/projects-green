"use client"

import * as React from "react"

import { Slider } from "@/components/ui/slider"

type ResourceType = "cpu" | "memory"

type ResourceSliderProps = {
  label: string
  resource: ResourceType
  value: number
  onChange: (value: number) => void
  priceEstimate?: string
}

const CPU_CONFIG = {
  min: 100,
  max: 2000,
  step: 100,
  unit: "mCPU",
}

const MEMORY_CONFIG = {
  min: 128,
  max: 8192,
  step: 128,
  unit: "MB",
}

function getResourceConfig(resource: ResourceType) {
  return resource === "cpu" ? CPU_CONFIG : MEMORY_CONFIG
}

export function ResourceSlider({
  label,
  resource,
  value,
  onChange,
  priceEstimate,
}: ResourceSliderProps) {
  const config = getResourceConfig(resource)

  const handleValueChange = (values: number[]) => {
    const newValue = values[0] ?? config.min
    onChange(newValue)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm font-mono">
          {value} {config.unit}
        </span>
      </div>
      <Slider
        value={[value]}
        min={config.min}
        max={config.max}
        step={config.step}
        onValueChange={handleValueChange}
 />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>
          {config.min} {config.unit}
        </span>
        <span>
          {config.max} {config.unit}
        </span>
      </div>
      {priceEstimate && (
        <span className="text-xs text-muted-foreground">
          Est. {priceEstimate}
        </span>
      )}
    </div>
  )
}
