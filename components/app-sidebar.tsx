"use client"

import * as React from "react"
import { usePathname, useSearchParams } from "next/navigation"

import { localizePathname, getLocaleFromPathname } from "@/lib/i18n/pathname"
import { NavMain } from "@/components/nav-main"
import { NavProjects } from "@/components/nav-projects"
import { NavOrganization } from "@/components/nav-organization"
import { NavSecondary, type NavSecondaryItem } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar"
import {
  BookOpenIcon,
  BuildingsIcon,
  CaretLeftIcon,
  ChartLine as ChartLineIcon,
  Clock as ClockIcon,
  CrosshairIcon,
  DeviceMobileIcon,
  GaugeIcon,
  GlobeIcon,
  HardDrivesIcon,
  DatabaseIcon,
  KeyIcon,
  LifebuoyIcon,
  Lightning,
  ListMagnifyingGlassIcon,
  MapPinIcon,
  PackageIcon,
  PaperPlaneTiltIcon,
  ReceiptIcon,
  RocketLaunchIcon,
  ShoppingBagOpen,
  GearSixIcon,
  ShieldCheckIcon,
  TicketIcon,
  WalletIcon,
  WhatsappLogoIcon,
  Robot as RobotIcon,
  Brain as BrainIcon,
  FileText as FileTextIcon,
  Storefront as StorefrontIcon,
} from "@phosphor-icons/react"
import { defaultLocale, type AppLocale } from "@/lib/i18n/config"
import { useWhatsAppOnboardingStore } from "@/modules/whatsapp/onboarding/whatsapp-onboarding.store"
const getPathnameWithoutSearch = (pathname: string) => pathname.split("?")[0]

const startsWithRoute = (pathname: string, route: string) => {
  const normalizedPathname = getPathnameWithoutSearch(pathname)
  return (
    normalizedPathname === route || normalizedPathname.startsWith(`${route}/`)
  )
}

export type AppSidebarSurface = "console" | "portal" | "admin"

export type AppSidebarUser = {
  name: string
  email: string
  avatarUrl: string | null
}

export type AppSidebarOrganization = {
  id: string | null
  name: string | null
}
export type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  surface: AppSidebarSurface
  user: AppSidebarUser
  organization: AppSidebarOrganization
}

type AppSidebarNavItem = {
  title: string
  url: string
  icon: React.ReactNode
  isActive?: boolean
  isLocked?: boolean
  items?: {
    title: string
    url: string
    isActive?: boolean
    isLocked?: boolean
  }[]
}

type AppSidebarProject = {
  name: string
  url: string
  icon: React.ReactNode
  isActive?: boolean
}
interface SidebarContextConfig {
  context: string
  matches: (pathname: string) => boolean
  getProjects: (pathname: string, locale: AppLocale) => AppSidebarProject[]
  getNavMain: (
    pathname: string,
    locale: AppLocale,
    tab?: string,
    isGraduated?: boolean
  ) => AppSidebarNavItem[]
  getNavHeader?: (pathname: string, locale: AppLocale) => React.ReactNode
  navMainLabel: string
}

