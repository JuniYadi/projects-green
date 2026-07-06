"use client"

import * as React from "react"
import { usePathname } from "next/navigation"

import { localizePathname, getLocaleFromPathname } from "@/lib/i18n/pathname"
import { NavMain } from "@/components/nav-main"
import { NavProjects } from "@/components/nav-projects"
import { NavOrganization } from "@/components/nav-organization"
import { NavSecondary } from "@/components/nav-secondary"
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
  ChartLineIcon,
  CreditCardIcon,
  CrosshairIcon,
  DeviceMobileIcon,
  GaugeIcon,
  GlobeIcon,
  HardDrivesIcon,
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
} from "@phosphor-icons/react"
import { defaultLocale, type AppLocale } from "@/lib/i18n/config"

const PAYMENTS_PATH = "/portal/payments"

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

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  surface: AppSidebarSurface
  user: AppSidebarUser
  organization: AppSidebarOrganization
}

type AppSidebarNavItem = {
  title: string
  url: string
  icon: React.ReactNode
  isActive?: boolean
  items?: {
    title: string
    url: string
    isActive?: boolean
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
  getNavMain: (pathname: string, locale: AppLocale) => AppSidebarNavItem[]
  navMainLabel: string
}

const PORTAL_CONTEXTS: SidebarContextConfig[] = [
  {
    context: "admin",
    matches: (path) => startsWithRoute(path, "/portal/admin"),
    navMainLabel: "Admin",
    getProjects: (path, locale) => [
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
    context: "billing",
    matches: (path) => startsWithRoute(path, "/portal/billing"),
    navMainLabel: "Billing",
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
        url: localizePathname({ pathname: "/portal/billing", locale }),
        icon: <GaugeIcon />,
        isActive: path === localizePathname({ pathname: "/portal/billing", locale }),
      },
      {
        title: "Invoices",
        url: localizePathname({ pathname: "/portal/billing/invoices", locale }),
        icon: <ReceiptIcon />,
        isActive: startsWithRoute(path, "/portal/billing/invoices"),
      },
      {
        title: "Transactions",
        url: localizePathname({ pathname: "/portal/billing/transactions", locale }),
        icon: <ListMagnifyingGlassIcon />,
        isActive: startsWithRoute(path, "/portal/billing/transactions"),
      },
      {
        title: "Vouchers",
        url: localizePathname({ pathname: "/portal/billing/voucher", locale }),
        icon: <TicketIcon />,
        isActive: startsWithRoute(path, "/portal/billing/voucher"),
      },
      {
        title: "Usage",
        url: localizePathname({ pathname: "/portal/billing/usage", locale }),
        icon: <ChartLineIcon />,
        isActive: startsWithRoute(path, "/portal/billing/usage"),
      },
      {
        title: "Payments",
        url: localizePathname({ pathname: "/portal/billing/payments", locale }),
        icon: <CreditCardIcon />,
        isActive: startsWithRoute(path, "/portal/billing/payments"),
      },
      {
        title: "Subscription",
        url: localizePathname({ pathname: "/portal/billing/subscription", locale }),
        icon: <WalletIcon />,
        isActive: startsWithRoute(path, "/portal/billing/subscription"),
      },
      {
        title: "Create Order",
        url: localizePathname({ pathname: "/portal/billing/subscription/create", locale }),
        icon: <PackageIcon />,
        isActive: startsWithRoute(path, "/portal/billing/subscription/create"),
      },
      {
        title: "Top Up",
        url: localizePathname({ pathname: "/portal/billing/topup", locale }),
        icon: <CrosshairIcon />,
        isActive: startsWithRoute(path, "/portal/billing/topup"),
      },
      {
        title: "Settings",
        url: localizePathname({ pathname: "/portal/billing/settings", locale }),
        icon: <GearSixIcon />,
        isActive: startsWithRoute(path, "/portal/billing/settings"),
      },
      {
        title: "Payment Methods",
        url: localizePathname({ pathname: "/portal/billing/payment-methods", locale }),
        icon: <ShieldCheckIcon />,
        isActive: startsWithRoute(path, "/portal/billing/payment-methods"),
      },
      {
        title: "Contacts",
        url: localizePathname({ pathname: "/portal/billing/contacts", locale }),
        icon: <BookOpenIcon />,
        isActive: startsWithRoute(path, "/portal/billing/contacts"),
      },
      {
        title: "Alerts",
        url: localizePathname({ pathname: "/portal/billing/alerts", locale }),
        icon: <Lightning />,
        isActive: startsWithRoute(path, "/portal/billing/alerts"),
      },
      {
        title: "Audit Logs",
        url: localizePathname({ pathname: "/portal/billing/audit-logs", locale }),
        icon: <ListMagnifyingGlassIcon />,
        isActive: startsWithRoute(path, "/portal/billing/audit-logs"),
      },
    ],
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
        title: "Packages",
        url: localizePathname({ pathname: "/portal/vpn/packages", locale }),
        icon: <PackageIcon />,
        isActive: startsWithRoute(path, "/portal/vpn/packages"),
      },
      {
        title: "Subscriptions",
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
        title: "Deploy",
        url: localizePathname({ pathname: "/portal/app/deploy", locale }),
        icon: <RocketLaunchIcon />,
        isActive: path === "/portal/app/deploy",
      },
      {
        title: "Manage",
        url: localizePathname({ pathname: "/portal/app/manage", locale }),
        icon: <GaugeIcon />,
        isActive: startsWithRoute(path, "/portal/app/manage"),
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
        title: "Events",
        url: localizePathname({
          pathname: "/portal/app/events/github",
          locale,
        }),
        icon: <ListMagnifyingGlassIcon />,
        isActive: startsWithRoute(path, "/portal/app/events"),
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
    context: "applications",
    matches: (path) => startsWithRoute(path, "/console/app"),
    navMainLabel: "Applications",
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
        title: "Manage",
        url: localizePathname({ pathname: "/console/app/manage", locale }),
        icon: <GaugeIcon />,
        isActive: startsWithRoute(path, "/console/app/manage"),
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
    getNavMain: (path, locale) => [
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
        title: "Usage",
        url: localizePathname({
          pathname: "/console/whatsapp/usage",
          locale,
        }),
        icon: <ChartLineIcon />,
        isActive: startsWithRoute(path, "/console/whatsapp/usage"),
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
      },
    ],
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
        title: "Order Package",
        url: localizePathname({
          pathname: "/console/vpn/order",
          locale,
        }),
        icon: <PackageIcon />,
        isActive: startsWithRoute(path, "/console/vpn/order"),
      },
      {
        title: "My Subscriptions",
        url: localizePathname({
          pathname: "/console/vpn/subscriptions",
          locale,
        }),
        icon: <ReceiptIcon />,
        isActive: startsWithRoute(path, "/console/vpn/subscriptions"),
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
      title: "Applications",
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

  ],
})

