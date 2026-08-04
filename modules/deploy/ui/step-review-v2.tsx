import type { ComponentProps } from "react"

import { StepEnvironmentV2 } from "@/modules/deploy/ui/step-environment-v2"

export function StepReviewV2(props: ComponentProps<typeof StepEnvironmentV2>) {
  return (
    <div className="space-y-2">
      <div className="space-y-1 px-6 pt-6">
        <p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">
          Final review
        </p>
        <h2 className="text-xl font-bold">
          Choose your web address &amp; plan
        </h2>
        <p className="text-sm text-muted-foreground">
          Use the recommended settings, or change them if you know what you
          need.
        </p>
      </div>
      <StepEnvironmentV2 {...props} />
    </div>
  )
}
