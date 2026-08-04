import { describe, expect, it, mock } from "bun:test"
import { fireEvent, render } from "@testing-library/react"

import { StepDetectV2 } from "@/modules/deploy/ui/step-detect-v2"
import type {
  DeployBuildState,
  DetectionResult,
} from "@/modules/deploy/deploy.types"

const baseResult: DetectionResult = {
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
  decisionMessage: "Ready to deploy.",
  evidence: [{ type: "file", value: "package.json", detail: "detected" }],
}

const baseBuild: DeployBuildState = {
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

const noop = () => {}

describe("StepDetectV2", () => {
  it("shows compact progress with current operation during initial scan", () => {
    const view = render(
      <StepDetectV2
        detectionResult={null}
        isDetecting={true}
        detectionRetrying={false}
        detectionAttempt={1}
        detectionError={null}
        buildState={baseBuild}
        manualOverrideRequired={false}
        canProceed={false}
        onBack={noop}
        onNext={noop}
        onBuildFieldChange={noop}
        onRetry={noop}
      />
    )

    expect(
      view.getByText("We're checking how to publish your site")
    ).toBeInTheDocument()
    expect(
      view.getByText(
        "This usually takes about a minute. You can review the result before anything goes live."
      )
    ).toBeInTheDocument()
    expect(view.getByText("Checking your project…")).toBeInTheDocument()
    expect(view.getByText("Inspect repository")).toBeInTheDocument()
    expect(view.queryByText("Analyze dependencies")).not.toBeInTheDocument()
    expect(view.queryByText("Show technical details")).not.toBeInTheDocument()
  })

  it("renders real detection values including Not detected for missing version", () => {
    const result: DetectionResult = {
      ...baseResult,
      frameworkVersion: null,
      primaryEngineVersion: "unknown",
      framework: "Next.js",
    }
    const view = render(
      <StepDetectV2
        detectionResult={result}
        isDetecting={false}
        detectionRetrying={false}
        detectionAttempt={1}
        detectionError={null}
        buildState={baseBuild}
        manualOverrideRequired={false}
        canProceed={true}
        onBack={noop}
        onNext={noop}
        onBuildFieldChange={noop}
        onRetry={noop}
      />
    )

    expect(
      view.getByText("Next.js · Not detected", { exact: true })
    ).toBeInTheDocument()
    expect(
      view.getByText("node · Not detected", { exact: true })
    ).toBeInTheDocument()
    expect(view.queryByText(/vunknown/)).not.toBeInTheDocument()
    expect(
      view.getByText("We found Next.js. Your site is ready to review.")
    ).toBeInTheDocument()

    const technicalDetails = view
      .getByText("Show technical details")
      .closest("details")
    const manualDetails = view
      .getByText("Change technical settings")
      .closest("details")
    expect(technicalDetails?.hasAttribute("open")).toBe(false)
    expect(manualDetails?.hasAttribute("open")).toBe(false)
    expect(view.getByText(/package\.json/)).not.toBeVisible()
    expect(view.getByLabelText("Language selector")).not.toBeVisible()
    fireEvent.click(view.getByText("Show technical details"))
    expect(technicalDetails?.hasAttribute("open")).toBe(true)
    expect(view.getByText(/package\.json/)).toBeVisible()
  })

  it("renders manual fallback after final transient failure", () => {
    const view = render(
      <StepDetectV2
        detectionResult={null}
        isDetecting={false}
        detectionRetrying={false}
        detectionAttempt={2}
        detectionError="Detection provider temporarily unavailable."
        detectionErrorCode="DETECTION_TRANSIENT_PROVIDER_ERROR"
        buildState={baseBuild}
        manualOverrideRequired={false}
        canProceed={false}
        onBack={noop}
        onNext={noop}
        onBuildFieldChange={noop}
        onRetry={noop}
      />
    )
    expect(
      view.getByText("We couldn't check your project automatically.")
    ).toBeInTheDocument()
    expect(
      view
        .getByText("Change technical settings")
        .closest("details")
        ?.hasAttribute("open")
    ).toBe(true)

    expect(
      view.getByText(
        "Automatic detection stopped after two attempts. Manual configuration is available below."
      )
    ).toBeInTheDocument()
    expect(
      view.getByRole("button", { name: "Retry detection" })
    ).toBeInTheDocument()
    expect(view.getByLabelText("Language selector")).toBeInTheDocument()
  })

  it("renders blocked policy message and evidence without generic failure", () => {
    const view = render(
      <StepDetectV2
        detectionResult={{
          ...baseResult,
          status: "blocked",
          decisionMessage: "Deployment blocked by admin rule.",
          evidence: [{ type: "file", value: "artisan", detail: "root" }],
        }}
        isDetecting={false}
        detectionRetrying={false}
        detectionAttempt={1}
        detectionError={null}
        buildState={baseBuild}
        manualOverrideRequired={true}
        canProceed={true}
        onBack={noop}
        onNext={noop}
        onBuildFieldChange={noop}
        onRetry={noop}
      />
    )

    expect(
      view.getAllByText("Deployment blocked by admin rule.")[0]
    ).toBeInTheDocument()
    expect(view.getByText(/artisan/)).toBeInTheDocument()
    expect(view.queryByText(/Detection failed/)).not.toBeInTheDocument()
    expect(
      view.getByText("Manual setup is required before continuing.")
    ).toBeInTheDocument()
    expect(
      view.queryByText("We found Next.js. Your site is ready to review.")
    ).not.toBeInTheDocument()
    expect(
      view.queryByRole("button", { name: "Retry detection" })
    ).not.toBeInTheDocument()
  })

  it("renders unsupported policy message and evidence", () => {
    const view = render(
      <StepDetectV2
        detectionResult={{
          ...baseResult,
          status: "unsupported",
          decisionMessage: "This framework is not supported.",
          evidence: [{ type: "file", value: "README.md", detail: "root" }],
        }}
        isDetecting={false}
        detectionRetrying={false}
        detectionAttempt={1}
        detectionError={null}
        buildState={baseBuild}
        manualOverrideRequired={true}
        canProceed={false}
        onBack={noop}
        onNext={noop}
        onBuildFieldChange={noop}
        onRetry={noop}
      />
    )

    expect(
      view.getAllByText("This framework is not supported.")[0]
    ).toBeInTheDocument()
    expect(view.getByText(/README\.md/)).toBeInTheDocument()
    expect(
      view.getByText("Manual setup is required before continuing.")
    ).toBeInTheDocument()
    expect(
      view.queryByText("We found Next.js. Your site is ready to review.")
    ).not.toBeInTheDocument()
  })

  it("renders low-confidence decision message", () => {
    const view = render(
      <StepDetectV2
        detectionResult={{
          ...baseResult,
          status: "low_confidence",
          confidence: 45,
          decisionMessage: "Review detected settings before deploying.",
        }}
        isDetecting={false}
        detectionRetrying={false}
        detectionAttempt={1}
        detectionError={null}
        buildState={baseBuild}
        manualOverrideRequired={false}
        canProceed={true}
        onBack={noop}
        onNext={noop}
        onBuildFieldChange={noop}
        onRetry={noop}
      />
    )

    expect(
      view.getByText("We found Next.js, but it needs a quick check.")
    ).toBeInTheDocument()
    expect(
      view.getAllByText("Review detected settings before deploying.")[0]
    ).toBeInTheDocument()
  })

  it("shows retry attempt message during retry", () => {
    const view = render(
      <StepDetectV2
        detectionResult={null}
        isDetecting={false}
        detectionRetrying={true}
        detectionAttempt={2}
        detectionError={null}
        buildState={baseBuild}
        manualOverrideRequired={false}
        canProceed={false}
        onBack={noop}
        onNext={noop}
        onBuildFieldChange={noop}
        onRetry={noop}
      />
    )

    expect(view.getByText(/Retry attempt 2/)).toBeInTheDocument()
  })

  it("keeps Dockerfile mode exempt from manual field validation", () => {
    const view = render(
      <StepDetectV2
        detectionResult={null}
        isDetecting={false}
        detectionRetrying={false}
        detectionAttempt={1}
        detectionError={null}
        buildState={{
          ...baseBuild,
          language: "",
          framework: "",
          buildCommand: "",
          useDockerfile: true,
        }}
        manualOverrideRequired={true}
        canProceed={true}
        onBack={noop}
        onNext={noop}
        onBuildFieldChange={noop}
        onRetry={noop}
      />
    )

    expect(
      view.queryByText("Build settings need attention")
    ).not.toBeInTheDocument()
    expect(view.getByLabelText("Build command")).toBeDisabled()
  })

  it("does not offer retry for permanent detection failures", () => {
    const view = render(
      <StepDetectV2
        detectionResult={null}
        isDetecting={false}
        detectionRetrying={false}
        detectionAttempt={2}
        detectionError="Detection failed permanently."
        detectionErrorCode="DETECTION_FAILED"
        buildState={baseBuild}
        manualOverrideRequired={false}
        canProceed={false}
        onBack={noop}
        onNext={noop}
        onBuildFieldChange={noop}
        onRetry={noop}
      />
    )

    expect(
      view.queryByRole("button", { name: "Retry detection" })
    ).not.toBeInTheDocument()
  })
  it("calls onRetry when retry button clicked", () => {
    const onRetry = mock()
    const view = render(
      <StepDetectV2
        detectionResult={null}
        isDetecting={false}
        detectionRetrying={false}
        detectionAttempt={2}
        detectionError="Detection provider temporarily unavailable."
        detectionErrorCode="NETWORK_ERROR"
        buildState={baseBuild}
        manualOverrideRequired={false}
        canProceed={false}
        onBack={noop}
        onNext={noop}
        onBuildFieldChange={noop}
        onRetry={onRetry}
      />
    )

    fireEvent.click(view.getByRole("button", { name: "Retry detection" }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it("keeps duplicate evidence rows keyed by content across insertions", () => {
    const renderStep = (evidence: DetectionResult["evidence"]) => (
      <StepDetectV2
        detectionResult={{ ...baseResult, evidence }}
        isDetecting={false}
        detectionRetrying={false}
        detectionAttempt={1}
        detectionError={null}
        buildState={baseBuild}
        manualOverrideRequired={false}
        canProceed={true}
        onBack={noop}
        onNext={noop}
        onBuildFieldChange={noop}
        onRetry={noop}
      />
    )

    const duplicateEvidence = [
      { type: "file", value: "package.json", detail: "root" },
      { type: "file", value: "package.json", detail: "root" },
      { type: "file", value: "tsconfig.json", detail: "root" },
    ]
    const view = render(renderStep(duplicateEvidence))
    const duplicateRows = view
      .getAllByText("package.json · root", { exact: true })
      .map((node) => node.closest("li"))

    expect(duplicateRows).toHaveLength(2)
    expect(duplicateRows[0]).not.toBeNull()
    expect(duplicateRows[1]).not.toBeNull()

    view.rerender(
      renderStep([
        { type: "file", value: "README.md", detail: "root" },
        ...duplicateEvidence,
      ])
    )

    const updatedRows = view
      .getAllByText("package.json · root", { exact: true })
      .map((node) => node.closest("li"))
    expect(updatedRows[0]).toBe(duplicateRows[0])
    expect(updatedRows[1]).toBe(duplicateRows[1])
  })
})
