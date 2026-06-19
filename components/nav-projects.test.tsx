import { describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"

import { NavProjects } from "@/components/nav-projects"
import { SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"

describe("NavProjects", () => {
  it("renders quick menu links", () => {
    const view = render(
      <SidebarProvider>
        <TooltipProvider>
          <NavProjects
            projects={[
              {
                name: "Overview",
                url: "/console",
                icon: <span aria-hidden="true">O</span>,
                isActive: true,
              },
              {
                name: "Invoices",
                url: "/console/invoices",
                icon: <span aria-hidden="true">I</span>,
              },
            ]}
          />
        </TooltipProvider>
      </SidebarProvider>
    )

    expect(view.getByText("Projects")).toBeTruthy()
    expect(
      view.getByRole("link", { name: "Overview" }).getAttribute("href")
    ).toBe("/console")
    expect(
      view.getByRole("link", { name: "Invoices" }).getAttribute("href")
    ).toBe("/console/invoices")
  })
})
