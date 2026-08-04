import { describe, expect, it } from "bun:test"
import { fireEvent, render } from "@testing-library/react"

import { LogsPanel } from "./logs-panel"

describe("LogsPanel", () => {
  const onScopeChange = () => {}

  it("defaults failed logs open when initialOpen is omitted", () => {
    const view = render(
      <LogsPanel
        status="failed"
        scope="all"
        attempt={1}
        onScopeChange={onScopeChange}
      />
    )

    expect(view.getByRole("button", { name: "Hide logs" })).toBeInTheDocument()
  })

  it("honors initialOpen false and keeps the user toggle functional", () => {
    const view = render(
      <LogsPanel
        status="failed"
        scope="all"
        attempt={1}
        initialOpen={false}
        onScopeChange={onScopeChange}
      />
    )

    const trigger = view.getByRole("button", { name: "View logs" })
    expect(trigger).toBeInTheDocument()

    fireEvent.click(trigger)
    expect(view.getByRole("button", { name: "Hide logs" })).toBeInTheDocument()

    fireEvent.click(view.getByRole("button", { name: "Hide logs" }))
    expect(view.getByRole("button", { name: "View logs" })).toBeInTheDocument()
  })
})
