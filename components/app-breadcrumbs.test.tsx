import { describe, expect, it } from "bun:test"

import { buildAppBreadcrumbItems } from "@/components/app-breadcrumbs"

describe("buildAppBreadcrumbItems", () => {
  it("renders only the root crumb for the localized console root", () => {
    expect(
      buildAppBreadcrumbItems({ pathname: "/en/console", rootSegment: "console" })
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
})
