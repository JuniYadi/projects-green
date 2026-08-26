"use client"

import Link from "next/link"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import { CaretRightIcon, LockSimple } from "@phosphor-icons/react"

export function NavMain({
  items,
  label = "Platform",
}: {
  items: {
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
  }[]
  label?: string
}) {
  return (
    <SidebarGroup data-tour="sidebar-menu">
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          const hasActiveChild = item.items?.some((subItem) => subItem.isActive)
          const isActive = item.isActive || hasActiveChild

          return (
            <Collapsible
              key={`${item.title}-${isActive}`}
              asChild
              defaultOpen={isActive}
            >
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip={item.title}
                  isActive={isActive}
                  className={item.isLocked ? "opacity-60 grayscale" : ""}
                >
                  <Link
                    href={item.url}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2 truncate">
                      {item.icon}
                      <span className="truncate">{item.title}</span>
                    </div>
                    {item.isLocked && (
                      <LockSimple
                        className="ml-auto size-3.5 shrink-0 text-muted-foreground"
                        weight="bold"
                      />
                    )}
                  </Link>
                </SidebarMenuButton>
                {item.items?.length ? (
                  <>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuAction className="data-[state=open]:rotate-90">
                        <CaretRightIcon />
                        <span className="sr-only">Toggle</span>
                      </SidebarMenuAction>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {item.items?.map((subItem) => (
                          <SidebarMenuSubItem key={subItem.title}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={subItem.isActive}
                            >
                              <Link href={subItem.url}>
                                <span>{subItem.title}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </>
                ) : null}
              </SidebarMenuItem>
            </Collapsible>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}