const PORTAL_CONTEXTS: SidebarContextConfig[] = [
  {
    context: "admin",
    matches: (path) => startsWithRoute(path, "/portal/admin"),
    navMainLabel: "Admin",
    getProjects: (path, locale) => [
      {
        name: "Organizations",
        url: localizePathname({
          pathname: "/portal/admin/organizations",
          locale,
        }),
        icon: <BuildingsIcon />,
        isActive: startsWithRoute(path, "/portal/admin/organizations"),
      },
      {
        name: "Back to Portal",
        url: localizePathname({ pathname: "/portal", locale }),
        icon: <CaretLeftIcon />,
      },
    ],
    getNavMain: (path, locale) => [
      {
        title: "Organizations",
        url: localizePathname({
          pathname: "/portal/admin/organizations",
          locale,
        }),
        icon: <BuildingsIcon />,
        isActive: startsWithRoute(path, "/portal/admin/organizations"),
      },
    ],
  },
  {
    context: "system",
    matches: (path) =>
      startsWithRoute(path, "/portal/system") ||
      startsWithRoute(path, "/portal/settings/emails") ||
      startsWithRoute(path, "/portal/ai") ||
      startsWithRoute(path, "/portal/storage"),
    navMainLabel: "Systems",
    getProjects: (_path, locale) => [
      {
        name: "Back to Portal",
        url: localizePathname({ pathname: "/portal", locale }),
        icon: <CaretLeftIcon />,
      },
    ],
    getNavMain: (path, locale) => [
      {
        title: "CronJobs & Workers",
        url: localizePathname({
          pathname: "/portal/system/cronjobs",
          locale,
        }),
        icon: <ClockIcon />,
        isActive: startsWithRoute(path, "/portal/system/cronjobs"),
      },
      {
        title: "AI Governance",
        url: localizePathname({
          pathname: "/portal/ai",
          locale,
        }),
        icon: <ShieldCheckIcon />,
        isActive: startsWithRoute(path, "/portal/ai"),
      },
      {
        title: "Storage Audit",
        url: localizePathname({
          pathname: "/portal/storage",
          locale,
        }),
        icon: <HardDrivesIcon />,
        isActive: startsWithRoute(path, "/portal/storage"),
      },
      {
        title: "Email Templates",
        url: localizePathname({
          pathname: "/portal/settings/emails",
          locale,
        }),
        icon: <PaperPlaneTiltIcon />,
        isActive:
          startsWithRoute(path, "/portal/settings/emails") &&
          !startsWithRoute(path, "/portal/settings/emails/delivery-logs"),
      },
      {
        title: "Email Logs",
        url: localizePathname({
          pathname: "/portal/settings/emails/delivery-logs",
          locale,
        }),
        icon: <ListMagnifyingGlassIcon />,
        isActive: startsWithRoute(
          path,
          "/portal/settings/emails/delivery-logs"
        ),
      },
    ],
  },
  {
    context: "orgs",
    matches: (path) => startsWithRoute(path, "/portal/orgs"),
    navMainLabel: "Organizations",
    getProjects: (path, locale) => [
      {
        name: "Back to Portal",
        url: localizePathname({ pathname: "/portal", locale }),
        icon: <CaretLeftIcon />,
      },
    ],
    getNavMain: (path, locale) => [
      {
        title: "Overview",
        url: localizePathname({ pathname: "/portal/orgs", locale }),
        icon: <GaugeIcon />,
        isActive: startsWithRoute(path, "/portal/orgs"),
      },
    ],
  },
  {
    context: "billing",
    matches: (path) => startsWithRoute(path, "/portal/billing"),
    navMainLabel: "Billing",
    getProjects: (_path, locale) => [
      {
        name: "Back to Portal",
        url: localizePathname({ pathname: "/portal", locale }),
        icon: <CaretLeftIcon />,
      },
    ],
    getNavMain: (path, locale, _tab) => {
      return [
        {
          title: "Overview",
          url: localizePathname({ pathname: "/portal/billing", locale }),
          icon: <GaugeIcon />,
          isActive: path === "/portal/billing",
        },
        {
          title: "Org Overview",
          url: localizePathname({ pathname: "/portal/orgs", locale }),
          icon: <BuildingsIcon />,
          isActive: startsWithRoute(path, "/portal/orgs"),
        },
        {
          title: "Invoices",
          url: localizePathname({
            pathname: "/portal/billing/invoices",
            locale,
          }),
          icon: <ReceiptIcon />,
          isActive: startsWithRoute(path, "/portal/billing/invoices"),
        },
        {
          title: "Payments",
          url: localizePathname({
            pathname: "/portal/billing/payments",
            locale,
          }),
          icon: <WalletIcon />,
          isActive: startsWithRoute(path, "/portal/billing/payments"),
        },
        {
          title: "Promotions",
          url: localizePathname({
            pathname: "/portal/billing/promotions",
            locale,
          }),
          icon: <TicketIcon />,
          isActive: startsWithRoute(path, "/portal/billing/promotions"),
        },
        {
          title: "Audit Logs",
          url: localizePathname({
            pathname: "/portal/billing/audit-logs",
            locale,
          }),
          icon: <ListMagnifyingGlassIcon />,
          isActive: startsWithRoute(path, "/portal/billing/audit-logs"),
        },
        {
          title: "Catalog",
          url: localizePathname({
            pathname: "/portal/billing/catalog",
            locale,
          }),
          icon: <PackageIcon />,
          isActive: startsWithRoute(path, "/portal/billing/catalog"),
        },
        {
          title: "Regions",
          url: localizePathname({
            pathname: "/portal/billing/regions",
            locale,
          }),
          icon: <MapPinIcon />,
          isActive: startsWithRoute(path, "/portal/billing/regions"),
        },
        {
          title: "Orders",
          url: localizePathname({ pathname: "/portal/billing/orders", locale }),
          icon: <ReceiptIcon />,
          isActive: startsWithRoute(path, "/portal/billing/orders"),
        },
      ]
    },
  },
  {
    context: "vpn",
    matches: (path) => startsWithRoute(path, "/portal/vpn"),
    navMainLabel: "VPN",
    getProjects: (path, locale) => [
      {
        name: "Back to Portal",
        url: localizePathname({ pathname: "/portal", locale }),
        icon: <CaretLeftIcon />,
      },
    ],
    getNavMain: (path, locale) => [
      {
        title: "Overview",
        url: localizePathname({ pathname: "/portal/vpn", locale }),
        icon: <GlobeIcon />,
        isActive: path === "/portal/vpn",
      },
      {
        title: "SSH Keys",
        url: localizePathname({ pathname: "/portal/vpn/ssh-keys", locale }),
        icon: <ShieldCheckIcon />,
        isActive: startsWithRoute(path, "/portal/vpn/ssh-keys"),
      },
      {
        title: "Regions",
        url: localizePathname({ pathname: "/portal/vpn/regions", locale }),
        icon: <MapPinIcon />,
        isActive: startsWithRoute(path, "/portal/vpn/regions"),
      },
      {
        title: "Servers",
        url: localizePathname({ pathname: "/portal/vpn/servers", locale }),
        icon: <HardDrivesIcon />,
        isActive: startsWithRoute(path, "/portal/vpn/servers"),
      },
      {
        title: "VPN Operations",
        url: localizePathname({
          pathname: "/portal/vpn/subscriptions",
          locale,
        }),
        icon: <ReceiptIcon />,
        isActive: startsWithRoute(path, "/portal/vpn/subscriptions"),
      },
      {
        title: "Devices",
        url: localizePathname({
          pathname: "/portal/vpn/devices",
          locale,
        }),
        icon: <DeviceMobileIcon />,
        isActive: startsWithRoute(path, "/portal/vpn/devices"),
      },
      {
        title: "Audit Logs",
        url: localizePathname({
          pathname: "/portal/vpn/audit-logs",
          locale,
        }),
        icon: <ListMagnifyingGlassIcon />,
        isActive: startsWithRoute(path, "/portal/vpn/audit-logs"),
      },
      {
        title: "WireGuard",
        url: localizePathname({
          pathname: "/portal/vpn/wireguard",
          locale,
        }),
        icon: <ShieldCheckIcon />,
        isActive: startsWithRoute(path, "/portal/vpn/wireguard"),
      },
    ],
  },
  {
    context: "app-hosting",
    matches: (path) => startsWithRoute(path, "/portal/app"),
    navMainLabel: "App Hosting",
    getProjects: (path, locale) => [
      {
        name: "Back to Portal",
        url: localizePathname({ pathname: "/portal", locale }),
        icon: <CaretLeftIcon />,
      },
    ],
    getNavMain: (path, locale) => [
      {
        title: "Overview",
        url: localizePathname({ pathname: "/portal/app", locale }),
        icon: <GaugeIcon />,
        isActive: path === "/portal/app",
      },
      {
        title: "Clusters",
        url: localizePathname({
          pathname: "/portal/app/clusters",
          locale,
        }),
        icon: <HardDrivesIcon />,
        isActive: startsWithRoute(path, "/portal/app/clusters"),
      },
      {
        title: "Templates",
        url: localizePathname({
          pathname: "/portal/app/templates",
          locale,
        }),
        icon: <StorefrontIcon />,
        isActive:
          startsWithRoute(path, "/portal/app/templates") ||
          startsWithRoute(path, "/portal/marketplace"),
      },
      {
        title: "Managed Stocks",
        url: localizePathname({
          pathname: "/portal/app/managed-stocks",
          locale,
        }),
        icon: <DatabaseIcon />,
        isActive: startsWithRoute(path, "/portal/app/managed-stocks"),
      },
      {
        title: "Events",
        url: localizePathname({
          pathname: "/portal/app/events/github",
          locale,
        }),
        icon: <ListMagnifyingGlassIcon />,
        isActive: startsWithRoute(path, "/portal/app/events"),
      },
      {
        title: "Detector Control",
        url: localizePathname({
          pathname: "/portal/app/detector",
          locale,
        }),
        icon: <CrosshairIcon />,
        isActive: startsWithRoute(path, "/portal/app/detector"),
      },
      {
        title: "Settings",
        url: localizePathname({ pathname: "/portal/app/settings", locale }),
        icon: <GearSixIcon />,
        isActive: startsWithRoute(path, "/portal/app/settings"),
      },
    ],
  },
  {
    context: "whatsapp",
    matches: (path) => startsWithRoute(path, "/portal/whatsapp"),
    navMainLabel: "WhatsApp",
    getProjects: (path, locale) => [
      {
        name: "Back to Portal",
        url: localizePathname({ pathname: "/portal", locale }),
        icon: <CaretLeftIcon />,
      },
    ],
    getNavMain: (path, locale) => [
      {
        title: "Dashboard",
        url: localizePathname({
          pathname: "/portal/whatsapp",
          locale,
        }),
        icon: <GaugeIcon />,
        isActive: path === "/portal/whatsapp",
      },
      {
        title: "API Keys",
        url: localizePathname({
          pathname: "/portal/whatsapp/api-keys",
          locale,
        }),
        icon: <KeyIcon />,
        isActive: startsWithRoute(path, "/portal/whatsapp/api-keys"),
      },
      {
        title: "Meta Apps",
        url: localizePathname({
          pathname: "/portal/whatsapp/meta-apps",
          locale,
        }),
        icon: <GearSixIcon />,
        isActive: startsWithRoute(path, "/portal/whatsapp/meta-apps"),
      },
      {
        title: "Devices",
        url: localizePathname({
          pathname: "/portal/whatsapp/devices",
          locale,
        }),
        icon: <WhatsappLogoIcon />,
        isActive: startsWithRoute(path, "/portal/whatsapp/devices"),
      },
      {
        title: "Templates",
        url: localizePathname({
          pathname: "/portal/whatsapp/templates",
          locale,
        }),
        icon: <Lightning />,
        isActive: startsWithRoute(path, "/portal/whatsapp/templates"),
      },
      {
        title: "Messages",
        url: localizePathname({
          pathname: "/portal/whatsapp/messages",
          locale,
        }),
        icon: <PaperPlaneTiltIcon />,
        isActive: startsWithRoute(path, "/portal/whatsapp/messages"),
      },
      {
        title: "Broadcasts",
        url: localizePathname({
          pathname: "/portal/whatsapp/broadcasts",
          locale,
        }),
        icon: <RocketLaunchIcon />,
        isActive: startsWithRoute(path, "/portal/whatsapp/broadcasts"),
      },
      {
        title: "Usage",
        url: localizePathname({
          pathname: "/portal/whatsapp/usage",
          locale,
        }),
        icon: <ChartLineIcon />,
        isActive: startsWithRoute(path, "/portal/whatsapp/usage"),
      },
      {
        title: "Ledger",
        url: localizePathname({
          pathname: "/portal/whatsapp/ledger",
          locale,
        }),
        icon: <ReceiptIcon />,
        isActive: startsWithRoute(path, "/portal/whatsapp/ledger"),
      },
      {
        title: "Pricing",
        url: localizePathname({
          pathname: "/portal/whatsapp/pricing",
          locale,
        }),
        icon: <ReceiptIcon />,
        isActive: startsWithRoute(path, "/portal/whatsapp/pricing"),
      },
      {
        title: "Contacts",
        url: localizePathname({
          pathname: "/portal/whatsapp/contacts",
          locale,
        }),
        icon: <BookOpenIcon />,
        isActive: startsWithRoute(path, "/portal/whatsapp/contacts"),
      },
      {
        title: "Catalogs",
        url: localizePathname({
          pathname: "/portal/whatsapp/catalogs",
          locale,
        }),
        icon: <ShoppingBagOpen />,
        isActive: startsWithRoute(path, "/portal/whatsapp/catalogs"),
      },
      {
        title: "Webhook Logs",
        url: localizePathname({
          pathname: "/portal/whatsapp/webhook-logs",
          locale,
        }),
        icon: <ListMagnifyingGlassIcon />,
        isActive: startsWithRoute(path, "/portal/whatsapp/webhook-logs"),
      },
      {
        title: "Audit Logs",
        url: localizePathname({
          pathname: "/portal/whatsapp/audit-logs",
          locale,
        }),
        icon: <ListMagnifyingGlassIcon />,
        isActive: startsWithRoute(path, "/portal/whatsapp/audit-logs"),
      },
    ],
  },
]

