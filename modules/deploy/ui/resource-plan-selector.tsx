import { cn } from "@/lib/utils"
import { RESOURCE_PLANS } from "@/modules/deploy/deploy.mock"
import type { ResourcePlanId } from "@/modules/deploy/deploy.types"

type ResourcePlanSelectorProps = {
  selectedPlanId: ResourcePlanId
  onChange: (value: ResourcePlanId) => void
}

export function ResourcePlanSelector({
  selectedPlanId,
  onChange,
}: ResourcePlanSelectorProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
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
            <p className="text-xs text-muted-foreground">{plan.description}</p>
          </label>
        )
      })}
    </div>
  )
}
