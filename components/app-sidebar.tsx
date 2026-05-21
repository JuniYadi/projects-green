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
  GaugeIcon,
  LifebuoyIcon,
  PaperPlaneTiltIcon,
  RocketLaunchIcon,
} from "@phosphor-icons/react"
import { defaultLocale, type AppLocale } from "@/lib/i18n/config"

const startsWithRoute = (pathname: string, route: string) =>
  pathname === route || pathname.startsWith(`${route}/`)

export type AppSidebarSurface = "console" | "portal"

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

const buildConsoleNavMain = (
  pathname: string,
  locale: AppLocale
): AppSidebarNavItem[] => [
  {
    title: "Applications",
    url: localizePathname({ pathname: "/console/app", locale }),
    icon: <RocketLaunchIcon />,
    isActive: startsWithRoute(pathname, "/console/app"),
    items: [
      {
        title: "Deploy",
        url: localizePathname({ pathname: "/console/app/deploy", locale }),
        isActive: pathname === "/console/app/deploy",
      },
      {
        title: "Manage",
        url: localizePathname({
          pathname: "/console/app/manage",
          locale,
        }),
        isActive: startsWithRoute(pathname, "/console/app/manage"),
      },
      {
        title: "Monitoring",
        url: localizePathname({
          pathname: "/console/app/monitoring",
          locale,
        }),
        isActive: startsWithRoute(pathname, "/console/app/monitoring"),
      },
    ],
  },
]

const buildPortalNavMain = (
  pathname: string,
  locale: AppLocale
): AppSidebarNavItem[] => [
  {
    title: "Documentation",
    url: localizePathname({ pathname: "/portal/documentations", locale }),
    icon: <BookOpenIcon />,
    isActive: startsWithRoute(pathname, "/portal/documentations"),
    items: [
      {
        title: "Registry",
        url: localizePathname({ pathname: "/portal/documentations", locale }),
        isActive: startsWithRoute(pathname, "/portal/documentations"),
      },
    ],
  },
]

const navSecondary = [
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

const buildConsoleProjects = (
  pathname: string,
  locale: AppLocale
): AppSidebarProject[] => [
  {
    name: "Overview",
    url: localizePathname({ pathname: "/console", locale }),
    icon: <GaugeIcon />,
    isActive: pathname === "/console",
  },
  {
    name: "Invoices",
    url: localizePathname({ pathname: "/console/invoices", locale }),
    icon: <BookOpenIcon />,
    isActive: startsWithRoute(pathname, "/console/invoices"),
  },
  {
    name: "Support Tickets",
    url: localizePathname({ pathname: "/console/support-tickets", locale }),
    icon: <LifebuoyIcon />,
    isActive: startsWithRoute(pathname, "/console/support-tickets"),
  },
]

const buildPortalProjects = (
  pathname: string,
  locale: AppLocale
): AppSidebarProject[] => [
  {
    name: "Documentation",
    url: localizePathname({ pathname: "/portal/documentations", locale }),
    icon: <BookOpenIcon />,
    isActive: startsWithRoute(pathname, "/portal/documentations"),
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
}) => {
  return {
    navMain:
      surface === "console"
        ? buildConsoleNavMain(pathname, locale)
        : buildPortalNavMain(pathname, locale),
    projects:
      surface === "console"
        ? buildConsoleProjects(pathname, locale)
        : buildPortalProjects(pathname, locale),
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
  const { navMain, projects } = resolveSidebarMenu({
    surface,
    pathname: pathnameWithoutLocale,
    locale: locale ?? defaultLocale,
  })

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <NavOrganization organization={organization} />
      </SidebarHeader>
      <SidebarContent>
        <NavProjects projects={projects} />
        <NavMain items={navMain} />
        <NavSecondary items={navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
