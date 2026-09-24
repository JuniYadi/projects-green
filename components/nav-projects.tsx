"use client"

import Link from "next/link"

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { useMessages } from "@/components/use-messages"

export function NavProjects({
  projects,
}: {
  projects: {
    name: string
    url?: string
    icon: React.ReactNode
    isActive?: boolean
    onClick?: () => void
  }[]
}) {
  const t = useMessages().sharedComponents.navProjects
  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>{t.label}</SidebarGroupLabel>
      <SidebarMenu>
        {projects.map((item) => (
          <SidebarMenuItem key={item.name}>
            {item.onClick ? (
              <SidebarMenuButton
                onClick={item.onClick}
                isActive={item.isActive}
              >
                {item.icon}
                <span>{item.name}</span>
              </SidebarMenuButton>
            ) : item.url ? (
              <SidebarMenuButton asChild isActive={item.isActive}>
                <Link href={item.url}>
                  {item.icon}
                  <span>{item.name}</span>
                </Link>
              </SidebarMenuButton>
            ) : (
              <SidebarMenuButton isActive={item.isActive}>
                {item.icon}
                <span>{item.name}</span>
              </SidebarMenuButton>
            )}
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
