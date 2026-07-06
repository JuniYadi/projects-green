import { beforeEach, describe, expect, it } from "bun:test"
import { cleanup, render } from "@testing-library/react"

import LoginPage from "@/app/[lang]/login/page"

describe("LoginPage", () => {
  beforeEach(() => {
    cleanup()
  })

  it("renders branded shell, error message, and no Acme Inc", async () => {
    const params = Promise.resolve({ lang: "en" })
    const searchParams = Promise.resolve({
      next: "/console",
      error: "Access denied",
    })

    const jsx = await LoginPage({ params, searchParams })
    const screen = render(jsx)

    expect(screen.getByText("Welcome back")).toBeInTheDocument()
    expect(screen.getByText("PFNApp")).toBeInTheDocument()
    expect(screen.getByText("Access denied")).toBeInTheDocument()

    expect(screen.queryByText("Acme Inc.")).not.toBeInTheDocument()
  })
})
