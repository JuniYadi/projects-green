"use client"

import * as React from "react"
import { usePathname } from "next/navigation"

import { NavMain } from "@/components/nav-main"
import { NavProjects } from "@/components/nav-projects"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import {
  BookOpenIcon,
  ChartPieIcon,
  CropIcon,
  GaugeIcon,
  LifebuoyIcon,
  MapTrifoldIcon,
  PaperPlaneTiltIcon,
  RocketLaunchIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react"

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
}

const buildConsoleNavMain = (pathname: string): AppSidebarNavItem[] => [
  {
    title: "Console",
    url: "/console",
    icon: <GaugeIcon />,
    isActive: startsWithRoute(pathname, "/console"),
    items: [
      {
        title: "Overview",
        url: "/console",
        isActive: pathname === "/console",
      },
      {
        title: "Deploy",
        url: "/console/app/deploy",
        isActive: startsWithRoute(pathname, "/console/app/deploy"),
      },
      {
        title: "Tenant Management",
        url: "/console/organization",
        isActive: startsWithRoute(pathname, "/console/organization"),
      },
    ],
  },
]

const buildPortalNavMain = (pathname: string): AppSidebarNavItem[] => [
  {
    title: "Documentation",
    url: "/portal/documentations",
    icon: <BookOpenIcon />,
    isActive: startsWithRoute(pathname, "/portal/documentations"),
    items: [
      {
        title: "Registry",
        url: "/portal/documentations",
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

const consoleProjects: AppSidebarProject[] = [
  {
    name: "Deployments",
    url: "/console/app/deploy",
    icon: <RocketLaunchIcon />,
  },
  {
    name: "Tenant Management",
    url: "/console/organization",
    icon: <UsersThreeIcon />,
  },
  {
    name: "Analytics",
    url: "#",
    icon: <ChartPieIcon />,
  },
  {
    name: "Design Engineering",
    url: "#",
    icon: <CropIcon />,
  },
  {
    name: "Travel",
    url: "#",
    icon: <MapTrifoldIcon />,
  },
]

const portalProjects: AppSidebarProject[] = [
  {
    name: "Documentation",
    url: "/portal/documentations",
    icon: <BookOpenIcon />,
  },
  {
    name: "Analytics",
    url: "#",
    icon: <ChartPieIcon />,
  },
  {
    name: "Design Engineering",
    url: "#",
    icon: <CropIcon />,
  },
  {
    name: "Travel",
    url: "#",
    icon: <MapTrifoldIcon />,
  },
]

export const resolveSidebarMenu = ({
  surface,
  pathname,
}: {
  surface: AppSidebarSurface
  pathname: string
}) => {
  return {
    navMain:
      surface === "console"
        ? buildConsoleNavMain(pathname)
        : buildPortalNavMain(pathname),
    projects: surface === "console" ? consoleProjects : portalProjects,
  }
}

export function AppSidebar({
  surface,
  user,
  organization,
  ...props
}: AppSidebarProps) {
  const pathname = usePathname()
  const { navMain, projects } = resolveSidebarMenu({
    surface,
    pathname,
  })

  const organizationName =
    organization.name?.trim() || organization.id?.trim() || "No organization"
  const organizationMeta = organization.id
    ? "Organization"
    : "No active organization"
  const orgInitials =
    organizationName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "NO"

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href="#">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <span className="text-xs font-semibold">{orgInitials}</span>
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">
                    {organizationName}
                  </span>
                  <span className="truncate text-xs">{organizationMeta}</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
        <NavProjects projects={projects} />
        <NavSecondary items={navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
