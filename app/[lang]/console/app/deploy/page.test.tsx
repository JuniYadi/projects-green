import { describe, expect, it, mock } from "bun:test"
import { render } from "@testing-library/react"

mock.module("@/modules/deploy/ui/deploy-wizard", () => {
  return {
    DeployWizard: () => <div>Deploy Wizard Mock</div>,
  }
})

describe("DeployPage", () => {
  it("renders deploy wizard", async () => {
    const deployPageModule =
      await import("@/app/[lang]/console/app/deploy/page")
    const view = render(<deployPageModule.default />)

    expect(view.getByText("Deploy Wizard Mock")).toBeTruthy()
  })
})
