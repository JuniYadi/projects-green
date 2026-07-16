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
  recommendedPlanId?: ResourcePlanId | null
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
  recommendedPlanId,
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
          const isRecommended = plan.id === recommendedPlanId

          return (
            <label
              key={plan.id}
              className={cn(
                "relative block cursor-pointer border p-3",
                isSelected
                  ? "border-primary bg-primary/10"
                  : "border-border bg-background",
                isRecommended && !isSelected && "border-amber-400/60"
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
              {isRecommended ? (
                <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                  AI recommended
                </span>
              ) : null}
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
