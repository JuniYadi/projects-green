import { beforeEach, describe, expect, it } from "bun:test"
import { cleanup, render } from "@testing-library/react"

import { AuthPageShell } from "@/components/auth-page-shell"

describe("AuthPageShell", () => {
  beforeEach(() => {
    cleanup()
  })

  it("renders brand, panel content, and children in the branded shell", () => {
    const screen = render(
      <AuthPageShell
        badge="Console access"
        panelTitle="Panel title"
        panelDescription="Panel copy"
      >
        <div>Form content</div>
      </AuthPageShell>
    )

    expect(screen.getByText("PFNApp")).toBeInTheDocument()
    expect(screen.getByText("Panel title")).toBeInTheDocument()
    expect(screen.getByText("Panel copy")).toBeInTheDocument()
    expect(screen.getByText("Form content")).toBeInTheDocument()

    const main = document.querySelector("main")
    expect(main).toBeInTheDocument()
    expect(main).toHaveClass("bg-[#060b18]")

    expect(screen.queryByText("Acme Inc.")).not.toBeInTheDocument()
  })
})
