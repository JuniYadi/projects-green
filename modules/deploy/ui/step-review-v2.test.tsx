import { describe, expect, it, mock } from "bun:test"
import { render } from "@testing-library/react"

import { StepReviewV2 } from "@/modules/deploy/ui/step-review-v2"
import type { DetectionResult } from "@/modules/deploy/deploy.types"

const detection: DetectionResult = {
  language: "Node.js",
  framework: "Next.js",
  frameworkVersion: "14",
  dockerfileDetected: false,
  buildCommand: "npm run build",
  confidence: 95,
  status: "success",
  primaryEngine: "node",
  primaryEngineVersion: "20",
  secondaryEngine: null,
  secondaryEngineVersion: null,
  defaultPort: 3000,
}

const buildState = {
  language: "Node.js",
  framework: "Next.js",
  frameworkVersion: "14",
  buildCommand: "npm run build",
  useDockerfile: false,
  primaryEngine: "node",
  primaryEngineVersion: "20",
  secondaryEngine: "",
  secondaryEngineVersion: "",
  defaultPort: 3000,
}

function createProps(
  overrides: Partial<{
    detectionResult: DetectionResult | null
    validationMessages: string[]
    canDeploy: boolean
  }> = {}
) {
  return {
    appName: "my-app",
    branchName: "main",
    detectionResult: detection,
    buildState,
    generatedSubdomain: "my-app.pfn.app",
    useGeneratedSubdomain: true,
    customDomain: "",
    environmentId: "staging",
    envVars: [],
    resourcePlanId: "pro" as const,
    cpu: 500,
    memory: 1024,
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
    onRootDirectoryChange: mock(() => {}),
    rootDirectory: "/",
    recommendedPlanId: "pro" as const,
    ...overrides,
  }
}

describe("StepReviewV2", () => {
  it("shows plan facts, one port, and truthful database copy", () => {
    const view = render(<StepReviewV2 {...createProps()} />)

    expect(
      view.getByRole("heading", { name: "Ready to deploy your app" })
    ).toBeInTheDocument()
    expect(view.getByText("my-app")).toBeInTheDocument()
    expect(view.getByText("main")).toBeInTheDocument()
    expect(view.getByText("Next.js v14")).toBeInTheDocument()
    expect(view.getByText("node v20")).toBeInTheDocument()
    expect(view.getByText("npm run build")).toBeInTheDocument()
    expect(view.getByText("3000")).toBeInTheDocument()
    expect(view.getByText("Pro (500 CPU / 1024 MiB)")).toBeInTheDocument()
    expect(
      view.getByText(
        "No database attached — add PostgreSQL or Redis after deploy"
      )
    ).toBeInTheDocument()
  })

  it("keeps Advanced closed and validation visible outside it", () => {
    const view = render(
      <StepReviewV2
        {...createProps({
          validationMessages: [
            "Custom domain is required when generated subdomain is off.",
          ],
          canDeploy: false,
        })}
      />
    )

    expect(view.getByRole("button", { name: "Advanced" })).toBeInTheDocument()
    expect(view.queryByLabelText("Custom domain")).not.toBeInTheDocument()
    expect(
      view.getByText(
        "Custom domain is required when generated subdomain is off."
      )
    ).toBeInTheDocument()
    expect(view.getByRole("button", { name: "Deploy" })).toBeDisabled()
  })

  it.each([
    [90, "Checked fact"],
    [89, "Editable recommendation"],
    [60, "Editable recommendation"],
    [59, "Manual setup required"],
  ])("discloses %s confidence as %s", (confidence, copy) => {
    const view = render(
      <StepReviewV2
        {...createProps({
          detectionResult: { ...detection, confidence },
        })}
      />
    )

    expect(
      view.getByText(new RegExp(`${confidence}% — ${copy}`))
    ).toBeInTheDocument()
  })

  it.each(["blocked", "unsupported", "failed", "low_confidence"] as const)(
    "requires manual setup for %s detection",
    (status) => {
      const view = render(
        <StepReviewV2
          {...createProps({
            detectionResult: { ...detection, confidence: 95, status },
          })}
        />
      )

      expect(view.getByText(/95% — Manual setup required/)).toBeInTheDocument()
    }
  )
})