const CONSOLE_CONTEXTS: SidebarContextConfig[] = [
  {
    context: "billing",
    matches: (path) => startsWithRoute(path, "/console/billing"),
    navMainLabel: "Billing",
    getProjects: (_path, locale) => [
      {
        name: "Back to Console",
        url: localizePathname({ pathname: "/console", locale }),
        icon: <CaretLeftIcon />,
      },
    ],
    getNavMain: (path, locale) => [
      {
        title: "Overview",
        url: localizePathname({ pathname: "/console/billing", locale }),
        icon: <GaugeIcon />,
        isActive: path === "/console/billing",
      },
      {
        title: "Services",
        url: localizePathname({
          pathname: "/console/billing/services",
          locale,
        }),
        icon: <PackageIcon />,
        isActive: startsWithRoute(path, "/console/billing/services"),
      },
      {
        title: "Subscriptions",
        url: localizePathname({
          pathname: "/console/billing/subscriptions",
          locale,
        }),
        icon: <ReceiptIcon />,
        isActive: startsWithRoute(path, "/console/billing/subscriptions"),
      },
      {
        title: "Invoices",
        url: localizePathname({
          pathname: "/console/billing/invoices",
          locale,
        }),
        icon: <ReceiptIcon />,
        isActive: startsWithRoute(path, "/console/billing/invoices"),
      },
      {
        title: "Usage",
        url: localizePathname({ pathname: "/console/billing/usage", locale }),
        icon: <ChartLineIcon />,
        isActive: startsWithRoute(path, "/console/billing/usage"),
      },
      {
        title: "Alerts",
        url: localizePathname({ pathname: "/console/billing/alerts", locale }),
        icon: <Lightning />,
        isActive: startsWithRoute(path, "/console/billing/alerts"),
      },
      {
        title: "Transactions",
        url: localizePathname({
          pathname: "/console/billing/transactions",
          locale,
        }),
        icon: <WalletIcon />,
        isActive: startsWithRoute(path, "/console/billing/transactions"),
      },
      {
        title: "Vouchers",
        url: localizePathname({
          pathname: "/console/billing/vouchers",
          locale,
        }),
        icon: <TicketIcon />,
        isActive: startsWithRoute(path, "/console/billing/vouchers"),
      },
      {
        title: "Contacts",
        url: localizePathname({
          pathname: "/console/billing/contacts",
          locale,
        }),
        icon: <BuildingsIcon />,
        isActive: startsWithRoute(path, "/console/billing/contacts"),
      },
      {
        title: "Settings",
        url: localizePathname({
          pathname: "/console/billing/settings",
          locale,
        }),
        icon: <GearSixIcon />,
        isActive: startsWithRoute(path, "/console/billing/settings"),
      },
    ],
  },
  {
    context: "applications",
    matches: (path) => startsWithRoute(path, "/console/app"),
    navMainLabel: "App Hosting",
    getProjects: (path, locale) => [
      {
        name: "Back to Console",
        url: localizePathname({ pathname: "/console", locale }),
        icon: <CaretLeftIcon />,
      },
    ],
    getNavMain: (path, locale) => [
      {
        title: "Deploy",
        url: localizePathname({ pathname: "/console/app/deploy", locale }),
        icon: <RocketLaunchIcon />,
        isActive: path === "/console/app/deploy",
      },
      {
        title: "Marketplace",
        url: localizePathname({ pathname: "/console/app/marketplace", locale }),
        icon: <StorefrontIcon />,
        isActive: startsWithRoute(path, "/console/app/marketplace"),
      },
      {
        title: "Deployments",
        url: localizePathname({ pathname: "/console/app/deployments", locale }),
        icon: <ListMagnifyingGlassIcon />,
        isActive: startsWithRoute(path, "/console/app/deployments"),
      },
      {
        title: "Overview",
        url: localizePathname({ pathname: "/console/app", locale }),
        icon: <GaugeIcon />,
        isActive: path === "/console/app",
      },
      {
        title: "Logs",
        url: localizePathname({ pathname: "/console/app/logs", locale }),
        icon: <ListMagnifyingGlassIcon />,
        isActive: startsWithRoute(path, "/console/app/logs"),
      },
      {
        title: "Metrics",
        url: localizePathname({ pathname: "/console/app/metrics", locale }),
        icon: <ChartLineIcon />,
        isActive: startsWithRoute(path, "/console/app/metrics"),
      },
      {
        title: "Settings",
        url: localizePathname({ pathname: "/console/app/settings", locale }),
        icon: <GearSixIcon />,
        isActive: startsWithRoute(path, "/console/app/settings"),
      },
      {
        title: "Credentials",
        url: localizePathname({ pathname: "/console/app/credentials", locale }),
        icon: <ShieldCheckIcon />,
        isActive: path === "/console/app/credentials",
      },
    ],
  },
  {
    context: "whatsapp",
    matches: (path) => startsWithRoute(path, "/console/whatsapp"),
    navMainLabel: "WhatsApp",
    getProjects: (path, locale) => [
      {
        name: "Back to Console",
        url: localizePathname({ pathname: "/console", locale }),
        icon: <CaretLeftIcon />,
      },
    ],
    getNavMain: (path, locale, _tab, isGraduated = false) => {
      return [
        {
          title: "Dashboard",
          url: localizePathname({
            pathname: "/console/whatsapp/dashboard",
            locale,
          }),
          icon: <GaugeIcon />,
          isActive: startsWithRoute(path, "/console/whatsapp/dashboard"),
        },
        {
          title: "API Keys",
          url: localizePathname({
            pathname: "/console/whatsapp/api-keys",
            locale,
          }),
          icon: <KeyIcon />,
          isActive: startsWithRoute(path, "/console/whatsapp/api-keys"),
          isLocked: !isGraduated,
        },
        {
          title: "Usage",
          url: localizePathname({
            pathname: "/console/whatsapp/usage",
            locale,
          }),
          icon: <ChartLineIcon />,
          isActive: startsWithRoute(path, "/console/whatsapp/usage"),
        },
        {
          title: locale === "id" ? "Tarif & Biaya" : "Pricing & Costs",
          url: localizePathname({
            pathname: "/console/whatsapp/pricing",
            locale,
          }),
          icon: <ReceiptIcon />,
          isActive:
            startsWithRoute(path, "/console/whatsapp/pricing") ||
            startsWithRoute(path, "/console/whatsapp/ledger"),
          isLocked: !isGraduated,
        },
        {
          title: "Devices",
          url: localizePathname({
            pathname: "/console/whatsapp/devices",
            locale,
          }),
          icon: <WhatsappLogoIcon />,
          isActive: startsWithRoute(path, "/console/whatsapp/devices"),
        },
        {
          title: "Templates",
          url: localizePathname({
            pathname: "/console/whatsapp/templates",
            locale,
          }),
          icon: <Lightning />,
          isActive: startsWithRoute(path, "/console/whatsapp/templates"),
        },
        {
          title: "Messages",
          url: localizePathname({
            pathname: "/console/whatsapp/messages",
            locale,
          }),
          icon: <PaperPlaneTiltIcon />,
          isActive: startsWithRoute(path, "/console/whatsapp/messages"),
        },
        {
          title: "Broadcasts",
          url: localizePathname({
            pathname: "/console/whatsapp/broadcasts",
            locale,
          }),
          icon: <RocketLaunchIcon />,
          isActive: startsWithRoute(path, "/console/whatsapp/broadcasts"),
          isLocked: !isGraduated,
        },
        {
          title: "AI & Bot Builder",
          url: localizePathname({
            pathname: "/console/whatsapp/workflows",
            locale,
          }),
          icon: <RobotIcon />,
          isActive: startsWithRoute(path, "/console/whatsapp/workflows"),
        },
        {
          title: "Contacts",
          url: localizePathname({
            pathname: "/console/whatsapp/contacts",
            locale,
          }),
          icon: <BookOpenIcon />,
          isActive: startsWithRoute(path, "/console/whatsapp/contacts"),
        },
        {
          title: "Catalogs",
          url: localizePathname({
            pathname: "/console/whatsapp/catalogs",
            locale,
          }),
          icon: <ShoppingBagOpen />,
          isActive: startsWithRoute(path, "/console/whatsapp/catalogs"),
          isLocked: !isGraduated,
        },
        {
          title: "Webhook Logs",
          url: localizePathname({
            pathname: "/console/whatsapp/webhook-logs",
            locale,
          }),
          icon: <ListMagnifyingGlassIcon />,
          isActive: startsWithRoute(path, "/console/whatsapp/webhook-logs"),
          isLocked: !isGraduated,
        },
        {
          title: "Audit Logs",
          url: localizePathname({
            pathname: "/console/whatsapp/audit-logs",
            locale,
          }),
          icon: <ListMagnifyingGlassIcon />,
          isActive: startsWithRoute(path, "/console/whatsapp/audit-logs"),
          isLocked: !isGraduated,
        },
      ]
    },
  },
  {
    context: "vpn",
    matches: (path) => startsWithRoute(path, "/console/vpn"),
    navMainLabel: "VPN",
    getProjects: (path, locale) => [
      {
        name: "Back to Console",
        url: localizePathname({ pathname: "/console", locale }),
        icon: <CaretLeftIcon />,
      },
    ],
    getNavMain: (path, locale) => [
      {
        title: "Dashboard",
        url: localizePathname({
          pathname: "/console/vpn/dashboard",
          locale,
        }),
        icon: <GaugeIcon />,
        isActive: path === "/console/vpn/dashboard",
      },
      {
        title: locale === "id" ? "Profil Akses" : "Access Profiles",
        url: localizePathname({
          pathname: "/console/vpn/profiles",
          locale,
        }),
        icon: <ReceiptIcon />,
        isActive: startsWithRoute(path, "/console/vpn/profiles"),
      },
      {
        title: "Devices",
        url: localizePathname({
          pathname: "/console/vpn/devices",
          locale,
        }),
        icon: <DeviceMobileIcon />,
        isActive: startsWithRoute(path, "/console/vpn/devices"),
      },
    ],
  },
  {
    context: "ai",
    matches: (path) => startsWithRoute(path, "/console/ai"),
    navMainLabel: "AI Studio",
    getProjects: (path, locale) => [
      {
        name: "Back to Console",
        url: localizePathname({ pathname: "/console", locale }),
        icon: <CaretLeftIcon />,
      },
    ],
    getNavMain: (path, locale) => [
      {
        title: "AI Agents",
        url: localizePathname({
          pathname: "/console/ai/agents",
          locale,
        }),
        icon: <RobotIcon />,
        isActive: startsWithRoute(path, "/console/ai/agents"),
      },
      {
        title: "Knowledge Base",
        url: localizePathname({
          pathname: "/console/ai/knowledge",
          locale,
        }),
        icon: <FileTextIcon />,
        isActive: startsWithRoute(path, "/console/ai/knowledge"),
      },
      {
        title: "BYOK Providers",
        url: localizePathname({
          pathname: "/console/ai/providers",
          locale,
        }),
        icon: <KeyIcon />,
        isActive: startsWithRoute(path, "/console/ai/providers"),
      },
    ],
  },
]

