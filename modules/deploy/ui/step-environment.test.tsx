import { describe, expect, it, mock } from "bun:test"
import { fireEvent, render } from "@testing-library/react"

import { StepEnvironment } from "@/modules/deploy/ui/step-environment"

const createProps = () => {
  return {
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
    onBack: mock(() => {}),
    onDeploy: mock(() => {}),
    onDomainToggleChange: mock(() => {}),
    onCustomDomainChange: mock(() => {}),
    onEnvVarsChange: mock(() => {}),
    onResourcePlanChange: mock(() => {}),
    onCpuChange: mock(() => {}),
    onMemoryChange: mock(() => {}),
  }
}

describe("StepEnvironment", () => {
  it("renders domain mode and ready summary", () => {
    const props = createProps()

    const view = render(<StepEnvironment {...props} />)

    expect(view.getByText("Domain Mode", { exact: true })).toBeTruthy()
    expect(view.getByText("Managed subdomain")).toBeTruthy()
    expect(view.getAllByText("Custom domain").length).toBeGreaterThan(0)
    expect(
      view.getByText("Preview domain: console-next-app.pfn.app")
    ).toBeTruthy()
    expect(view.getByText("Ready to deploy to", { exact: false })).toBeTruthy()
    expect(view.getByRole("button", { name: /Deploy/i })).toBeEnabled()
  })

  it("shows validation errors and disables deploy", () => {
    const props = createProps()
    props.useGeneratedSubdomain = false
    props.customDomain = "https://invalid.domain"
    props.hasMissingCustomDomain = false
    props.hasInvalidCustomDomain = true
    props.validationMessages = [
      "Enter a valid domain such as app.example.com.",
      "Environment variable keys must be unique.",
    ] as never[]
    props.canDeploy = false

    const view = render(<StepEnvironment {...props} />)

    expect(view.getByRole("alert")).toBeTruthy()
    expect(view.getByText("Environment settings need attention")).toBeTruthy()
    expect(
      view.getAllByText("Enter a valid domain such as", { exact: false }).length
    ).toBeGreaterThan(0)
    expect(
      view.getAllByText("Environment variable keys must be unique.").length
    ).toBeGreaterThan(0)
    expect(view.getByRole("button", { name: /Deploy/i })).toBeDisabled()
  })

  it("calls handlers for domain, plan, and deploy", () => {
    const props = createProps()

    const view = render(<StepEnvironment {...props} />)

    fireEvent.click(view.getByRole("radio", { name: /Custom domain/i }))
    expect(props.onDomainToggleChange).toHaveBeenCalledWith(false)

    fireEvent.click(view.getByRole("radio", { name: /Pro/i }))
    expect(props.onResourcePlanChange).toHaveBeenCalledWith("pro")

    fireEvent.click(view.getByRole("button", { name: /Deploy/i }))
    expect(props.onDeploy).toHaveBeenCalledTimes(1)
  })
})
