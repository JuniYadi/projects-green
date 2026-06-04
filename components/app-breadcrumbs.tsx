"use client"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { usePathname } from "next/navigation"
import { Fragment } from "react"

type AppRootSegment = "admin" | "console" | "portal"

type BreadcrumbItemModel = {
  label: string
  href?: string
}

type BuildAppBreadcrumbItemsOptions = {
  pathname: string
  rootSegment: AppRootSegment
}

type AppBreadcrumbsProps = {
  rootSegment: AppRootSegment
}

const SEGMENT_LABELS: Record<string, string> = {
  admin: "Admin",
  alerts: "Alerts",
  app: "App",
  billing: "Billing",
  console: "Console",
  devices: "Devices",
  documentations: "Documentation",
  invoices: "Invoices",
  new: "New",
  organization: "Organization",
  organizations: "Organizations",
  portal: "Portal",
  "payment-methods": "Payment Methods",
  settings: "Settings",
  "support-tickets": "Support Tickets",
  templates: "Templates",
  whatsapp: "WhatsApp",
}

const DETAIL_LABELS_BY_PARENT: Record<string, string> = {
  invoices: "Invoice Detail",
  organizations: "Organization Detail",
  "support-tickets": "Support Ticket Detail",
  templates: "Template Detail",
}

const NEW_LABELS_BY_PARENT: Record<string, string> = {
  templates: "New Template",
}

export function buildAppBreadcrumbItems({
  pathname,
  rootSegment,
}: BuildAppBreadcrumbItemsOptions): BreadcrumbItemModel[] {
  const pathWithoutQuery = pathname.split(/[?#]/)[0] ?? pathname
  const segments = pathWithoutQuery.split("/").filter(Boolean)
  const rootIndex = segments.indexOf(rootSegment)

  if (rootIndex === -1) {
    return [{ label: labelForSegment(rootSegment) }]
  }

  const baseSegments = segments.slice(0, rootIndex)
  const breadcrumbSegments = segments.slice(rootIndex)

  return breadcrumbSegments.map((segment, index) => {
    const isLast = index === breadcrumbSegments.length - 1
    const parentSegment = breadcrumbSegments[index - 1]
    const hrefSegments = [...baseSegments, ...breadcrumbSegments.slice(0, index + 1)]

    return {
      label: labelForSegment(segment, parentSegment),
      href: isLast ? undefined : `/${hrefSegments.join("/")}`,
    }
  })
}

export function AppBreadcrumbs({ rootSegment }: AppBreadcrumbsProps) {
  const pathname = usePathname()
  const items = buildAppBreadcrumbItems({ pathname, rootSegment })

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {items.map((item, index) => {
          const isLast = index === items.length - 1

          return (
            <Fragment key={`${item.href ?? item.label}-${index}`}>
              <BreadcrumbItem className={index === 0 ? "hidden md:block" : undefined}>
                {isLast ? (
                  <BreadcrumbPage>{item.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink href={item.href ?? "#"}>{item.label}</BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast ? (
                <BreadcrumbSeparator className="hidden md:block" />
              ) : null}
            </Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}

function labelForSegment(segment: string, parentSegment?: string): string {
  if (parentSegment && isDetailSegment(segment)) {
    return DETAIL_LABELS_BY_PARENT[parentSegment] ?? "Detail"
  }

  if (parentSegment && segment === "new") {
    return NEW_LABELS_BY_PARENT[parentSegment] ?? "New"
  }

  return SEGMENT_LABELS[segment] ?? toTitleCase(segment)
}

function isDetailSegment(segment: string): boolean {
  return (
    /^[a-z]+_[a-zA-Z0-9]+$/.test(segment) ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(segment)
  )
}

function toTitleCase(segment: string): string {
  return segment
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}