const getHubMenu = (path: string, locale: AppLocale) => ({
  projects: [
    {
      name: "Overview",
      url: localizePathname({ pathname: "/console", locale }),
      icon: <GaugeIcon />,
      isActive: path === "/console",
    },
    {
      name: "Billing",
      url: localizePathname({ pathname: "/console/billing", locale }),
      icon: <WalletIcon />,
      isActive: startsWithRoute(path, "/console/billing"),
    },
    {
      name: "Support Tickets",
      url: localizePathname({ pathname: "/console/support-tickets", locale }),
      icon: <LifebuoyIcon />,
      isActive: startsWithRoute(path, "/console/support-tickets"),
    },
  ],
  navMain: [
    {
      title: "App Hosting",
      url: localizePathname({ pathname: "/console/app", locale }),
      icon: <RocketLaunchIcon />,
      isActive: startsWithRoute(path, "/console/app"),
    },
    {
      title: "WhatsApp",
      url: localizePathname({
        pathname: "/console/whatsapp/dashboard",
        locale,
      }),
      icon: <WhatsappLogoIcon />,
      isActive: startsWithRoute(path, "/console/whatsapp"),
    },
    {
      title: "VPN",
      url: localizePathname({ pathname: "/console/vpn/dashboard", locale }),
      icon: <GlobeIcon />,
      isActive: startsWithRoute(path, "/console/vpn"),
    },
    {
      title: "AI Studio",
      url: localizePathname({ pathname: "/console/ai/agents", locale }),
      icon: <BrainIcon />,
      isActive: startsWithRoute(path, "/console/ai"),
    },
  ],
})

