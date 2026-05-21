import { describe, expect, it } from "bun:test"

import { resolveSidebarMenu } from "@/components/app-sidebar"

describe("resolveSidebarMenu", () => {
  it("returns console-only navigation and projects for console surface", () => {
    const { navMain, projects } = resolveSidebarMenu({
      surface: "console",
      pathname: "/console/app/manage",
      locale: "en",
    })

    expect(navMain.map((item) => item.title)).toEqual(["Applications"])
    expect(navMain[0]?.items?.map((item) => item.title)).toEqual([
      "Deploy",
      "Manage",
      "Monitoring",
    ])
    expect(navMain[0]?.isActive).toBe(true)

    expect(projects.map((project) => project.name)).toEqual([
      "Overview",
      "Invoices",
      "Support Tickets",
    ])
    expect(projects.map((project) => project.name)).not.toContain(
      "Documentation"
    )
    expect(projects.map((project) => project.name)).not.toContain(
      "Tenant Management"
    )
  })

  it("marks manage and monitoring submenus active for their routes", () => {
    const manageMenu = resolveSidebarMenu({
      surface: "console",
      pathname: "/console/app/manage/build-logs",
      locale: "en",
    })

    const monitoringMenu = resolveSidebarMenu({
      surface: "console",
      pathname: "/console/app/monitoring/metrics",
      locale: "en",
    })

    expect(
      manageMenu.navMain[0]?.items?.find((item) => item.title === "Manage")
        ?.isActive
    ).toBe(true)
    expect(
      manageMenu.navMain[0]?.items?.find(
        (item) => item.title === "Monitoring"
      )?.isActive
    ).toBe(false)

    expect(
      monitoringMenu.navMain[0]?.items?.find(
        (item) => item.title === "Monitoring"
      )?.isActive
    ).toBe(true)
    expect(
      monitoringMenu.navMain[0]?.items?.find(
        (item) => item.title === "Manage"
      )?.isActive
    ).toBe(false)
  })

  it("marks quick menu items active for console utility routes", () => {
    const invoicesMenu = resolveSidebarMenu({
      surface: "console",
      pathname: "/console/invoices",
      locale: "en",
    })
    const supportMenu = resolveSidebarMenu({
      surface: "console",
      pathname: "/console/support-tickets/thread-1",
      locale: "en",
    })

    expect(
      invoicesMenu.projects.find((item) => item.name === "Invoices")?.isActive
    ).toBe(true)
    expect(
      supportMenu.projects.find((item) => item.name === "Support Tickets")
        ?.isActive
    ).toBe(true)
  })

  it("returns portal-only navigation and projects for portal surface", () => {
    const { navMain, projects } = resolveSidebarMenu({
      surface: "portal",
      pathname: "/portal/documentations",
      locale: "en",
    })

    expect(navMain.map((item) => item.title)).toEqual(["Documentation"])
    expect(navMain[0]?.items?.map((item) => item.title)).toEqual(["Registry"])
    expect(navMain[0]?.isActive).toBe(true)

    expect(projects.map((project) => project.name)).toContain("Documentation")
    expect(projects.map((project) => project.name)).not.toContain(
      "Applications"
    )
    expect(projects.map((project) => project.name)).not.toContain(
      "Tenant Management"
    )
  })
})
