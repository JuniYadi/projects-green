import { describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"

import { NavProjects } from "@/components/nav-projects"
import { SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"

describe("NavProjects", () => {
  it("renders project links and actions shell", () => {
    const view = render(
      <SidebarProvider>
        <TooltipProvider>
          <NavProjects
            projects={[
              {
                name: "Deployments",
                url: "/console/app/deploy",
                icon: <span aria-hidden="true">D</span>,
              },
              {
                name: "Tenant Management",
                url: "/console/organization",
                icon: <span aria-hidden="true">T</span>,
              },
            ]}
          />
        </TooltipProvider>
      </SidebarProvider>
    )

    expect(view.getByText("Projects")).toBeTruthy()
    expect(
      view.getByRole("link", { name: "Deployments" }).getAttribute("href")
    ).toBe("/console/app/deploy")
    expect(
      view.getByRole("link", { name: "Tenant Management" }).getAttribute("href")
    ).toBe("/console/organization")
    expect(view.getAllByText("More").length).toBeGreaterThan(0)
  })
})
