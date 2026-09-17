import { afterEach, describe, expect, it } from "bun:test"
import { cleanup, render } from "@testing-library/react"
import { ToolTelemetryBadge } from "./tool-telemetry-badge"

describe("ToolTelemetryBadge", () => {
  afterEach(cleanup)
  it("renders raw telemetry message string with gear icon", () => {
    const view = render(
      <ToolTelemetryBadge message="⚙ Tool: list_repo_files (GitLab/GitHub API) -> 34 files scanned (120ms)" />
    )

    expect(
      view.getByText(
        "⚙ Tool: list_repo_files (GitLab/GitHub API) -> 34 files scanned (120ms)"
      )
    ).toBeTruthy()
    expect(view.getByTestId("tool-telemetry-badge")).toBeTruthy()
  })

  it("formats structured tool properties into standardized badge syntax", () => {
    const view = render(
      <ToolTelemetryBadge
        toolName="read_repo_file"
        args="'composer.json'"
        result="Laravel 11.x on PHP 8.2"
        durationMs={85}
      />
    )

    expect(
      view.getByText(
        "⚙ Tool: read_repo_file ('composer.json') -> Laravel 11.x on PHP 8.2 (85ms)"
      )
    ).toBeTruthy()
  })

  it("applies neutral card surface styling adhering to 60-30-10 color rule", () => {
    const view = render(
      <ToolTelemetryBadge
        toolName="list_repo_files"
        result="34 files scanned"
      />
    )

    const badge = view.getByTestId("tool-telemetry-badge")
    expect(badge.className).toContain("bg-muted/40")
    expect(badge.className).toContain("text-muted-foreground")
    expect(badge.className).toContain("border-border/50")
    expect(badge.className).toContain("rounded-md")
  })
})
