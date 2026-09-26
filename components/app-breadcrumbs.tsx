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
  addons: "Add-ons",
  admin: "Admin",
  agents: "AI Agents",
  ai: "AI Studio",
  alerts: "Alerts",
  analytics: "Analytics",
  "api-keys": "API Keys",
  app: "App",
  "audit-logs": "Audit Logs",
  billing: "Billing",
  broadcasts: "Broadcasts",
  builder: "Template Builder",
  catalog: "Catalog",
  catalogs: "Catalogs",
  clusters: "Clusters",
  connections: "Connections",
  console: "Console",
  contacts: "Contacts",
  credentials: "Credentials",
  cronjobs: "CronJobs & Workers",
  "delivery-logs": "Delivery Logs",
  deploy: "Deploy",
  deployments: "Deployments",
  detector: "Detector",
  devices: "Devices",
  documentations: "Documentation",
  events: "Events",
  invitations: "Invitations",
  invoices: "Invoices",
  knowledge: "Knowledge Base",
  manage: "Manage",
  "managed-stocks": "Managed Stocks",
  marketplace: "Marketplace",
  members: "Members",
  messages: "Messages",
  "meta-apps": "Meta Apps",
  metrics: "Metrics",
  "my-templates": "My Templates",
  new: "New",
  organization: "Organization",
  organizations: "Organizations",
  ownership: "Ownership",
  packages: "Packages",
  "payment-methods": "Payment Methods",
  platform: "Platforms",
  platforms: "Platforms",
  portal: "Portal",
  pricing: "Pricing",
  products: "Products",
  profiles: "Profiles",
  promotions: "Promotions",
  providers: "BYOK Providers",
  regions: "Regions",
  servers: "Servers",
  settings: "Settings",
  "ssh-keys": "SSH Keys",
  stacks: "Stacks",
  storage: "Storage Audit",
  subscriptions: "Subscriptions",
  "support-tickets": "Support Tickets",
  system: "System",
  templates: "Templates",
  terminal: "Terminal",
  topup: "Top Up",
  transactions: "Transactions",
  vouchers: "Vouchers",
  vpn: "VPN",
  "webhook-logs": "Webhook Logs",
  whatsapp: "WhatsApp",
  workflows: "Workflows",
}

const DETAIL_LABELS_BY_PARENT: Record<string, string> = {
  addons: "Addon Detail",
  agents: "Agent Detail",
  broadcasts: "Broadcast Detail",
  catalogs: "Catalog Detail",
  clusters: "Cluster Detail",
  devices: "Device Detail",
  invoices: "Invoice Detail",
  messages: "Message Journey",
  organizations: "Organization Detail",
  orgs: "Organization Detail",
  platform: "Platform Detail",
  platforms: "Platform Detail",
  products: "Product Detail",
  promotions: "Promotion Detail",
  servers: "Server Detail",
  services: "Service Detail",
  subscriptions: "Subscription Detail",
  "support-tickets": "Support Ticket Detail",
  templates: "Template Detail",
  webhooks: "Webhook Detail",
  workflows: "Workflow Detail",
}

const NEW_LABELS_BY_PARENT: Record<string, string> = {
  addons: "New Add-on",
  agents: "New Agent",
  broadcasts: "New Broadcast",
  credentials: "New Credential",
  devices: "New Device",
  products: "New Product",
  promotions: "New Promotion",
  "support-tickets": "New Ticket",
  templates: "New Template",
  workflows: "New Workflow",
}

const RELATIVE_HREF_OVERRIDES: Record<string, string> = {
  "console/app/platform": "console/app/platforms",
  "console/ai": "console/ai/agents",
  "console/billing/payments": "console/billing",
  "portal/billing/catalog/products": "portal/billing/catalog",
  "portal/settings": "portal/settings/emails",
  "portal/system": "portal/system/cronjobs",
  "portal/app/events": "portal/app",
  "portal/billing/org": "portal/orgs",
  admin: "portal/admin",
  "admin/whatsapp": "portal/whatsapp/devices",
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
    const relativeSubpath = breadcrumbSegments.slice(0, index + 1).join("/")
    const targetSubpath =
      RELATIVE_HREF_OVERRIDES[relativeSubpath] ?? relativeSubpath
    const hrefSegments = [...baseSegments, ...targetSubpath.split("/")]

    return {
      label: labelForSegment(
        segment,
        parentSegment,
        rootSegment,
        breadcrumbSegments
      ),
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
              <BreadcrumbItem
                className={index === 0 ? "hidden md:block" : undefined}
              >
                {isLast || !item.href ? (
                  <BreadcrumbPage>{item.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink href={item.href}>{item.label}</BreadcrumbLink>
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

function labelForSegment(
  segment: string,
  parentSegment?: string,
  rootSegment?: AppRootSegment,
  breadcrumbSegments?: string[]
): string {
  if (
    rootSegment === "portal" &&
    segment === "subscriptions" &&
    breadcrumbSegments?.includes("vpn")
  ) {
    return "VPN Operations"
  }

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
    /^\d+$/.test(segment) ||
    /^[a-z0-9]+_[a-z0-9]+$/i.test(segment) ||
    /^wamid\./i.test(segment) ||
    /^c[a-z0-9]{20,}$/i.test(segment) ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      segment
    )
  )
}
function toTitleCase(segment: string): string {
  return segment
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}
