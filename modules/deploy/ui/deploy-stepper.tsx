import { cn } from "@/lib/utils"
import { DEPLOY_STEPS } from "@/modules/deploy/deploy.constants"
import type { DeployStep } from "@/modules/deploy/deploy.types"

type DeployStepperProps = {
  currentStep: DeployStep
  maxUnlockedStep: DeployStep
  onStepChange: (step: DeployStep) => void
}

const getStepIndex = (step: DeployStep) => {
  return DEPLOY_STEPS.findIndex((item) => item.id === step)
}

export function DeployStepper({
  currentStep,
  maxUnlockedStep,
  onStepChange,
}: DeployStepperProps) {
  const maxIndex = getStepIndex(maxUnlockedStep)

  return (
    <ol className="grid gap-2 sm:grid-cols-4" aria-label="Deploy wizard steps">
      {DEPLOY_STEPS.map((step, index) => {
        const isActive = step.id === currentStep
        const isUnlocked = index <= maxIndex

        return (
          <li key={step.id}>
            <button
              type="button"
              disabled={!isUnlocked}
              onClick={() => onStepChange(step.id)}
              className={cn(
                "w-full border px-4 py-3 text-left text-sm rounded-md",
                isActive
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background",
                !isUnlocked && "cursor-not-allowed opacity-50"
              )}
            >
              <p className="font-medium">{step.label}</p>
              <p className="text-muted-foreground">{step.description}</p>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
