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

    expect(navMain.map((item) => item.title)).toEqual([
      "Deploy",
      "Deployments",
      "Overview",
      "Logs",
      "Metrics",
      "Settings",
      "Credentials",
    ])
    // After flattening Manage container, no single item is active for /console/app/manage
    expect(navMain.every((item) => !item.isActive)).toBe(true)

    // Escape hatch in projects
    expect(projects.map((project) => project.name)).toEqual(["Back to Console"])
  })

  it("marks settings active for its routes", () => {
    const settingsMenu = resolveSidebarMenu({
      surface: "console",
      pathname: "/console/app/settings",
      locale: "en",
    })

    expect(
      settingsMenu.navMain.find((item) => item.title === "Settings")?.isActive
    ).toBe(true)
  })
  it("marks Deployments active with localized URL", () => {
    const deploymentsMenu = resolveSidebarMenu({
      surface: "console",
      pathname: "/console/app/deployments/stack-1",
      locale: "en",
    })

    const deployments = deploymentsMenu.navMain.find(
      (item) => item.title === "Deployments"
    )
    expect(deployments?.url).toBe("/en/console/app/deployments")
    expect(deployments?.isActive).toBe(true)
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

    expect(billingMenu.navMainLabel).toBe("Billing")
    expect(billingMenu.projects.map((project) => project.name)).toEqual([
      "Back to Console",
    ])

    expect(
      supportMenu.projects.find((project) => project.name === "Support Tickets")
        ?.isActive
    ).toBe(true)
    expect(supportMenu.projects.map((project) => project.name)).toEqual([
      "Overview",
      "Billing",
      "Support Tickets",
    ])
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
      "Support Tickets",
    ])
    expect(
      projects.find((project) => project.name === "Overview")?.isActive
    ).toBe(true)

    expect(navMain.map((item) => item.title)).toEqual([
      "Applications",
      "WhatsApp",
      "VPN",
    ])
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

    expect(navMain.map((item) => item.title)).toEqual([
      "Applications",
      "WhatsApp",
      "VPN",
    ])
    expect(projects.map((project) => project.name)).toEqual([
      "Overview",
      "Billing",
      "Support Tickets",
    ])
    expect(
      projects.find((project) => project.name === "Support Tickets")?.isActive
    ).toBe(true)
  })

  it("includes Events link in app-hosting context", () => {
    const { navMain, navMainLabel } = resolveSidebarMenu({
      surface: "portal",
      pathname: "/portal/app/deploy",
      locale: "en",
    })
    expect(navMainLabel).toBe("App Hosting")

    expect(navMain.map((item) => item.title)).toEqual([
      "Overview",
      "Clusters",
      "Events",
      "Detector Control",
      "Settings",
    ])
    expect(navMain.map((item) => item.title)).not.toContain("Deploy")
    expect(navMain.map((item) => item.title)).not.toContain("Logs")
    expect(navMain.map((item) => item.title)).not.toContain("Metrics")

    const events = navMain.find((item) => item.title === "Events")!
    expect(events.url).toBe("/en/portal/app/events/github")
    expect(events.isActive).toBe(false)
  })

  it("marks Events active for its routes", () => {
    const { navMain } = resolveSidebarMenu({
      surface: "portal",
      pathname: "/portal/app/events/github",
      locale: "en",
    })

    expect(navMain.find((item) => item.title === "Events")?.isActive).toBe(true)
  })

  it("includes and activates cluster management link", () => {
    const { navMain } = resolveSidebarMenu({
      surface: "portal",
      pathname: "/portal/app/clusters/cl_1",
      locale: "en",
    })

    const clusters = navMain.find((item) => item.title === "Clusters")
    expect(clusters?.url).toBe("/en/portal/app/clusters")
    expect(clusters?.isActive).toBe(true)
  })

  it("includes Webhook Logs link in whatsapp context", () => {
    const { navMain, navMainLabel } = resolveSidebarMenu({
      surface: "portal",
      pathname: "/portal/whatsapp/devices",
      locale: "en",
    })

    expect(navMainLabel).toBe("WhatsApp")
    expect(navMain.map((item) => item.title)).toContain("Webhook Logs")

    const webhookLogs = navMain.find((item) => item.title === "Webhook Logs")!
    expect(webhookLogs.url).toBe("/en/portal/whatsapp/webhook-logs")
    expect(webhookLogs.isActive).toBe(false)
  })

  it("marks Webhook Logs active for its route", () => {
    const { navMain } = resolveSidebarMenu({
      surface: "portal",
      pathname: "/portal/whatsapp/webhook-logs",
      locale: "en",
    })

    expect(
      navMain.find((item) => item.title === "Webhook Logs")?.isActive
    ).toBe(true)
  })

  it("returns portal-only navigation and projects for portal surface", () => {
    const { navMain, projects } = resolveSidebarMenu({
      surface: "portal",
      pathname: "/portal/documentations",
      locale: "en",
    })

    expect(navMain.map((item) => item.title)).toEqual([
      "App Hosting",
      "VPN",
      "WhatsApp",
      "Settings",
    ])
    expect(navMain.map((item) => item.title)).not.toContain("Documentation")

    expect(projects.map((project) => project.name)).toContain("Billing")
    expect(projects.map((project) => project.name)).not.toContain(
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
      "App Hosting",
      "VPN",
      "WhatsApp",
      "Settings",
    ])
  })
  it("renders Settings with Email Templates and Email Logs children for portal surface", () => {
    const { navMain } = resolveSidebarMenu({
      surface: "portal",
      pathname: "/portal/documentations",
      locale: "en",
    })
    const settings = navMain.find((item) => item.title === "Settings")
    expect(settings).toBeDefined()
    expect(settings?.items?.map((i) => i.title)).toEqual([
      "Email Templates",
      "Email Logs",
    ])
    expect(
      settings?.items?.find((i) => i.title === "Email Templates")?.url
    ).toBe("/en/portal/settings/emails")
    expect(settings?.items?.find((i) => i.title === "Email Logs")?.url).toBe(
      "/en/portal/settings/emails/delivery-logs"
    )
    expect(settings?.isActive).toBe(false)
    expect(
      settings?.items?.find((i) => i.title === "Email Templates")?.isActive
    ).toBe(false)
    expect(
      settings?.items?.find((i) => i.title === "Email Logs")?.isActive
    ).toBe(false)
  })
  it("marks Email Templates active on email template path", () => {
    const { navMain } = resolveSidebarMenu({
      surface: "portal",
      pathname: "/portal/settings/emails",
      locale: "en",
    })
    const settings = navMain.find((item) => item.title === "Settings")
    expect(settings?.isActive).toBe(true)
    expect(
      settings?.items?.find((i) => i.title === "Email Templates")?.isActive
    ).toBe(true)
    expect(
      settings?.items?.find((i) => i.title === "Email Logs")?.isActive
    ).toBe(false)
  })
  it("marks Email Logs active on delivery-logs path", () => {
    const { navMain } = resolveSidebarMenu({
      surface: "portal",
      pathname: "/portal/settings/emails/delivery-logs",
      locale: "id",
    })
    const settings = navMain.find((item) => item.title === "Settings")
    expect(settings?.isActive).toBe(true)
    expect(
      settings?.items?.find((i) => i.title === "Email Logs")?.isActive
    ).toBe(true)
    expect(
      settings?.items?.find((i) => i.title === "Email Templates")?.isActive
    ).toBe(false)
  })
  it("renders My Organization with children in portal secondary nav", () => {
    const items = resolveSidebarSecondaryLinks({
      surface: "portal",
      currentPathname: "/id/portal/settings/invitations",
    })
    expect(items.map((item) => item.title)).toEqual([
      "Support",
      "Feedback",
      "My Organization",
    ])
    const myOrg = items.find((item) => item.title === "My Organization")
    expect(myOrg?.url).toBe("/id/portal/settings/members")
    expect(myOrg?.isActive).toBe(true)
    expect(myOrg?.items?.map((i) => i.title)).toEqual([
      "Members",
      "Invitation",
      "Ownership",
      "Email Templates",
    ])
    expect(myOrg?.items?.find((i) => i.title === "Invitation")?.isActive).toBe(
      true
    )
    expect(myOrg?.items?.find((i) => i.title === "Members")?.isActive).toBe(
      false
    )
  })
  it("renders My Organization with Email Logs child active on delivery-logs path", () => {
    const items = resolveSidebarSecondaryLinks({
      surface: "portal",
      currentPathname: "/en/portal/settings/emails/delivery-logs",
    })
    const myOrg = items.find((item) => item.title === "My Organization")
    expect(myOrg?.isActive).toBe(true)
    expect(
      myOrg?.items?.find((i) => i.title === "Email Templates")?.isActive
    ).toBe(true)
    expect(items.map((item) => item.title)).not.toContain("Settings")
  })
  it("console sidebar secondary does not include Settings or Email Templates", () => {
    const items = resolveSidebarSecondaryLinks({
      surface: "console",
      currentPathname: "/en/console",
    })
    expect(items.map((item) => item.title)).toContain("Thunder AI Help")
    expect(items.map((item) => item.title)).not.toContain("Settings")
    expect(items.map((item) => item.title)).not.toContain("Email Templates")
  })
  it("returns portal billing context with platform items for /portal/billing", () => {
    const { navMain, projects, navMainLabel } = resolveSidebarMenu({
      surface: "portal",
      pathname: "/portal/billing",
      locale: "en",
    })

    expect(navMainLabel).toBe("Billing")
    expect(navMain.map((item) => item.title)).toEqual([
      "Overview",
      "Org Overview",
      "Invoices",
      "Payments",
      "Vouchers",
      "Promotions",
      "Audit Logs",
      "Catalog",
      "Pricing",
      "Orders",
    ])
    expect(projects.map((project) => project.name)).toEqual(["Back to Portal"])
  })
  it("uses a billing-specific console context with Services and Subscriptions", () => {
    const { navMain, navMainLabel, projects } = resolveSidebarMenu({
      surface: "console",
      pathname: "/console/billing",
      locale: "en",
    })

    expect(navMainLabel).toBe("Billing")
    expect(navMain.map((item) => item.title)).toContain("Services")
    expect(navMain.map((item) => item.title)).toContain("Subscriptions")
    expect(navMain.find((item) => item.title === "Services")?.url).toBe(
      "/en/console/billing/services"
    )
    expect(navMain.find((item) => item.title === "Subscriptions")?.url).toBe(
      "/en/console/billing/subscriptions"
    )
    expect(projects.map((project) => project.name)).toEqual(["Back to Console"])
  })

  it("exposes Catalog in the portal billing context", () => {
    const { navMain } = resolveSidebarMenu({
      surface: "portal",
      pathname: "/portal/billing/catalog",
      locale: "en",
    })

    const catalog = navMain.find((item) => item.title === "Catalog")
    expect(catalog?.url).toBe("/en/portal/billing/catalog")
    expect(catalog?.isActive).toBe(true)
  })

  it("marks invoices active when on /portal/billing/invoices", () => {
    const { navMain } = resolveSidebarMenu({
      surface: "portal",
      pathname: "/portal/billing/invoices",
      locale: "en",
    })
    expect(navMain.find((item) => item.title === "Invoices")?.isActive).toBe(
      true
    )
    expect(navMain.find((item) => item.title === "Overview")?.isActive).toBe(
      false
    )
  })

  it("marks overview active when on /portal/billing", () => {
    const { navMain } = resolveSidebarMenu({
      surface: "portal",
      pathname: "/portal/billing",
      locale: "en",
    })
    expect(navMain.find((item) => item.title === "Overview")?.isActive).toBe(
      true
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

  it("returns whatsapp context navigation and projects for /console/whatsapp/dashboard", () => {
    const { navMain, projects, navMainLabel } = resolveSidebarMenu({
      surface: "console",
      pathname: "/console/whatsapp/dashboard",
      locale: "en",
    })

    expect(navMainLabel).toBe("WhatsApp")
    expect(navMain.map((item) => item.title)).toEqual([
      "Dashboard",
      "Usage",
      "Devices",
      "Templates",
      "Messages",
      "Broadcasts",
      "Contacts",
      "Catalogs",
      "Webhook Logs",
      "Audit Logs",
    ])
    expect(navMain.find((item) => item.title === "Dashboard")?.isActive).toBe(
      true
    )

    expect(projects.map((project) => project.name)).toEqual(["Back to Console"])
  })

  it("marks devices active for its routes", () => {
    const { navMain, navMainLabel } = resolveSidebarMenu({
      surface: "console",
      pathname: "/console/whatsapp/devices",
      locale: "en",
    })

    expect(navMainLabel).toBe("WhatsApp")
    expect(navMain.find((item) => item.title === "Devices")?.isActive).toBe(
      true
    )
  })

  it("marks templates active for its routes", () => {
    const { navMain, navMainLabel } = resolveSidebarMenu({
      surface: "console",
      pathname: "/console/whatsapp/templates/new",
      locale: "en",
    })

    expect(navMainLabel).toBe("WhatsApp")
    expect(navMain.find((item) => item.title === "Templates")?.isActive).toBe(
      true
    )
  })

  it("returns portal whatsapp context with Dashboard as first item for /portal/whatsapp", () => {
    const { navMain, projects, navMainLabel } = resolveSidebarMenu({
      surface: "portal",
      pathname: "/portal/whatsapp",
      locale: "en",
    })

    expect(navMainLabel).toBe("WhatsApp")
    expect(navMain.map((item) => item.title)).toEqual([
      "Dashboard",
      "Devices",
      "Templates",
      "Messages",
      "Broadcasts",
      "Usage",
      "Contacts",
      "Catalogs",
      "Webhook Logs",
      "Audit Logs",
    ])
    expect(navMain.find((item) => item.title === "Dashboard")?.isActive).toBe(
      true
    )

    expect(projects.map((project) => project.name)).toEqual(["Back to Portal"])
  })

  it("marks messages active for its routes", () => {
    const { navMain, navMainLabel } = resolveSidebarMenu({
      surface: "console",
      pathname: "/console/whatsapp/messages",
      locale: "en",
    })

    expect(navMainLabel).toBe("WhatsApp")
    expect(navMain.find((item) => item.title === "Messages")?.isActive).toBe(
      true
    )
  })

  it("marks contacts active for its routes", () => {
    const { navMain, navMainLabel } = resolveSidebarMenu({
      surface: "console",
      pathname: "/console/whatsapp/contacts",
      locale: "en",
    })

    expect(navMainLabel).toBe("WhatsApp")
    expect(navMain.find((item) => item.title === "Contacts")?.isActive).toBe(
      true
    )
  })

  it("marks Webhook Logs active for its route", () => {
    const { navMain } = resolveSidebarMenu({
      surface: "console",
      pathname: "/console/whatsapp/webhook-logs",
      locale: "en",
    })

    expect(
      navMain.find((item) => item.title === "Webhook Logs")?.isActive
    ).toBe(true)
  })

  it("marks Audit Logs active for its route", () => {
    const { navMain } = resolveSidebarMenu({
      surface: "console",
      pathname: "/console/whatsapp/audit-logs",
      locale: "en",
    })

    expect(navMain.find((item) => item.title === "Audit Logs")?.isActive).toBe(
      true
    )
  })

  it("includes order package in console vpn context", () => {
    const { navMain, navMainLabel } = resolveSidebarMenu({
      surface: "console",
      pathname: "/console/vpn/order",
      locale: "en",
    })

    expect(navMainLabel).toBe("VPN")
    expect(navMain.map((item) => item.title)).toEqual([
      "Dashboard",
      "Order Package",
      "My Subscriptions",
      "Devices",
    ])
    expect(
      navMain.find((item) => item.title === "Order Package")?.isActive
    ).toBe(true)
  })
  it("returns one portal orgs link and keeps detail active", () => {
    const { navMain, projects, navMainLabel } = resolveSidebarMenu({
      surface: "portal",
      pathname: "/portal/orgs/org-1",
      locale: "en",
    })

    expect(navMainLabel).toBe("Organizations")

    // Only "Back to Portal" remains in projects
    expect(projects.map((project) => project.name)).toEqual(["Back to Portal"])

    // Exactly one URL equals "/en/portal/orgs" across both lists
    const allUrls = [
      ...projects.map((p) => p.url),
      ...navMain.map((i) => i.url),
    ]
    expect(allUrls.filter((url) => url === "/en/portal/orgs")).toHaveLength(1)

    // Overview nav item is active for detail route
    const overviewItem = navMain.find((item) => item.title === "Overview")
    expect(overviewItem?.isActive).toBe(true)
  })
})