const buildPortalNavMain = (
  pathname: string,
  locale: AppLocale
): AppSidebarNavItem[] => [
  {
    title: "My Organization",
    url: localizePathname({ pathname: "/portal/settings/members", locale }),
    icon: <GearSixIcon />,
    isActive: startsWithRoute(pathname, "/portal/settings"),
    items: [
      {
        title: "Members",
        url: localizePathname({ pathname: "/portal/settings/members", locale }),
        isActive: startsWithRoute(pathname, "/portal/settings/members"),
      },
      {
        title: "Invitations",
        url: localizePathname({
          pathname: "/portal/settings/invitations",
          locale,
        }),
        isActive: startsWithRoute(pathname, "/portal/settings/invitations"),
      },
      {
        title: "Ownership",
        url: localizePathname({
          pathname: "/portal/settings/ownership",
          locale,
        }),
        isActive: startsWithRoute(pathname, "/portal/settings/ownership"),
      },
      {
        title: "Email Templates",
        url: localizePathname({
          pathname: "/portal/settings/emails",
          locale,
        }),
        isActive: startsWithRoute(pathname, "/portal/settings/emails"),
      },
    ],
  },
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
]

const buildNavSecondary = (input: {
  surface: AppSidebarSurface
  currentPathname: string
}) => {
  const items: {
    title: string
    url: string
    icon: React.ReactNode
  }[] = [
    {
      title: "Support",
      url: "#",
      icon: <LifebuoyIcon />,
    },
    {
      title: "Feedback",
      url: "#",
      icon: <PaperPlaneTiltIcon />,
    },
  ]

  if (input.surface === "console") {
    items.unshift({
      title: "Thunder AI Help",
      url: `${input.currentPathname}?kb=1`,
      icon: <Lightning />,
    })
  }

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
    name: "Payments",
    url: localizePathname({ pathname: PAYMENTS_PATH, locale }),
    icon: <CreditCardIcon />,
    isActive: startsWithRoute(pathname, PAYMENTS_PATH),
  },
  {
    name: "Invoices",
    url: localizePathname({ pathname: "/portal/invoices", locale }),
    icon: <ReceiptIcon />,
    isActive: startsWithRoute(pathname, "/portal/invoices"),
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
}: {
  surface: AppSidebarSurface
  pathname: string
  locale: AppLocale
}): {
  navMain: AppSidebarNavItem[]
  projects: AppSidebarProject[]
  navMainLabel: string
} => {
  if (surface === "portal") {
    const matchingContext = PORTAL_CONTEXTS.find((cfg) => cfg.matches(pathname))
    if (matchingContext) {
      return {
        navMain: matchingContext.getNavMain(pathname, locale),
        projects: matchingContext.getProjects(pathname, locale),
        navMainLabel: matchingContext.navMainLabel,
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
      navMain: matchingContext.getNavMain(pathname, locale),
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
  const { locale, pathnameWithoutLocale } = getLocaleFromPathname(pathname)

  const { navMain, projects, navMainLabel } = resolveSidebarMenu({
    surface,
    pathname: pathnameWithoutLocale,
    locale: locale ?? defaultLocale,
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
        <NavProjects projects={projects} />
        <NavMain items={navMain} label={navMainLabel} />
        <NavSecondary items={navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
