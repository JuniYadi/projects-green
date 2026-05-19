import { describe, expect, it } from "bun:test"

import { resolveSidebarMenu } from "@/components/app-sidebar"

describe("resolveSidebarMenu", () => {
  it("returns console-only navigation and projects for console surface", () => {
    const { navMain, projects } = resolveSidebarMenu({
      surface: "console",
      pathname: "/console/app/deploy",
    })

    expect(navMain.map((item) => item.title)).toEqual(["Console"])
    expect(navMain[0]?.items?.map((item) => item.title)).toEqual([
      "Overview",
      "Deploy",
      "Operate",
      "Observe",
      "Tenant Management",
    ])
    expect(navMain[0]?.isActive).toBe(true)

    expect(projects.map((project) => project.name)).toContain("Deployments")
    expect(projects.map((project) => project.name)).toContain(
      "Tenant Management"
    )
    expect(projects.map((project) => project.name)).not.toContain(
      "Documentation"
    )
  })

  it("marks operate and observe submenus active for their routes", () => {
    const operateMenu = resolveSidebarMenu({
      surface: "console",
      pathname: "/console/app/deploy/operate/build-logs",
    })

    const observeMenu = resolveSidebarMenu({
      surface: "console",
      pathname: "/console/app/deploy/observe/metrics",
    })

    expect(
      operateMenu.navMain[0]?.items?.find((item) => item.title === "Operate")
        ?.isActive
    ).toBe(true)
    expect(
      operateMenu.navMain[0]?.items?.find((item) => item.title === "Observe")
        ?.isActive
    ).toBe(false)

    expect(
      observeMenu.navMain[0]?.items?.find((item) => item.title === "Observe")
        ?.isActive
    ).toBe(true)
    expect(
      observeMenu.navMain[0]?.items?.find((item) => item.title === "Operate")
        ?.isActive
    ).toBe(false)
  })

  it("returns portal-only navigation and projects for portal surface", () => {
    const { navMain, projects } = resolveSidebarMenu({
      surface: "portal",
      pathname: "/portal/documentations",
    })

    expect(navMain.map((item) => item.title)).toEqual(["Documentation"])
    expect(navMain[0]?.items?.map((item) => item.title)).toEqual(["Registry"])
    expect(navMain[0]?.isActive).toBe(true)

    expect(projects.map((project) => project.name)).toContain("Documentation")
    expect(projects.map((project) => project.name)).not.toContain("Deployments")
    expect(projects.map((project) => project.name)).not.toContain(
      "Tenant Management"
    )
  })
})
