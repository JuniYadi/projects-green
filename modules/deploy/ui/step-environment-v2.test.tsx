import { describe, expect, it, mock } from "bun:test"
import { fireEvent, render } from "@testing-library/react"
import type { ComponentProps } from "react"

import { StepEnvironmentV2 } from "@/modules/deploy/ui/step-environment-v2"
import { StepReviewV2 } from "@/modules/deploy/ui/step-review-v2"

type TestProps = ComponentProps<typeof StepEnvironmentV2>

const createProps = (): TestProps => ({
  generatedSubdomain: "console-next-app.pfn.app",
  useGeneratedSubdomain: true,
  customDomain: "",
  environmentId: "staging",
  envVars: [],
  resourcePlanId: "starter" as const,
  cpu: 100,
  memory: 256,
  hasMissingCustomDomain: false,
  hasInvalidCustomDomain: false,
  validationMessages: [],
  canDeploy: true,
  isSubmitting: false,
  submitError: null,
  onBack: mock(() => {}),
  onDeploy: mock(() => {}),
  onDomainToggleChange: mock(() => {}),
  onCustomDomainChange: mock(() => {}),
  onEnvVarsChange: mock(() => {}),
  onResourcePlanChange: mock(() => {}),
  onCpuChange: mock(() => {}),
  onMemoryChange: mock(() => {}),
  sourceType: "github" as const,
  buildState: {
    language: "Node.js",
    framework: "Next.js",
    buildCommand: "npm run build",
    useDockerfile: false,
  },
  onEditBuildSettings: mock(() => {}),
  recommendedPlanId: "starter" as const,
})

describe("StepReviewV2", () => {
  it("uses outcome-led review heading and copy", () => {
    const view = render(<StepReviewV2 {...createProps()} />)

    expect(
      view.getByRole("heading", { name: "Choose your web address & plan" })
    ).toBeTruthy()
    expect(
      view.getByText(
        "Use the recommended settings, or change them if you know what you need."
      )
    ).toBeTruthy()
  })
})

describe("StepEnvironmentV2", () => {
  it("shows generated web address and recommended hosting plan by default", () => {
    const view = render(<StepEnvironmentV2 {...createProps()} />)

    expect(view.getByText("Web address")).toBeTruthy()
    expect(view.getByText("Use a free pfn.app address")).toBeTruthy()
    expect(view.getByText("Recommended")).toBeTruthy()
    expect(view.getByText("Use my own address")).toBeTruthy()
    expect(view.getByText("console-next-app.pfn.app")).toBeTruthy()
    expect(view.getByText("Hosting plan")).toBeTruthy()
    expect(view.getByText("Recommended for this site")).toBeTruthy()
    expect(
      view.getByRole("radio", { name: /^Use a free pfn.app address/ })
    ).toBeChecked()
  })

  it("keeps advanced settings collapsed until opened", () => {
    const view = render(<StepEnvironmentV2 {...createProps()} />)
    const details = view.container.querySelector("details")

    expect(details).toBeTruthy()
    expect(details).not.toHaveAttribute("open")
    expect(view.queryByText("Build Configuration")).not.toBeVisible()
    expect(view.queryByText("Environment Variables")).not.toBeVisible()
  })

  it("opens advanced settings for hidden-field validation, not custom-domain validation", () => {
    const customDomainProps = createProps()
    customDomainProps.useGeneratedSubdomain = false
    customDomainProps.hasInvalidCustomDomain = true
    customDomainProps.validationMessages = [
      "Enter a valid domain such as app.example.com.",
    ]
    customDomainProps.canDeploy = false

    const customDomainView = render(
      <StepEnvironmentV2 {...customDomainProps} />
    )
    const customDomainDetails =
      customDomainView.container.querySelector("details")

    expect(customDomainDetails).not.toHaveAttribute("open")
    expect(
      customDomainView.getByText("Enter a valid domain such as", {
        exact: false,
      })
    ).toBeTruthy()
    customDomainView.unmount()

    const hiddenFieldProps = createProps()
    hiddenFieldProps.validationMessages = [
      "Environment variable keys must be unique.",
    ]
    hiddenFieldProps.canDeploy = false

    const hiddenFieldView = render(<StepEnvironmentV2 {...hiddenFieldProps} />)
    const hiddenFieldDetails =
      hiddenFieldView.container.querySelector("details")

    expect(hiddenFieldDetails).toHaveAttribute("open")
    expect(
      hiddenFieldView.getByText("Environment settings need attention")
    ).toBeTruthy()
    expect(
      hiddenFieldView.getByText("Environment variable keys must be unique.")
    ).toBeTruthy()
  })

  it("retains starter, pro, and pay-as-you-go plan callbacks", () => {
    const props = createProps()
    const view = render(<StepEnvironmentV2 {...props} />)

    fireEvent.click(view.getByRole("radio", { name: /Pro/ }))
    fireEvent.click(view.getByRole("radio", { name: /Pay As You Go/ }))
    expect(props.onResourcePlanChange).toHaveBeenNthCalledWith(1, "pro")
    expect(props.onResourcePlanChange).toHaveBeenNthCalledWith(2, "payg")
    view.unmount()

    const starterProps = createProps()
    starterProps.resourcePlanId = "pro"
    const starterView = render(<StepEnvironmentV2 {...starterProps} />)
    fireEvent.click(starterView.getByRole("radio", { name: /^Starter/ }))

    expect(props.onResourcePlanChange).toHaveBeenNthCalledWith(1, "pro")
    expect(props.onResourcePlanChange).toHaveBeenNthCalledWith(2, "payg")
    expect(starterProps.onResourcePlanChange).toHaveBeenCalledWith("starter")
  })

  it("shows publish readiness and submits once", () => {
    const props = createProps()
    const view = render(<StepEnvironmentV2 {...props} />)

    expect(view.getByText("Ready to publish at", { exact: false })).toBeTruthy()
    const publishButton = view.getByRole("button", { name: "Publish site" })
    expect(publishButton).toBeEnabled()

    fireEvent.click(publishButton)
    expect(props.onDeploy).toHaveBeenCalledTimes(1)
  })

  it("preserves submit error and submitting state", () => {
    const props = createProps()
    props.isSubmitting = true
    props.submitError = "The deployment service is busy."

    const view = render(<StepEnvironmentV2 {...props} />)

    expect(view.getByText("Unable to start deployment")).toBeTruthy()
    expect(view.getByText("The deployment service is busy.")).toBeTruthy()
    expect(
      view.getByRole("button", { name: "Publishing site…" })
    ).toBeDisabled()
  })
})
