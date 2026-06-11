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
  CreditCardIcon,
  CrosshairIcon,
  GaugeIcon,
  GlobeIcon,
  LifebuoyIcon,
  Lightning,
  PaperPlaneTiltIcon,
  PulseIcon,
  ReceiptIcon,
  RocketLaunchIcon,
  Ticket,
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
      {
        title: "Vouchers",
        url: localizePathname({
          pathname: "/portal/admin/vouchers",
          locale,
        }),
        icon: <Ticket />,
        isActive: startsWithRoute(path, "/portal/admin/vouchers"),
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
        icon: <RocketLaunchIcon />,
        isActive: path === "/portal/app",
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
        url: localizePathname({ pathname: "/portal/app/events/github", locale }),
        icon: <PulseIcon />,
        isActive: startsWithRoute(path, "/portal/app/events"),
        items: [
          {
            title: "GitHub",
            url: localizePathname({ pathname: "/portal/app/events/github", locale }),
            isActive: startsWithRoute(path, "/portal/app/events/github"),
          },
        ],
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
        title: "VPN Clients",
        url: localizePathname({ pathname: "/portal/vpn", locale }),
        icon: <GlobeIcon />,
        isActive: path === "/portal/vpn",
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
    ],
  },
]


const CONSOLE_CONTEXTS: SidebarContextConfig[] = [
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
        title: "VPN Access",
        url: localizePathname({ pathname: "/console/vpn", locale }),
        icon: <GlobeIcon />,
        isActive: path === "/console/vpn",
      },
    ],
  },
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
        title: "Contacts",
        url: localizePathname({
          pathname: "/console/whatsapp/contacts",
          locale,
        }),
        icon: <BookOpenIcon />,
        isActive: startsWithRoute(path, "/console/whatsapp/contacts"),
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
      url: localizePathname({ pathname: "/console/whatsapp/dashboard", locale }),
      icon: <WhatsappLogoIcon />,
      isActive: startsWithRoute(path, "/console/whatsapp"),
    },
    // Organization is intentionally omitted here. It lives in the top-left
    // organization switcher dropdown (NavOrganization) to keep a single point
    // of access and avoid duplicating the entry in the sidebar.
  ],
})

const getConsoleHubMenu = (path: string, locale: AppLocale) => {
  const menu = getHubMenu(path, locale)
  menu.projects.splice(2, 0, {
    name: "VPN",
    url: localizePathname({ pathname: "/console/vpn", locale }),
    icon: <GlobeIcon />,
    isActive: path === "/console/vpn",
  })
  return menu
}

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
    title: "WhatsApp",
    url: localizePathname({ pathname: "/portal/whatsapp/devices", locale }),
    icon: <WhatsappLogoIcon />,
    isActive: startsWithRoute(pathname, "/portal/whatsapp"),
  },
  {
    title: "VPN",
    url: localizePathname({ pathname: "/portal/vpn", locale }),
    icon: <GlobeIcon />,
    isActive: startsWithRoute(pathname, "/portal/vpn"),
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
    name: "VPN",
    url: localizePathname({ pathname: "/portal/vpn", locale }),
    icon: <GlobeIcon />,
    isActive: startsWithRoute(pathname, "/portal/vpn"),
  },
  {
    name: "Invoices",
    url: localizePathname({ pathname: "/portal/invoices", locale }),
    icon: <ReceiptIcon />,
    isActive: startsWithRoute(pathname, "/portal/invoices"),
  },
  {
    name: "Documentation",
    url: localizePathname({
      pathname: "/portal/documentations",
      locale,
    }),
    icon: <BookOpenIcon />,
    isActive: startsWithRoute(pathname, "/portal/documentations"),
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
    const matchingContext = PORTAL_CONTEXTS.find((cfg) =>
      cfg.matches(pathname)
    )
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
    ...getConsoleHubMenu(pathname, locale),
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
