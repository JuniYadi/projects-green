import { describe, expect, it } from "bun:test"

import {
  resolveSidebarMenu,
  resolveSidebarSecondaryLinks,
} from "@/components/app-sidebar"
import { getLocaleFromPathname } from "@/lib/i18n/pathname"

describe("resolveSidebarMenu", () => {
  it("returns console-only navigation and projects for console surface (applications context)", () => {
    const { navMain, projects } = resolveSidebarMenu({
      surface: "console",
      pathname: "/console/app/manage",
      locale: "en",
    })

    // Flat menu structure under applications context
    expect(navMain.map((item) => item.title)).toEqual([
      "Deploy",
      "Manage",
    ])
    expect(navMain.find((item) => item.title === "Manage")?.isActive).toBe(true)

    // Escape hatch in projects
    expect(projects.map((project) => project.name)).toEqual(["Back to Console"])
  })

  it("marks manage active for its routes", () => {
    const manageMenu = resolveSidebarMenu({
      surface: "console",
      pathname: "/console/app/manage/build-logs",
      locale: "en",
    })

    expect(
      manageMenu.navMain.find((item) => item.title === "Manage")?.isActive
    ).toBe(true)
  })

  it("marks items active for console utility routes in their context", () => {
    const billingMenu = resolveSidebarMenu({
      surface: "console",
      pathname: "/console/billing",
      locale: "en",
    })
    const supportMenu = resolveSidebarMenu({
      surface: "console",
      pathname: "/console/support-tickets/thread-1",
      locale: "en",
    })

    expect(
      billingMenu.projects.find((project) => project.name === "Billing")?.isActive
    ).toBe(true)
    expect(
      billingMenu.projects.map((project) => project.name)
    ).toEqual(["Overview", "Billing", "Support Tickets"])

    expect(
      supportMenu.projects.find((project) => project.name === "Support Tickets")
        ?.isActive
    ).toBe(true)
    expect(
      supportMenu.projects.map((project) => project.name)
    ).toEqual(["Overview", "Billing", "Support Tickets"])
  })

  it("returns hub context when on /console page", () => {
    const { navMain, projects } = resolveSidebarMenu({
      surface: "console",
      pathname: "/console",
      locale: "en",
    })

    // Hub context shows overview items under projects and top-level link under navMain
    expect(projects.map((project) => project.name)).toEqual([
      "Overview",
      "Billing",
      "Support Tickets",
    ])
    expect(projects.find((project) => project.name === "Overview")?.isActive).toBe(true)

    expect(navMain.map((item) => item.title)).toEqual(["Applications", "WhatsApp"])
    expect(navMain[0]?.isActive).toBe(false)
  })

  it("resolves support tickets context from dynamic lang route templates", () => {
    const { pathnameWithoutLocale } = getLocaleFromPathname(
      "/[lang]/console/support-tickets"
    )

    const { navMain, projects } = resolveSidebarMenu({
      surface: "console",
      pathname: pathnameWithoutLocale,
      locale: "en",
    })

    expect(navMain.map((item) => item.title)).toEqual(["Applications", "WhatsApp"])
    expect(projects.map((project) => project.name)).toEqual([
      "Overview",
      "Billing",
      "Support Tickets",
    ])
    expect(
      projects.find((project) => project.name === "Support Tickets")?.isActive
    ).toBe(true)
  })

  it("returns portal-only navigation and projects for portal surface", () => {
    const { navMain, projects } = resolveSidebarMenu({
      surface: "portal",
      pathname: "/portal/documentations",
      locale: "en",
    })

    expect(navMain.map((item) => item.title)).toEqual([
      "Documentation",
      "Settings",
      "WhatsApp",
    ])
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

  it("includes thunder AI help trigger link for console sidebar secondary links", () => {
    const items = resolveSidebarSecondaryLinks({
      surface: "console",
      currentPathname: "/en/console",
    })

    expect(items.map((item) => item.title)).toContain("Thunder AI Help")
    expect(items.find((item) => item.title === "Thunder AI Help")?.url).toBe(
      "/en/console?kb=1"
    )
  })
})
