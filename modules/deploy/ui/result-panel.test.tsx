import { describe, expect, it, mock } from "bun:test"
import { render } from "@testing-library/react"
import { ResultPanel } from "./result-panel"

describe("ResultPanel", () => {
  const dashboardHref = "/en/console/app/manage"

  it("shows idle message when status is idle", () => {
    const view = render(
      <ResultPanel
        status="idle"
        failureReason={null}
        attempt={0}
        dashboardHref={dashboardHref}
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
        dashboardHref={dashboardHref}
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
        dashboardHref={dashboardHref}
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
        dashboardHref={dashboardHref}
        onRetry={mock()}
        onEditSettings={mock()}
      />
    )
    expect(view.getByText("Deployment in progress")).toBeInTheDocument()
  })

  it("shows live links only when running has a domain", () => {
    const view = render(
      <ResultPanel
        status="running"
        failureReason={null}
        attempt={1}
        liveDomain="preview.example.com"
        dashboardHref={dashboardHref}
        onRetry={mock()}
        onEditSettings={mock()}
      />
    )
    expect(view.getByText("Your app is live!")).toBeInTheDocument()
    expect(
      view.getByRole("link", { name: "Visit Preview" }).getAttribute("href")
    ).toBe("https://preview.example.com")
    expect(
      view.getByRole("link", { name: "Open Dashboard" }).getAttribute("href")
    ).toBe(dashboardHref)
  })

  it("omits preview link when running has no domain", () => {
    const view = render(
      <ResultPanel
        status="running"
        failureReason={null}
        attempt={1}
        dashboardHref={dashboardHref}
        onRetry={mock()}
        onEditSettings={mock()}
      />
    )
    expect(view.getByText("Your app is live!")).toBeInTheDocument()
    expect(view.queryByRole("link", { name: "Visit Preview" })).toBeNull()
  })
  it("omits preview link for a malformed domain", () => {
    const view = render(
      <ResultPanel
        status="running"
        failureReason={null}
        attempt={1}
        liveDomain="https://preview.example.com"
        dashboardHref={dashboardHref}
        onRetry={mock()}
        onEditSettings={mock()}
      />
    )

    expect(view.queryByRole("link", { name: "Visit Preview" })).toBeNull()
  })
  it("omits dashboard link when href is empty", () => {
    const view = render(
      <ResultPanel
        status="running"
        failureReason={null}
        attempt={1}
        liveDomain="preview.example.com"
        dashboardHref=""
        onRetry={mock()}
        onEditSettings={mock()}
      />
    )

    expect(view.queryByRole("link", { name: "Open Dashboard" })).toBeNull()
  })

  it("shows failure message and action buttons", () => {
    const onRetry = mock()
    const onEditSettings = mock()
    const view = render(
      <ResultPanel
        status="failed"
        failureReason="Build timeout"
        attempt={2}
        dashboardHref={dashboardHref}
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
        dashboardHref={dashboardHref}
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
        dashboardHref={dashboardHref}
        onRetry={mock()}
        onEditSettings={mock()}
      />
    )
    expect(view.container.innerHTML).toBe("")
  })
})
