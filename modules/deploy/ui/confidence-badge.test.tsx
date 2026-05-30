import { describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"
import { ConfidenceBadge } from "./confidence-badge"

describe("ConfidenceBadge", () => {
  it("shows 'Detection not started' when result is null", () => {
    const view = render(<ConfidenceBadge detectionResult={null} />)
    expect(view.getByText("Detection not started")).toBeInTheDocument()
  })

  it("shows 'Need your help' for failed detection", () => {
    const view = render(
      <ConfidenceBadge
        detectionResult={{
          language: "Node.js",
          framework: null,
          dockerfileDetected: false,
          buildCommand: null,
          confidence: 0,
          status: "failed",
        }}
      />
    )
    expect(view.getByText(/Need your help/)).toBeInTheDocument()
  })

  it("shows 'Need your help' for confidence below low threshold", () => {
    const view = render(
      <ConfidenceBadge
        detectionResult={{
          language: "Node.js",
          framework: null,
          dockerfileDetected: false,
          buildCommand: null,
          confidence: 30,
          status: "success",
        }}
      />
    )
    expect(view.getByText(/Need your help/)).toBeInTheDocument()
  })

  it("shows 'Looks good' for high confidence", () => {
    const view = render(
      <ConfidenceBadge
        detectionResult={{
          language: "Node.js",
          framework: "Next.js",
          dockerfileDetected: false,
          buildCommand: "npm run build",
          confidence: 90,
          status: "success",
        }}
      />
    )
    expect(view.getByText(/Looks good/)).toBeInTheDocument()
  })

  it("shows 'Please verify' for medium confidence", () => {
    const view = render(
      <ConfidenceBadge
        detectionResult={{
          language: "Node.js",
          framework: null,
          dockerfileDetected: false,
          buildCommand: null,
          confidence: 65,
          status: "success",
        }}
      />
    )
    expect(view.getByText(/Please verify settings/)).toBeInTheDocument()
  })
})
