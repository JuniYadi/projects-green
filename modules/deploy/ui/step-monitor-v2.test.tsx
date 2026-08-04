import { describe, expect, it, mock } from "bun:test"
import { render } from "@testing-library/react"

import { StepMonitorV2 } from "./step-monitor-v2"

describe("StepMonitorV2", () => {
  it("shows app activity, preview domain, and collapsed logs", () => {
    const view = render(
      <StepMonitorV2
        appName="my-app"
        status="failed"
        logScope="all"
        attempt={1}
        failureReason="Build timeout"
        liveDomain="my-app.example.com"
        onLogScopeChange={mock()}
        onRetry={mock()}
        onEditSettings={mock()}
      />
    )

    expect(view.getByRole("heading", { name: "my-app" })).toBeInTheDocument()
    expect(view.getByText(/Attempt 1 failed/)).toBeInTheDocument()
    expect(
      view
        .getByRole("link", { name: "my-app.example.com" })
        .getAttribute("href")
    ).toBe("https://my-app.example.com")
    expect(view.getByRole("button", { name: "View logs" })).toBeInTheDocument()
    expect(view.getByRole("button", { name: "Retry" })).toBeInTheDocument()
    expect(
      view.getByRole("button", { name: "Edit Settings" })
    ).toBeInTheDocument()
  })
  it("omits malformed preview domains", () => {
    const view = render(
      <StepMonitorV2
        appName="my-app"
        status="running"
        logScope="all"
        attempt={1}
        failureReason={null}
        liveDomain="https://my-app.example.com"
        onLogScopeChange={mock()}
        onRetry={mock()}
        onEditSettings={mock()}
      />
    )

    expect(
      view.queryByRole("link", { name: "https://my-app.example.com" })
    ).toBeNull()
  })
})
