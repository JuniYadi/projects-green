import { describe, expect, it, mock } from "bun:test"
import { fireEvent, render } from "@testing-library/react"

import { DeployStepper } from "@/modules/deploy/ui/deploy-stepper"

describe("DeployStepper", () => {
  it("enables only unlocked steps and triggers onStepChange", () => {
    const onStepChange = mock(() => {})

    const view = render(
      <DeployStepper
        currentStep="build"
        maxUnlockedStep="build"
        sourceType="github"
        onStepChange={onStepChange}
      />
    )

    const source = view.getByRole("button", { name: /Source/i })
    const build = view.getByRole("button", { name: /Build/i })
    const environment = view.getByRole("button", { name: /Environment/i })

    expect(source).not.toBeDisabled()
    expect(build).not.toBeDisabled()
    expect(environment).toBeDisabled()

    fireEvent.click(source)
    expect(onStepChange).toHaveBeenCalledWith("source")
  })
})
