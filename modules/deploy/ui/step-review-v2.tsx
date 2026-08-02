import type { ComponentProps } from "react"

import { StepEnvironmentV2 } from "@/modules/deploy/ui/step-environment-v2"

export function StepReviewV2(props: ComponentProps<typeof StepEnvironmentV2>) {
  return (
    <div className="space-y-2">
      <div className="space-y-1 px-6 pt-6">
        <p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">
          Final review
        </p>
        <h2 className="text-xl font-bold">Review and deploy</h2>
        <p className="text-sm text-muted-foreground">
          Confirm build, environment, domain, and resource settings before
          launch.
        </p>
      </div>
      <StepEnvironmentV2 {...props} />
    </div>
  )
}
