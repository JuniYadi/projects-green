import { describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"
import { FeedMessage } from "./feed-message"

describe("FeedMessage", () => {
  it("renders statement and details", () => {
    const view = render(
      <FeedMessage
        kind="detection_success"
        statement="Application detected"
        details="Laravel 11 on PHP 8.2"
      />
    )

    expect(view.getByText("Application detected")).toBeTruthy()
    expect(view.getByText("Laravel 11 on PHP 8.2")).toBeTruthy()
  })

  it("renders actions when provided", () => {
    const view = render(
      <FeedMessage
        kind="plan_ready"
        statement="Plan ready"
        actions={<button>Confirm</button>}
      />
    )

    expect(view.getByRole("button", { name: "Confirm" })).toBeTruthy()
  })

  it("renders spinner when working", () => {
    const view = render(
      <FeedMessage kind="inspecting" statement="Inspecting..." working={true} />
    )

    expect(view.getByText("Inspecting...")).toBeTruthy()
  })
})
