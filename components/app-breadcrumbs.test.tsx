import { describe, expect, it } from "bun:test"

import { buildAppBreadcrumbItems } from "@/components/app-breadcrumbs"

describe("buildAppBreadcrumbItems", () => {
  it("renders only the root crumb for the localized console root", () => {
    expect(
      buildAppBreadcrumbItems({
        pathname: "/en/console",
        rootSegment: "console",
      })
    ).toEqual([{ label: "Console", href: undefined }])
  })

  it("renders nested console crumbs with localized hrefs", () => {
    expect(
      buildAppBreadcrumbItems({
        pathname: "/en/console/billing/payment-methods",
        rootSegment: "console",
      })
    ).toEqual([
      { label: "Console", href: "/en/console" },
      { label: "Billing", href: "/en/console/billing" },
      { label: "Payment Methods", href: undefined },
    ])
  })

  it("renders nested portal crumbs with human labels", () => {
    expect(
      buildAppBreadcrumbItems({
        pathname: "/en/portal/admin/organizations",
        rootSegment: "portal",
      })
    ).toEqual([
      { label: "Portal", href: "/en/portal" },
      { label: "Admin", href: "/en/portal/admin" },
      { label: "Organizations", href: undefined },
    ])
  })

  it("labels WhatsApp message wamid detail route as Message Journey", () => {
    expect(
      buildAppBreadcrumbItems({
        pathname:
          "/en/console/whatsapp/messages/wamid.HBgNNjI4NTcwODI5NjQ4MhUCABEYEjQ0OTIwNDE3N0U2N0VGQkY5NAA=",
        rootSegment: "console",
      })
    ).toEqual([
      { label: "Console", href: "/en/console" },
      { label: "WhatsApp", href: "/en/console/whatsapp" },
      { label: "Messages", href: "/en/console/whatsapp/messages" },
      { label: "Message Journey", href: undefined },
    ])
  })

  it("labels the portal VPN subscriptions route as operations", () => {
    expect(
      buildAppBreadcrumbItems({
        pathname: "/en/portal/vpn/subscriptions",
        rootSegment: "portal",
      })
    ).toEqual([
      { label: "Portal", href: "/en/portal" },
      { label: "VPN", href: "/en/portal/vpn" },
      { label: "VPN Operations", href: undefined },
    ])
  })

  it("uses generic detail labels for dynamic id-like route segments", () => {
    expect(
      buildAppBreadcrumbItems({
        pathname: "/en/portal/admin/organizations/org_123",
        rootSegment: "portal",
      })
    ).toEqual([
      { label: "Portal", href: "/en/portal" },
      { label: "Admin", href: "/en/portal/admin" },
      { label: "Organizations", href: "/en/portal/admin/organizations" },
      { label: "Organization Detail", href: undefined },
    ])

    expect(
      buildAppBreadcrumbItems({
        pathname: "/en/portal/admin/organizations/ORG_123",
        rootSegment: "portal",
      })
    ).toEqual([
      { label: "Portal", href: "/en/portal" },
      { label: "Admin", href: "/en/portal/admin" },
      { label: "Organizations", href: "/en/portal/admin/organizations" },
      { label: "Organization Detail", href: undefined },
    ])

    expect(
      buildAppBreadcrumbItems({
        pathname: "/en/portal/admin/organizations/12345",
        rootSegment: "portal",
      })
    ).toEqual([
      { label: "Portal", href: "/en/portal" },
      { label: "Admin", href: "/en/portal/admin" },
      { label: "Organizations", href: "/en/portal/admin/organizations" },
      { label: "Organization Detail", href: undefined },
    ])

    expect(
      buildAppBreadcrumbItems({
        pathname: "/en/portal/admin/organizations/123_ORG",
        rootSegment: "portal",
      })
    ).toEqual([
      { label: "Portal", href: "/en/portal" },
      { label: "Admin", href: "/en/portal/admin" },
      { label: "Organizations", href: "/en/portal/admin/organizations" },
      { label: "Organization Detail", href: undefined },
    ])
  })
  it("keeps long named route segments as readable page labels", () => {
    expect(
      buildAppBreadcrumbItems({
        pathname:
          "/en/portal/whatsapp/super-long-page-name-that-is-not-a-detail",
        rootSegment: "portal",
      })
    ).toEqual([
      { label: "Portal", href: "/en/portal" },
      { label: "WhatsApp", href: "/en/portal/whatsapp" },
      { label: "Super Long Page Name That Is Not A Detail", href: undefined },
    ])
  })

  it("renders route-specific labels for documentation and new template routes", () => {
    expect(
      buildAppBreadcrumbItems({
        pathname: "/en/portal/documentations",
        rootSegment: "portal",
      })
    ).toEqual([
      { label: "Portal", href: "/en/portal" },
      { label: "Documentation", href: undefined },
    ])

    expect(
      buildAppBreadcrumbItems({
        pathname: "/en/console/whatsapp/templates/new",
        rootSegment: "console",
      })
    ).toEqual([
      { label: "Console", href: "/en/console" },
      { label: "WhatsApp", href: "/en/console/whatsapp" },
      { label: "Templates", href: "/en/console/whatsapp/templates" },
      { label: "New Template", href: undefined },
    ])
  })

  it("falls back to readable title case for unmapped segments", () => {
    expect(
      buildAppBreadcrumbItems({
        pathname: "/en/console/custom-reports",
        rootSegment: "console",
      })
    ).toEqual([
      { label: "Console", href: "/en/console" },
      { label: "Custom Reports", href: undefined },
    ])
  })

  it("maps platform route to Platforms label and platforms list href", () => {
    expect(
      buildAppBreadcrumbItems({
        pathname: "/en/portal/app/stacks",
        rootSegment: "portal",
      })
    ).toEqual([
      { label: "Portal", href: "/en/portal" },
      { label: "App", href: "/en/portal/app" },
      { label: "Platforms", href: undefined },
    ])

    expect(
      buildAppBreadcrumbItems({
        pathname: "/en/console/app/platform/sample-app",
        rootSegment: "console",
      })
    ).toEqual([
      { label: "Console", href: "/en/console" },
      { label: "App", href: "/en/console/app" },
      { label: "Platforms", href: "/en/console/app/platforms" },
      { label: "Sample App", href: undefined },
    ])

    expect(
      buildAppBreadcrumbItems({
        pathname: "/en/console/app/platform/sample-app/terminal",
        rootSegment: "console",
      })
    ).toEqual([
      { label: "Console", href: "/en/console" },
      { label: "App", href: "/en/console/app" },
      { label: "Platforms", href: "/en/console/app/platforms" },
      { label: "Sample App", href: "/en/console/app/platform/sample-app" },
      { label: "Terminal", href: undefined },
    ])
  })

  it("maps intermediate AI Studio route to console ai agents landing page", () => {
    expect(
      buildAppBreadcrumbItems({
        pathname: "/en/console/ai/knowledge",
        rootSegment: "console",
      })
    ).toEqual([
      { label: "Console", href: "/en/console" },
      { label: "AI Studio", href: "/en/console/ai/agents" },
      { label: "Knowledge Base", href: undefined },
    ])
  })

  it("maps catalog products and portal system routes to valid endpoints", () => {
    expect(
      buildAppBreadcrumbItems({
        pathname: "/en/portal/billing/catalog/products/new",
        rootSegment: "portal",
      })
    ).toEqual([
      { label: "Portal", href: "/en/portal" },
      { label: "Billing", href: "/en/portal/billing" },
      { label: "Catalog", href: "/en/portal/billing/catalog" },
      { label: "Products", href: "/en/portal/billing/catalog" },
      { label: "New Product", href: undefined },
    ])

    expect(
      buildAppBreadcrumbItems({
        pathname: "/en/portal/system/cronjobs",
        rootSegment: "portal",
      })
    ).toEqual([
      { label: "Portal", href: "/en/portal" },
      { label: "System", href: "/en/portal/system/cronjobs" },
      { label: "CronJobs & Workers", href: undefined },
    ])
  })
})
