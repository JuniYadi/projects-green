import { describe, expect, it } from "bun:test"
import { fireEvent, render } from "@testing-library/react"

import {
  SIDEBAR_COOKIE_NAME,
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
                        <SidebarMenuSubButton href="#">
                          Sub item
                        </SidebarMenuSubButton>
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
    expect(
      view.container.querySelector('[data-slot="sidebar-trigger"]')
    ).toBeInTheDocument()
    expect(
      view.container.querySelector('[data-slot="sidebar-rail"]')
    ).toBeInTheDocument()
    expect(
      view.container.querySelector('[data-slot="sidebar"]')
    ).toHaveAttribute("data-state", "expanded")

    const trigger = view.container.querySelector(
      '[data-slot="sidebar-trigger"]'
    ) as HTMLButtonElement
    fireEvent.click(trigger)

    expect(
      view.container.querySelector('[data-slot="sidebar"]')
    ).toHaveAttribute("data-state", "collapsed")
  })

  it("renders non-collapsible mode", () => {
    const view = render(
      <SidebarProvider>
        <Sidebar collapsible="none">Static</Sidebar>
      </SidebarProvider>
    )

    expect(view.getByText("Static")).toBeInTheDocument()
  })

  it("keeps inset sidebar visible after collapsing to icon mode", () => {
    window.innerWidth = 1280

    const view = render(
      <TooltipProvider>
        <SidebarProvider>
          <Sidebar variant="inset" collapsible="icon">
            <SidebarContent>Inset</SidebarContent>
          </Sidebar>
          <SidebarTrigger />
        </SidebarProvider>
      </TooltipProvider>
    )

    const sidebar = view.container.querySelector('[data-slot="sidebar"]')
    const container = view.container.querySelector(
      '[data-slot="sidebar-container"]'
    )
    expect(sidebar).toHaveAttribute("data-state", "expanded")
    expect(container).toBeInTheDocument()

    const trigger = view.container.querySelector(
      '[data-slot="sidebar-trigger"]'
    ) as HTMLButtonElement
    fireEvent.click(trigger)

    expect(sidebar).toHaveAttribute("data-state", "collapsed")
    expect(sidebar).toHaveAttribute("data-collapsible", "icon")
    expect(container).toBeInTheDocument()
    expect(container?.className).toContain("border-sidebar-border")
  })

  it("exports SIDEBAR_COOKIE_NAME and updates cookie on toggle", () => {
    // @ts-expect-error happy-dom specific API
    window.happyDOM?.setURL("https://example.com/")
    expect(SIDEBAR_COOKIE_NAME).toBe("sidebar_state")

    const view = render(
      <TooltipProvider>
        <SidebarProvider defaultOpen>
          <Sidebar>
            <SidebarContent>Content</SidebarContent>
          </Sidebar>
          <SidebarTrigger />
        </SidebarProvider>
      </TooltipProvider>
    )

    const trigger = view.container.querySelector(
      '[data-slot="sidebar-trigger"]'
    ) as HTMLButtonElement

    fireEvent.click(trigger)
    expect(document.cookie).toContain("sidebar_state=false")

    fireEvent.click(trigger)
    expect(document.cookie).toContain("sidebar_state=true")
  })

  it("auto-collapses on tablet viewports when no cookie is set", () => {
    // @ts-expect-error happy-dom specific API
    window.happyDOM?.setURL("https://example.com/")
    // Clear cookie
    document.cookie =
      "sidebar_state=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT"
    window.innerWidth = 800

    const view = render(
      <TooltipProvider>
        <SidebarProvider defaultOpen>
          <Sidebar>
            <SidebarContent>Tablet Content</SidebarContent>
          </Sidebar>
        </SidebarProvider>
      </TooltipProvider>
    )

    const sidebar = view.container.querySelector('[data-slot="sidebar"]')
    expect(sidebar?.getAttribute("data-state")).toBe("collapsed")
  })

  it("respects explicit cookie preference on tablet viewports", () => {
    // @ts-expect-error happy-dom specific API
    window.happyDOM?.setURL("https://example.com/")
    document.cookie = "sidebar_state=true; path=/;"
    window.innerWidth = 800

    const view = render(
      <TooltipProvider>
        <SidebarProvider defaultOpen>
          <Sidebar>
            <SidebarContent>Tablet Content</SidebarContent>
          </Sidebar>
        </SidebarProvider>
      </TooltipProvider>
    )

    const sidebar = view.container.querySelector('[data-slot="sidebar"]')
    expect(sidebar?.getAttribute("data-state")).toBe("expanded")
  })

  it("auto-collapses when resizing from desktop to tablet width without cookie", () => {
    // @ts-expect-error happy-dom specific API
    window.happyDOM?.setURL("https://example.com/")
    document.cookie =
      "sidebar_state=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT"
    window.innerWidth = 1280

    const view = render(
      <TooltipProvider>
        <SidebarProvider defaultOpen>
          <Sidebar>
            <SidebarContent>Content</SidebarContent>
          </Sidebar>
        </SidebarProvider>
      </TooltipProvider>
    )

    const sidebar = view.container.querySelector('[data-slot="sidebar"]')
    expect(sidebar?.getAttribute("data-state")).toBe("expanded")

    window.innerWidth = 800
    fireEvent(window, new Event("resize"))

    expect(sidebar?.getAttribute("data-state")).toBe("collapsed")
  })

  it("preserves explicit cookie preference when resizing to tablet width", () => {
    // @ts-expect-error happy-dom specific API
    window.happyDOM?.setURL("https://example.com/")
    document.cookie = "sidebar_state=true; path=/;"
    window.innerWidth = 1280

    const view = render(
      <TooltipProvider>
        <SidebarProvider defaultOpen>
          <Sidebar>
            <SidebarContent>Content</SidebarContent>
          </Sidebar>
        </SidebarProvider>
      </TooltipProvider>
    )

    const sidebar = view.container.querySelector('[data-slot="sidebar"]')
    expect(sidebar?.getAttribute("data-state")).toBe("expanded")

    window.innerWidth = 800
    fireEvent(window, new Event("resize"))

    expect(sidebar?.getAttribute("data-state")).toBe("expanded")
  })
})
