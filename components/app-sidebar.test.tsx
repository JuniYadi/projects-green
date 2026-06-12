import { describe, expect, it } from "bun:test"

import {
  resolveSidebarMenu,
  resolveSidebarSecondaryLinks,
} from "@/components/app-sidebar"
import { getLocaleFromPathname } from "@/lib/i18n/pathname"

describe("resolveSidebarMenu", () => {
  it("returns console-only navigation and projects for console surface (applications context)", () => {
    const { navMain, projects, navMainLabel } = resolveSidebarMenu({
      surface: "console",
      pathname: "/console/app/manage",
      locale: "en",
    })

    expect(navMainLabel).toBe("Applications")

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
    ).toEqual(["Overview", "Billing", "VPN", "Support Tickets"])

    expect(
      supportMenu.projects.find((project) => project.name === "Support Tickets")
        ?.isActive
    ).toBe(true)
    expect(
      supportMenu.projects.map((project) => project.name)
    ).toEqual(["Overview", "Billing", "VPN", "Support Tickets"])
  })

  it("returns hub context when on /console page", () => {
    const { navMain, projects, navMainLabel } = resolveSidebarMenu({
      surface: "console",
      pathname: "/console",
      locale: "en",
    })

    expect(navMainLabel).toBe("Platform")

    // Hub context shows overview items under projects and top-level link under navMain
    expect(projects.map((project) => project.name)).toEqual([
      "Overview",
      "Billing",
      "VPN",
      "Support Tickets",
    ])
    expect(projects.find((project) => project.name === "Overview")?.isActive).toBe(true)

    // Organization lives in the top-left switcher dropdown, not the sidebar
    expect(navMain.map((item) => item.title)).toEqual(["Applications", "WhatsApp"])
    expect(navMain.map((item) => item.title)).not.toContain("Organization")
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
      "VPN",
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
<<<<<<< Updated upstream
=======
      "Settings",
>>>>>>> Stashed changes
      "App Hosting",
      "WhatsApp",
      "VPN",
    ])
    expect(navMain.map((item) => item.title)).not.toContain("Documentation")
<<<<<<< Updated upstream
    expect(navMain.map((item) => item.title)).not.toContain("Settings")
=======
>>>>>>> Stashed changes

    expect(projects.map((project) => project.name)).toContain("Payments")
    expect(projects.map((project) => project.name)).toContain(
      "Documentation"
    )
    expect(projects.map((project) => project.name)).not.toContain(
      "Applications"
    )
    expect(projects.map((project) => project.name)).not.toContain(
      "Tenant Management"
    )
  })

  it("returns portal platform navigation (not payments context) for payments path", () => {
    const { navMain, navMainLabel } = resolveSidebarMenu({
      surface: "portal",
      pathname: "/portal/payments",
      locale: "id",
    })

    // Payments no longer has its own sidebar context — falls back to portal platform nav
    expect(navMainLabel).not.toBe("Payments")
    expect(navMain.map((item) => item.title)).toEqual([
<<<<<<< Updated upstream
=======
      "Settings",
>>>>>>> Stashed changes
      "App Hosting",
      "WhatsApp",
      "VPN",
    ])
  })

  it("omits organization from console sidebar navMain (lives in top-left switcher)", () => {
    const { navMain } = resolveSidebarMenu({
      surface: "console",
      pathname: "/console/organization",
      locale: "en",
    })

    expect(navMain.map((item) => item.title)).not.toContain("Organization")
  })

  it("limits portal app hosting context to admin scope", () => {
    const { navMain, navMainLabel } = resolveSidebarMenu({
      surface: "portal",
      pathname: "/portal/app",
      locale: "en",
    })

    expect(navMainLabel).toBe("App Hosting")
    expect(navMain.map((item) => item.title)).toEqual([
      "Overview",
      "Detector Control",
      "Events",
    ])
  })

  it("returns app hosting event navigation for github events path", () => {
    const { navMain, navMainLabel } = resolveSidebarMenu({
      surface: "portal",
      pathname: "/portal/app/events/github",
      locale: "en",
    })

    expect(navMainLabel).toBe("App Hosting")
    const events = navMain.find((item) => item.title === "Events")
    expect(events).toBeDefined()
    expect(events?.isActive).toBe(true)
    expect(events?.items?.map((item) => item.title)).toEqual(["GitHub"])
    expect(events?.items?.[0]?.url).toContain("/portal/app/events/github")
    expect(events?.items?.[0]?.isActive).toBe(true)
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

  it("returns whatsapp context navigation and projects for /console/whatsapp/dashboard", () => {
    const { navMain, projects, navMainLabel } = resolveSidebarMenu({
      surface: "console",
      pathname: "/console/whatsapp/dashboard",
      locale: "en",
    })

    expect(navMainLabel).toBe("WhatsApp")
    expect(navMain.map((item) => item.title)).toEqual([
      "Dashboard",
      "Devices",
      "Templates",
      "Messages",
      "Contacts",
    ])
    expect(
      navMain.find((item) => item.title === "Dashboard")?.isActive
    ).toBe(true)

    expect(projects.map((project) => project.name)).toEqual(["Back to Console"])
  })

  it("marks devices active for its routes", () => {
    const { navMain, navMainLabel } = resolveSidebarMenu({
      surface: "console",
      pathname: "/console/whatsapp/devices",
      locale: "en",
    })

    expect(navMainLabel).toBe("WhatsApp")
    expect(
      navMain.find((item) => item.title === "Devices")?.isActive
    ).toBe(true)
  })

  it("marks templates active for its routes", () => {
    const { navMain, navMainLabel } = resolveSidebarMenu({
      surface: "console",
      pathname: "/console/whatsapp/templates/new",
      locale: "en",
    })

    expect(navMainLabel).toBe("WhatsApp")
    expect(
      navMain.find((item) => item.title === "Templates")?.isActive
    ).toBe(true)
  })

  it("marks messages active for its routes", () => {
    const { navMain, navMainLabel } = resolveSidebarMenu({
      surface: "console",
      pathname: "/console/whatsapp/messages",
      locale: "en",
    })

    expect(navMainLabel).toBe("WhatsApp")
    expect(
      navMain.find((item) => item.title === "Messages")?.isActive
    ).toBe(true)
  })

  it("marks contacts active for its routes", () => {
    const { navMain, navMainLabel } = resolveSidebarMenu({
      surface: "console",
      pathname: "/console/whatsapp/contacts",
      locale: "en",
    })

    expect(navMainLabel).toBe("WhatsApp")
    expect(
      navMain.find((item) => item.title === "Contacts")?.isActive
    ).toBe(true)
  })
})