const buildPortalNavMain = (
  pathname: string,
  locale: AppLocale
): AppSidebarNavItem[] => [
  {
    title: "App Hosting",
    url: localizePathname({ pathname: "/portal/app", locale }),
    icon: <RocketLaunchIcon />,
    isActive: startsWithRoute(pathname, "/portal/app"),
  },
  {
    title: "VPN",
    url: localizePathname({ pathname: "/portal/vpn", locale }),
    icon: <GlobeIcon />,
    isActive: startsWithRoute(pathname, "/portal/vpn"),
  },
  {
    title: "WhatsApp",
    url: localizePathname({ pathname: "/portal/whatsapp", locale }),
    icon: <WhatsappLogoIcon />,
    isActive: startsWithRoute(pathname, "/portal/whatsapp"),
  },
  {
    title: "Systems",
    url: localizePathname({ pathname: "/portal/system/cronjobs", locale }),
    icon: <ClockIcon />,
    isActive:
      startsWithRoute(pathname, "/portal/system") ||
      startsWithRoute(pathname, "/portal/settings/emails") ||
      startsWithRoute(pathname, "/portal/ai") ||
      startsWithRoute(pathname, "/portal/storage"),
  },
]

const buildNavSecondary = (input: {
  surface: AppSidebarSurface
  currentPathname: string
}) => {
  const { locale } = getLocaleFromPathname(input.currentPathname)
  const activeLocale = locale ?? defaultLocale

  const items: NavSecondaryItem[] = [
    {
      title: "Documentation",
      url: localizePathname({ pathname: "/docs", locale: activeLocale }),
      icon: <BookOpenIcon />,
    },
    {
      title: "API Reference",
      url: input.surface === "portal" ? "/api/admin/docs" : "/api/openapi",
      icon: <BookOpenIcon />,
    },
  ]

  return items
}

