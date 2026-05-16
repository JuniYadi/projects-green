import { describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"

import { NavMain } from "@/components/nav-main"
import { SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"

describe("NavMain", () => {
  it("renders top-level and nested items, with active section expanded", () => {
    const view = render(
      <SidebarProvider>
        <TooltipProvider>
          <NavMain
            items={[
              {
                title: "Console",
                url: "/console",
                isActive: true,
                icon: <span aria-hidden="true">C</span>,
                items: [
                  { title: "Members", url: "/console/members" },
                  { title: "Settings", url: "/console/settings" },
                ],
              },
              {
                title: "Portal",
                url: "/portal",
                icon: <span aria-hidden="true">P</span>,
              },
            ]}
          />
        </TooltipProvider>
      </SidebarProvider>
    )

    expect(view.getByText("Platform")).toBeTruthy()
    expect(view.getByRole("link", { name: "Console" }).getAttribute("href")).toBe(
      "/console"
    )
    expect(view.getByRole("link", { name: "Portal" }).getAttribute("href")).toBe(
      "/portal"
    )
    expect(view.getByRole("link", { name: "Members" })).toBeTruthy()
    expect(view.getByRole("link", { name: "Settings" })).toBeTruthy()
  })
})
