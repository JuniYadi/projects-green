import { cn } from "@/lib/utils"
import { RESOURCE_PLANS } from "@/modules/deploy/deploy.mock"
import type { ResourcePlanId } from "@/modules/deploy/deploy.types"
import { PayAsYouGoSelector } from "./pay-as-you-go-selector"

type ResourcePlanSelectorProps = {
  selectedPlanId: ResourcePlanId
  cpu?: number
  memory?: number
  bufferHours?: number
  hourlyCost?: number
  onChange: (value: ResourcePlanId) => void
  onCpuChange?: (value: number) => void
  onMemoryChange?: (value: number) => void
  onBufferHoursChange?: (value: number) => void
}

export function ResourcePlanSelector({
  selectedPlanId,
  cpu,
  memory,
  bufferHours,
  hourlyCost,
  onChange,
  onCpuChange,
  onMemoryChange,
  onBufferHoursChange,
}: ResourcePlanSelectorProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {RESOURCE_PLANS.map((plan) => {
          const isSelected = plan.id === selectedPlanId

          return (
            <label
              key={plan.id}
              className={cn(
                "block cursor-pointer border p-3",
                isSelected
                  ? "border-primary bg-primary/10"
                  : "border-border bg-background"
              )}
            >
              <input
                type="radio"
                className="sr-only"
                name="resource-plan"
                checked={isSelected}
                onChange={() => onChange(plan.id)}
              />
              <p className="text-sm font-medium">{plan.name}</p>
              <p className="text-xs text-muted-foreground">
                {plan.description}
              </p>
            </label>
          )
        })}
      </div>

      {selectedPlanId === "payg" &&
        cpu !== undefined &&
        memory !== undefined &&
        onCpuChange &&
        onMemoryChange &&
        onBufferHoursChange && (
          <PayAsYouGoSelector
            cpu={cpu}
            memory={memory}
            bufferHours={bufferHours ?? 24}
            hourlyCost={hourlyCost}
            onCpuChange={onCpuChange}
            onMemoryChange={onMemoryChange}
            onBufferHoursChange={onBufferHoursChange}
          />
        )}
    </div>
  )
}