export const resolveSidebarSecondaryLinks = ({
  surface,
  currentPathname,
}: {
  surface: AppSidebarSurface
  currentPathname: string
}) => buildNavSecondary({ surface, currentPathname })

const buildPortalProjects = (
  pathname: string,
  locale: AppLocale
): AppSidebarProject[] => [
  {
    name: "Billing",
    url: localizePathname({ pathname: "/portal/billing", locale }),
    icon: <WalletIcon />,
    isActive: startsWithRoute(pathname, "/portal/billing"),
  },
  {
    name: "Support Tickets",
    url: localizePathname({ pathname: "/portal/support-tickets", locale }),
    icon: <LifebuoyIcon />,
    isActive: startsWithRoute(pathname, "/portal/support-tickets"),
  },
]

export const resolveSidebarMenu = ({
  surface,
  pathname,
  locale,
  tab,
  isGraduated,
}: {
  surface: AppSidebarSurface
  pathname: string
  locale: AppLocale
  tab?: string
  isGraduated?: boolean
}): {
  navMain: AppSidebarNavItem[]
  projects: AppSidebarProject[]
  navMainLabel: string
  navHeader?: React.ReactNode
} => {
  if (surface === "portal") {
    const matchingContext = PORTAL_CONTEXTS.find((cfg) => cfg.matches(pathname))
    if (matchingContext) {
      return {
        navMain: matchingContext.getNavMain(pathname, locale, tab, isGraduated),
        projects: matchingContext.getProjects(pathname, locale),
        navMainLabel: matchingContext.navMainLabel,
        navHeader: matchingContext.getNavHeader?.(pathname, locale),
      }
    }
    return {
      navMain: buildPortalNavMain(pathname, locale),
      projects: buildPortalProjects(pathname, locale),
      navMainLabel: "Platform",
    }
  }

  if (surface !== "console") {
    return {
      navMain: buildPortalNavMain(pathname, locale),
      projects: buildPortalProjects(pathname, locale),
      navMainLabel: "Platform",
    }
  }

  const matchingContext = CONSOLE_CONTEXTS.find((cfg) => cfg.matches(pathname))
  if (matchingContext) {
    return {
      navMain: matchingContext.getNavMain(
        pathname,
        locale,
        undefined,
        isGraduated
      ),
      projects: matchingContext.getProjects(pathname, locale),
      navMainLabel: matchingContext.navMainLabel,
    }
  }

  return {
    ...getHubMenu(pathname, locale),
    navMainLabel: "Platform",
  }
}

export function AppSidebar({
  surface,
  user,
  organization,
  ...props
}: AppSidebarProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { locale, pathnameWithoutLocale } = getLocaleFromPathname(pathname)

  const isGraduatedStore = useWhatsAppOnboardingStore((s) => s.isGraduated)
  const syncFromStorage = useWhatsAppOnboardingStore((s) => s.syncFromStorage)

  React.useEffect(() => {
    syncFromStorage()
  }, [syncFromStorage])

  const isWhatsappGraduated = isGraduatedStore

  const { navMain, projects, navMainLabel, navHeader } = resolveSidebarMenu({
    surface,
    pathname: pathnameWithoutLocale,
    locale: locale ?? defaultLocale,
    tab: searchParams.get("tab") ?? undefined,
    isGraduated: isWhatsappGraduated,
  })

  const navSecondary = resolveSidebarSecondaryLinks({
    surface,
    currentPathname: pathname,
  })

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <NavOrganization organization={organization} />
      </SidebarHeader>
      <SidebarContent>
        {navHeader && <div className="px-3 py-2">{navHeader}</div>}
        {projects.length > 0 && <NavProjects projects={projects} />}
        <NavMain items={navMain} label={navMainLabel} />
        <NavSecondary items={navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
