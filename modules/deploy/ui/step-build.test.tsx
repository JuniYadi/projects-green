import { describe, expect, it, mock } from "bun:test"
import { fireEvent, render } from "@testing-library/react"

import { StepBuild } from "@/modules/deploy/ui/step-build"
import type { DetectionResult } from "@/modules/deploy/deploy.types"

const successDetection: DetectionResult = {
  language: "Node.js",
  framework: "Next.js",
  dockerfileDetected: false,
  buildCommand: "bun run build",
  confidence: 91,
  status: "success",
}

const failedDetection: DetectionResult = {
  language: null,
  framework: null,
  dockerfileDetected: false,
  buildCommand: null,
  confidence: 0,
  status: "failed",
}

const createProps = () => {
  return {
    owner: {
      id: "owner-pfn",
      name: "pfn-labs",
      avatarUrl: "",
    },
    repository: {
      id: "repo-console-next",
      ownerId: "owner-pfn",
      name: "console-next-app",
      isPrivate: true,
      defaultBranch: "main",
      installationId: 12345,
    },
    branch: {
      id: "branch-1",
      repoId: "repo-console-next",
      name: "main",
    },
    rootDirectory: "/",
    detectionResult: successDetection,
    language: "Node.js",
    framework: "Next.js",
    buildCommand: "bun run build",
    useDockerfile: false,
    manualOverrideRequired: false,
    isDetecting: false,
    canProceed: true,
    onBack: mock(() => {}),
    onNext: mock(() => {}),
    onBuildFieldChange: mock(() => {}),
  }
}

describe("StepBuild", () => {
  it("renders detection summary with default ready guidance", () => {
    const props = createProps()

    const view = render(<StepBuild {...props} />)

    expect(view.getByText("Detection result")).toBeTruthy()
    expect(view.getByText("Detected language")).toBeTruthy()
    expect(view.getAllByText("Node.js").length).toBeGreaterThan(0)
    expect(view.getByText("Detected framework")).toBeTruthy()
    expect(view.getAllByText("Next.js").length).toBeGreaterThan(0)
    expect(view.getByText("Detected build command")).toBeTruthy()
    expect(view.getByText("bun run build")).toBeTruthy()
    expect(view.getByText("Dockerfile detected")).toBeTruthy()
    expect(view.getByText("Ready: build settings are complete.")).toBeTruthy()
  })

  it("shows manual override validation errors when required values are missing", () => {
    const props = createProps()
    props.detectionResult = failedDetection
    props.language = ""
    props.framework = ""
    props.buildCommand = ""
    props.manualOverrideRequired = true
    props.canProceed = false

    const view = render(<StepBuild {...props} />)

    expect(
      view.getByText(
        "Detection failed. Add manual build settings or enable Dockerfile."
      )
    ).toBeTruthy()
    expect(view.getByText("Build settings need attention")).toBeTruthy()
    expect(view.getByText("Select a language.")).toBeTruthy()
    expect(view.getByText("Select a framework.")).toBeTruthy()
    expect(view.getByText("Enter a build command.")).toBeTruthy()
    expect(view.getByRole("button", { name: "Next" })).toBeDisabled()

    fireEvent.change(view.getByLabelText("Language selector"), {
      target: { value: "Go" },
    })

    expect(props.onBuildFieldChange).toHaveBeenCalledWith("language", "Go")
  })

  it("disables build command when dockerfile mode is enabled", () => {
    const props = createProps()
    props.useDockerfile = true

    const view = render(<StepBuild {...props} />)

    expect(view.getByLabelText("Build command")).toBeDisabled()
    expect(
      view.getByText(
        "Build command is ignored because Dockerfile mode is enabled."
      )
    ).toBeTruthy()
    expect(
      view.getByText("Ready: deployment will use your Dockerfile.")
    ).toBeTruthy()

    fireEvent.click(view.getByLabelText("Use Dockerfile instead"))
    expect(props.onBuildFieldChange).toHaveBeenCalledWith(
      "useDockerfile",
      false
    )
  })
})
