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

    expect(navMainLabel).toBe("App Hosting")

    expect(navMain.map((item) => item.title)).toEqual([
      "Deploy",
      "Marketplace",
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
      "App Hosting",
      "WhatsApp",
      "VPN",
      "AI Studio",
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
      "App Hosting",
      "WhatsApp",
      "VPN",
      "AI Studio",
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

  it("returns AI Studio context navigation for /console/ai/agents", () => {
    const { navMain, projects, navMainLabel } = resolveSidebarMenu({
      surface: "console",
      pathname: "/console/ai/agents",
      locale: "en",
    })

    expect(navMainLabel).toBe("AI Studio")
    expect(projects[0]?.name).toBe("Back to Console")
    expect(navMain.map((item) => item.title)).toEqual([
      "AI Agents",
      "Knowledge Base",
      "BYOK Providers",
    ])
    expect(navMain[0]?.isActive).toBe(true)
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
      "Templates",
      "Managed Stocks",
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

  it("labels the portal VPN route as operations while preserving its deep link", () => {
    const { navMain } = resolveSidebarMenu({
      surface: "portal",
      pathname: "/portal/vpn/subscriptions",
      locale: "en",
    })

    const operations = navMain.find((item) => item.title === "VPN Operations")
    expect(navMain.map((item) => item.title)).not.toContain("Packages")
    expect(operations?.url).toBe("/en/portal/vpn/subscriptions")
    expect(operations?.isActive).toBe(true)
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
      "Systems",
    ])
    expect(navMain.map((item) => item.title)).not.toContain("Documentation")

    expect(projects.map((project) => project.name)).toContain("Billing")
    expect(projects.map((project) => project.name)).not.toContain(
      "Documentation"
    )
    expect(projects.map((project) => project.name)).not.toContain("App Hosting")
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
      "Systems",
    ])
  })
  it("renders Systems without collapsible children for portal surface", () => {
    const { navMain } = resolveSidebarMenu({
      surface: "portal",
      pathname: "/portal/documentations",
      locale: "en",
    })
    const systems = navMain.find((item) => item.title === "Systems")
    expect(systems).toBeDefined()
    expect(systems?.url).toBe("/en/portal/system/cronjobs")
    expect(systems?.items).toBeUndefined()
    expect(systems?.isActive).toBe(false)
  })
  it("marks Systems active on system, ai, and storage paths", () => {
    for (const path of [
      "/portal/system/cronjobs",
      "/portal/ai",
      "/portal/storage",
    ]) {
      const { navMain, navMainLabel } = resolveSidebarMenu({
        surface: "portal",
        pathname: path,
        locale: "en",
      })
      expect(navMainLabel).toBe("Systems")
      expect(navMain.map((item) => item.title)).toContain("AI Governance")
      expect(navMain.map((item) => item.title)).toContain("Storage Audit")
      expect(navMain.map((item) => item.title)).toContain("CronJobs & Workers")
    }
  })
  it("portal secondary nav only includes Documentation and API Reference, no duplicate organization", () => {
    const items = resolveSidebarSecondaryLinks({
      surface: "portal",
      currentPathname: "/id/portal/settings/invitations",
    })
    expect(items.map((item) => item.title)).toEqual([
      "Documentation",
      "API Reference",
    ])
  })
  it("console sidebar secondary includes Documentation and API Reference, but not Settings or Email Templates", () => {
    const items = resolveSidebarSecondaryLinks({
      surface: "console",
      currentPathname: "/en/console",
    })
    expect(items.map((item) => item.title)).toEqual([
      "Documentation",
      "API Reference",
    ])
    expect(items.map((item) => item.title)).not.toContain("Settings")
    expect(items.map((item) => item.title)).not.toContain("Email Templates")
  })
  it("includes the API Reference link for console and portal surfaces", () => {
    for (const surface of ["console", "portal"] as const) {
      const items = resolveSidebarSecondaryLinks({
        surface,
        currentPathname: surface === "console" ? "/en/console" : "/en/portal",
      })
      const apiReference = items.find((item) => item.title === "API Reference")

      expect(apiReference?.url).toBe(
        surface === "portal" ? "/api/admin/docs" : "/api/openapi"
      )
      expect(apiReference?.icon).toBeDefined()
    }
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
      "Promotions",
      "Audit Logs",
      "Catalog",
      "Regions",
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

  it("uses one Promotions entry instead of separate voucher navigation", () => {
    const { navMain } = resolveSidebarMenu({
      surface: "portal",
      pathname: "/portal/billing/promotions",
      locale: "en",
    })

    expect(navMain.filter((item) => item.title === "Promotions")).toHaveLength(
      1
    )
    expect(navMain.some((item) => item.title === "Vouchers")).toBe(false)
    expect(navMain.some((item) => item.title === "Pricing")).toBe(false)
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

  it("includes documentation link for console sidebar secondary links", () => {
    const items = resolveSidebarSecondaryLinks({
      surface: "console",
      currentPathname: "/en/console",
    })

    expect(items.map((item) => item.title)).toContain("Documentation")
    expect(items.find((item) => item.title === "Documentation")?.url).toBe(
      "/en/docs"
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
      "API Keys",
      "Usage",
      "Pricing & Costs",
      "Devices",
      "Templates",
      "Messages",
      "Broadcasts",
      "AI & Bot Builder",
      "Contacts",
      "Catalogs",
      "Logs",
    ])
    expect(navMain.find((item) => item.title === "Dashboard")?.isActive).toBe(
      true
    )
    expect(
      navMain.find((item) => item.title === "AI & Bot Builder")?.url
    ).toContain("/console/whatsapp/workflows")
    expect(projects.map((project) => project.name)).toEqual(["Back to Console"])
  })
  it("marks pricing active for its routes", () => {
    const { navMain } = resolveSidebarMenu({
      surface: "console",
      pathname: "/console/whatsapp/pricing",
      locale: "en",
    })

    expect(
      navMain.find((item) => item.title === "Pricing & Costs")?.isActive
    ).toBe(true)
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
      "API Keys",
      "Meta Apps",
      "Devices",
      "Templates",
      "Messages",
      "Broadcasts",
      "Usage",
      "Ledger",
      "Pricing",
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

  it("includes and marks Pricing active for its portal WhatsApp route", () => {
    const { navMain, navMainLabel } = resolveSidebarMenu({
      surface: "portal",
      pathname: "/portal/whatsapp/pricing",
      locale: "en",
    })

    const pricing = navMain.find((item) => item.title === "Pricing")
    expect(navMainLabel).toBe("WhatsApp")
    expect(pricing?.url).toContain("/portal/whatsapp/pricing")
    expect(pricing?.isActive).toBe(true)
  })

  it("marks API Keys active for its route", () => {
    const { navMain } = resolveSidebarMenu({
      surface: "portal",
      pathname: "/portal/whatsapp/api-keys",
      locale: "en",
    })

    const apiKeys = navMain.find((item) => item.title === "API Keys")
    expect(apiKeys?.url).toBe("/en/portal/whatsapp/api-keys")
    expect(apiKeys?.isActive).toBe(true)
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

  it("marks console API Keys active for its route", () => {
    const { navMain } = resolveSidebarMenu({
      surface: "console",
      pathname: "/console/whatsapp/api-keys",
      locale: "en",
    })

    const apiKeys = navMain.find((item) => item.title === "API Keys")
    expect(apiKeys?.url).toBe("/en/console/whatsapp/api-keys")
    expect(apiKeys?.isActive).toBe(true)
  })

  it("locks graduated-only console WhatsApp items by default (no isGraduated passed)", () => {
    const { navMain } = resolveSidebarMenu({
      surface: "console",
      pathname: "/console/whatsapp/api-keys",
      locale: "en",
    })

    const apiKeys = navMain.find((item) => item.title === "API Keys")
    expect(apiKeys?.isLocked).toBe(true)
  })

  it("unlocks graduated-only console WhatsApp items when isGraduated is true", () => {
    const { navMain } = resolveSidebarMenu({
      surface: "console",
      pathname: "/console/whatsapp/api-keys",
      locale: "en",
      isGraduated: true,
    })

    const apiKeys = navMain.find((item) => item.title === "API Keys")
    expect(apiKeys?.isLocked).toBe(false)
  })

  it("marks Logs active for whatsapp logs routes", () => {
    const { navMain: navLogs } = resolveSidebarMenu({
      surface: "console",
      pathname: "/console/whatsapp/logs",
      locale: "en",
    })
    expect(navLogs.find((item) => item.title === "Logs")?.isActive).toBe(true)

    const { navMain: navWebhooks } = resolveSidebarMenu({
      surface: "console",
      pathname: "/console/whatsapp/webhook-logs",
      locale: "en",
    })
    expect(navWebhooks.find((item) => item.title === "Logs")?.isActive).toBe(
      true
    )

    const { navMain: navAudit } = resolveSidebarMenu({
      surface: "console",
      pathname: "/console/whatsapp/audit-logs",
      locale: "en",
    })
    expect(navAudit.find((item) => item.title === "Logs")?.isActive).toBe(true)
  })

  it("shows access profiles instead of the order flow in console vpn context", () => {
    const { navMain, navMainLabel } = resolveSidebarMenu({
      surface: "console",
      pathname: "/console/vpn/profiles",
      locale: "en",
    })

    expect(navMainLabel).toBe("VPN")
    expect(navMain.map((item) => item.title)).toEqual([
      "Dashboard",
      "Access Profiles",
      "Devices",
    ])
    expect(
      navMain.find((item) => item.title === "Access Profiles")?.isActive
    ).toBe(true)
    expect(navMain.find((item) => item.title === "Access Profiles")?.url).toBe(
      "/en/console/vpn/profiles"
    )
    expect(navMain.map((item) => item.title)).not.toContain("Order Package")
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

describe("resolveSidebarSecondaryLinks", () => {
  it("includes API Reference link with /api/openapi for console surface", () => {
    const links = resolveSidebarSecondaryLinks({
      surface: "console",
      currentPathname: "/console/whatsapp/dashboard",
    })

    const apiDocsLink = links.find((link) => link.title === "API Reference")
    expect(apiDocsLink).toBeDefined()
    expect(apiDocsLink?.url).toBe("/api/openapi")
  })

  it("includes API Reference link with /api/admin/docs for portal surface", () => {
    const links = resolveSidebarSecondaryLinks({
      surface: "portal",
      currentPathname: "/portal",
    })

    const apiDocsLink = links.find((link) => link.title === "API Reference")
    expect(apiDocsLink).toBeDefined()
    expect(apiDocsLink?.url).toBe("/api/admin/docs")
  })
})
