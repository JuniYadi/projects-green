"use client"

import { cn } from "@/lib/utils"
import { DEPLOY_STEPS } from "@/modules/deploy/deploy.constants"
import type {
  DeploySourceType,
  DeployStep,
} from "@/modules/deploy/deploy.types"
import { CheckIcon } from "@/components/ui/phosphor-icons"

type DeployTimelineV2Props = {
  currentStep: DeployStep
  maxUnlockedStep: DeployStep
  sourceType: DeploySourceType
  onStepChange: (step: DeployStep) => void
}

export function DeployTimelineV2({
  currentStep,
  maxUnlockedStep,
  sourceType,
  onStepChange,
}: DeployTimelineV2Props) {
  const steps = DEPLOY_STEPS.filter(
    (step) => !(sourceType === "template" && step.id === "build")
  )

  const maxIndex = steps.findIndex((item) => item.id === maxUnlockedStep)

  return (
    <nav aria-label="Deploy wizard steps" className="flex flex-col gap-0">
      {steps.map((step, index) => {
        const isActive = step.id === currentStep
        const isCompleted = index < maxIndex || step.id === maxUnlockedStep
        const isUnlocked = index <= maxIndex

        return (
          <div key={step.id} className="flex items-stretch">
            {index > 0 && (
              <div
                className={cn(
                  "ml-4 w-px shrink-0",
                  isCompleted || isActive ? "bg-primary" : "bg-border"
                )}
                style={{ minHeight: "1rem" }}
              />
            )}

            <button
              type="button"
              disabled={!isUnlocked}
              onClick={() => onStepChange(step.id)}
              className={cn(
                "flex w-full min-w-0 items-center gap-3 rounded-lg px-2 py-3 text-left transition-all duration-200",
                isActive
                  ? "bg-primary/5 text-primary"
                  : isUnlocked
                    ? "text-foreground hover:bg-muted/50"
                    : "cursor-not-allowed text-muted-foreground opacity-50"
              )}
            >
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors",
                  isActive
                    ? "border-primary bg-primary text-primary-foreground"
                    : isCompleted
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground"
                )}
              >
                {isCompleted ? <CheckIcon className="h-4 w-4" /> : index + 1}
              </span>

              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block text-sm leading-tight font-semibold",
                    isActive
                      ? "text-primary"
                      : isUnlocked
                        ? "text-foreground"
                        : "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
                <span className="block text-xs leading-tight text-muted-foreground">
                  {step.description}
                </span>
              </span>
            </button>
          </div>
        )
      })}
    </nav>
  )
}
