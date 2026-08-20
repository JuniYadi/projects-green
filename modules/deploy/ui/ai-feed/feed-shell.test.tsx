import { describe, expect, it, mock } from "bun:test"
import { render, fireEvent } from "@testing-library/react"
import { FeedShell } from "./feed-shell"

describe("FeedShell", () => {
  it("renders header, children, and composer", () => {
    const view = render(
      <FeedShell
        composer={<div>Composer Slot</div>}
        onNewDeployment={() => {}}
        hasActiveSession={false}
      >
        <div>Feed Item 1</div>
      </FeedShell>
    )

    expect(view.getByText("AI deployment assistant")).toBeTruthy()
    expect(view.getByText("Feed Item 1")).toBeTruthy()
    expect(view.getByText("Composer Slot")).toBeTruthy()
  })

  it("calls onNewDeployment when New deployment clicked without active session", () => {
    const onNew = mock(() => {})
    const view = render(
      <FeedShell
        composer={<div>Composer</div>}
        onNewDeployment={onNew}
        hasActiveSession={false}
      >
        <div>Content</div>
      </FeedShell>
    )

    fireEvent.click(view.getByRole("button", { name: "New deployment" }))
    expect(onNew).toHaveBeenCalled()
  })
})
