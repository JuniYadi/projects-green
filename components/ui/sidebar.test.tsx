import { describe, expect, it } from "bun:test"
import { fireEvent, render } from "@testing-library/react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"

describe("Sidebar", () => {
  it("renders composed sidebar primitives and toggles state", () => {
    window.innerWidth = 1280

    const view = render(
      <TooltipProvider>
        <SidebarProvider defaultOpen>
          <Sidebar>
            <SidebarHeader>
              <SidebarInput placeholder="Filter" />
            </SidebarHeader>
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupLabel>Projects</SidebarGroupLabel>
                <SidebarGroupAction aria-label="Add">+</SidebarGroupAction>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton tooltip="Dashboard" isActive>
                        Dashboard
                      </SidebarMenuButton>
                      <SidebarMenuAction showOnHover aria-label="More">
                        ...
                      </SidebarMenuAction>
                      <SidebarMenuBadge>7</SidebarMenuBadge>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuSkeleton showIcon />
                    </SidebarMenuItem>
                    <SidebarMenuSub>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton href="#">Sub item</SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
            <SidebarSeparator />
            <SidebarFooter>Footer</SidebarFooter>
          </Sidebar>
          <SidebarRail />
          <SidebarTrigger />
          <SidebarInset>Main panel</SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
    )

    expect(view.getByText("Dashboard")).toBeInTheDocument()
    expect(view.getByText("Main panel")).toBeInTheDocument()
    expect(view.container.querySelector('[data-slot="sidebar-trigger"]')).toBeTruthy()
    expect(view.container.querySelector('[data-slot="sidebar-rail"]')).toBeTruthy()
    expect(view.container.querySelector('[data-slot="sidebar"]')).toHaveAttribute(
      "data-state",
      "expanded"
    )

    const trigger = view.container.querySelector(
      '[data-slot="sidebar-trigger"]'
    ) as HTMLButtonElement
    fireEvent.click(trigger)

    expect(view.container.querySelector('[data-slot="sidebar"]')).toHaveAttribute(
      "data-state",
      "collapsed"
    )
  })

  it("renders non-collapsible mode", () => {
    const view = render(
      <SidebarProvider>
        <Sidebar collapsible="none">Static</Sidebar>
      </SidebarProvider>
    )

    expect(view.getByText("Static")).toBeInTheDocument()
  })
})
