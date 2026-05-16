import { describe, expect, it, mock } from "bun:test"
import { render } from "@testing-library/react"

mock.module("@/modules/deploy/ui/deploy-wizard", () => {
  return {
    DeployWizard: () => <div>Deploy Wizard Mock</div>,
  }
})

describe("DeployPage", () => {
  it("renders deploy wizard inside page content container", async () => {
    const deployPageModule = await import("@/app/console/app/deploy/page")
    const view = render(<deployPageModule.default />)

    const main = view.container.querySelector("main")

    expect(main).toBeTruthy()
    expect(main?.className).toContain("max-w-5xl")
    expect(view.getByText("Deploy Wizard Mock")).toBeTruthy()
  })
})
