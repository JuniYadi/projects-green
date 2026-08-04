import { describe, expect, it, mock } from "bun:test"
import { fireEvent, render } from "@testing-library/react"
import type {
  DeployLogScope,
  DeployStatus,
} from "@/modules/deploy/deploy.types"

mock.module("@/modules/deploy/ui/deploy-timeline", () => ({
  DeployStepTimeline: () => <div data-testid="technical-timeline" />,
}))
mock.module("@/modules/deploy/ui/logs-panel", () => ({
  LogsPanel: () => <div data-testid="technical-logs" />,
}))

const statusCopy: Array<[DeployStatus, string, string]> = [
  ["idle", "Getting your site ready", "We'll start building it shortly."],
  ["queued", "Getting your site ready", "We'll start building it shortly."],
  ["building", "Building your site", "We're preparing it to run online."],
  [
    "deploying",
    "Putting your site online",
    "We're connecting it to your web address.",
  ],
  ["running", "Your site is live", "Your web address is ready to visit."],
  [
    "failed",
    "We couldn't publish your site",
    "We hit an issue while deploying. Review logs and retry with updated settings.",
  ],
]

const renderMonitor = async (
  status: DeployStatus,
  overrides: Partial<{
    failureReason: string | null
    onRetry: () => void
    onEditSettings: () => void
  }> = {}
) => {
  const { StepMonitorV2 } = await import("@/modules/deploy/ui/step-monitor-v2")
  return render(
    <StepMonitorV2
      status={status}
      logScope={"all" satisfies DeployLogScope}
      attempt={0}
      failureReason={null}
      onLogScopeChange={() => {}}
      onRetry={overrides.onRetry ?? (() => {})}
      onEditSettings={overrides.onEditSettings ?? (() => {})}
      {...overrides}
    />
  )
}

describe("StepMonitorV2", () => {
  it.each(statusCopy)(
    "shows outcome copy for %s",
    async (status, title, supportText) => {
      const view = await renderMonitor(status)

      expect(view.getByRole("heading", { name: title })).toBeInTheDocument()
      expect(view.getByText(supportText)).toBeInTheDocument()
      expect(
        view.getByRole("heading", { name: title }).parentElement
      ).toHaveAttribute("aria-live", "polite")
    }
  )

  it("keeps technical progress closed until requested", async () => {
    const view = await renderMonitor("building")
    const details = view.container.querySelector("details")

    expect(view.getByText("Show technical progress")).toBeInTheDocument()
    expect(details).not.toBeNull()
    expect((details as HTMLDetailsElement).open).toBe(false)
  })

  it("keeps live result directly below outcome summary", async () => {
    const view = await renderMonitor("running")

    expect(view.getByText("Your site is live")).toBeInTheDocument()
    expect(view.getByText("Deployment live")).toBeInTheDocument()
    expect(view.getByText("Show technical progress")).toBeInTheDocument()
  })

  it("uses failure reason and keeps retry and settings actions", async () => {
    let retryCount = 0
    let editSettingsCount = 0
    const view = await renderMonitor("failed", {
      failureReason: "Build command exited with code 1.",
      onRetry: () => {
        retryCount++
      },
      onEditSettings: () => {
        editSettingsCount++
      },
    })

    expect(
      view.getByText("Build command exited with code 1.")
    ).toBeInTheDocument()
    fireEvent.click(view.getByRole("button", { name: "Retry" }))
    fireEvent.click(view.getByRole("button", { name: "Edit Settings" }))
    expect(retryCount).toBe(1)
    expect(editSettingsCount).toBe(1)
  })
})
