import { beforeEach, describe, expect, it } from "bun:test"
import { cleanup, render } from "@testing-library/react"

import SelectOrganizationPage from "@/app/[lang]/auth/select-organization/page"

describe("SelectOrganizationPage", () => {
  beforeEach(() => {
    cleanup()
  })

  it("renders branded shell with organizations list", async () => {
    const params = Promise.resolve({ lang: "en" })
    const searchParams = Promise.resolve({
      email: "dev@example.com",
      pendingAuthenticationToken: "pending-token",
      organizations: JSON.stringify([
        { id: "org_alpha", name: "Alpha Cloud" },
        { id: "org_beta", name: "Beta Labs" },
      ]),
    })

    const jsx = await SelectOrganizationPage({ params, searchParams })
    const screen = render(jsx)

    expect(screen.getByText("Select your workspace")).toBeInTheDocument()
    expect(screen.getByText("Choose an organization")).toBeInTheDocument()
    expect(screen.getByText("dev@example.com")).toBeInTheDocument()
    expect(screen.getByText("Alpha Cloud")).toBeInTheDocument()
    expect(screen.getByText("Beta Labs")).toBeInTheDocument()

    const main = document.querySelector("main")
    expect(main).toBeInTheDocument()
    expect(main).toHaveClass("bg-[#060b18]")
  })
})
