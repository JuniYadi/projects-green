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
        onStepChange={onStepChange}
      />
    )

    const source = view.getByRole("button", { name: "Source Where is your code?" })
    const build = view.getByRole("button", { name: "Build How do we build it?" })
    const environment = view.getByRole("button", {
      name: "Environment Where does it run?",
    })

    expect(source).not.toBeDisabled()
    expect(build).not.toBeDisabled()
    expect(environment).toBeDisabled()

    fireEvent.click(source)
    expect(onStepChange).toHaveBeenCalledWith("source")
  })
})
