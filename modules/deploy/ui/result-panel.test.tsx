import { describe, expect, it, mock } from "bun:test"
import { render } from "@testing-library/react"
import { ResultPanel } from "./result-panel"

describe("ResultPanel", () => {
  it("shows idle message when status is idle", () => {
    const view = render(
      <ResultPanel
        status="idle"
        failureReason={null}
        attempt={0}
        onRetry={mock()}
        onEditSettings={mock()}
      />
    )
    expect(view.getByText("Deploy to see runtime results.")).toBeInTheDocument()
  })

  it("shows in-progress message for queued status", () => {
    const view = render(
      <ResultPanel
        status="queued"
        failureReason={null}
        attempt={1}
        onRetry={mock()}
        onEditSettings={mock()}
      />
    )
    expect(view.getByText("Deployment in progress")).toBeInTheDocument()
  })

  it("shows in-progress message for building status", () => {
    const view = render(
      <ResultPanel
        status="building"
        failureReason={null}
        attempt={2}
        onRetry={mock()}
        onEditSettings={mock()}
      />
    )
    expect(view.getByText("Deployment in progress")).toBeInTheDocument()
  })

  it("shows in-progress message for deploying status", () => {
    const view = render(
      <ResultPanel
        status="deploying"
        failureReason={null}
        attempt={3}
        onRetry={mock()}
        onEditSettings={mock()}
      />
    )
    expect(view.getByText("Deployment in progress")).toBeInTheDocument()
  })

  it("shows live status for running status", () => {
    const view = render(
      <ResultPanel
        status="running"
        failureReason={null}
        attempt={1}
        onRetry={mock()}
        onEditSettings={mock()}
      />
    )
    expect(view.getByText("Deployment live")).toBeInTheDocument()
    expect(view.getByText("Visit App")).toBeInTheDocument()
  })

  it("shows failure message and action buttons", () => {
    const onRetry = mock()
    const onEditSettings = mock()
    const view = render(
      <ResultPanel
        status="failed"
        failureReason="Build timeout"
        attempt={2}
        onRetry={onRetry}
        onEditSettings={onEditSettings}
      />
    )
    expect(view.getByText("Deployment failed")).toBeInTheDocument()
    expect(view.getByText("Retry")).toBeInTheDocument()
    expect(view.getByText("Edit Settings")).toBeInTheDocument()
  })

  it("shows default failure reason when none provided", () => {
    const view = render(
      <ResultPanel
        status="failed"
        failureReason={null}
        attempt={3}
        onRetry={mock()}
        onEditSettings={mock()}
      />
    )
    expect(
      view.getByText(/We hit an issue while deploying/)
    ).toBeInTheDocument()
  })

  it("returns null for unknown status", () => {
    const view = render(
      <ResultPanel
        status={"unknown" as never}
        failureReason={null}
        attempt={0}
        onRetry={mock()}
        onEditSettings={mock()}
      />
    )
    expect(view.container.innerHTML).toBe("")
  })
})
