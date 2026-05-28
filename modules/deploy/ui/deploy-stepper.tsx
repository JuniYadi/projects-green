import { cn } from "@/lib/utils"
import { DEPLOY_STEPS } from "@/modules/deploy/deploy.constants"
import type { DeploySourceType, DeployStep } from "@/modules/deploy/deploy.types"

type DeployStepperProps = {
  currentStep: DeployStep
  maxUnlockedStep: DeployStep
  sourceType: DeploySourceType
  onStepChange: (step: DeployStep) => void
}

export function DeployStepper({
  currentStep,
  maxUnlockedStep,
  sourceType,
  onStepChange,
}: DeployStepperProps) {
  const steps = DEPLOY_STEPS.filter(
    (step) => !(sourceType === "template" && step.id === "build")
  )

  const maxIndex = steps.findIndex((item) => item.id === maxUnlockedStep)

  return (
    <ol
      className={cn(
        "grid gap-3",
        steps.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-4"
      )}
      aria-label="Deploy wizard steps"
    >
      {steps.map((step, index) => {
        const isActive = step.id === currentStep
        const isUnlocked = index <= maxIndex

        return (
          <li key={step.id}>
            <button
              type="button"
              disabled={!isUnlocked}
              onClick={() => onStepChange(step.id)}
              className={cn(
                "w-full rounded-lg border p-4 text-left text-sm transition-all duration-200",
                isActive
                  ? "border-primary bg-primary/5 text-primary shadow-sm ring-1 ring-primary/30"
                  : isUnlocked
                    ? "border-border bg-background hover:bg-muted/50 cursor-pointer"
                    : "border-border bg-muted/10 opacity-50 cursor-not-allowed"
              )}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Step {index + 1}
              </p>
              <p className="font-semibold text-foreground text-sm">{step.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                {step.description}
              </p>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
