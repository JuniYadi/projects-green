import { describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"
import { BellIcon, LifebuoyIcon } from "@phosphor-icons/react"

import { NavSecondary } from "@/components/nav-secondary"
import { SidebarProvider } from "@/components/ui/sidebar"

describe("NavSecondary", () => {
  it("renders secondary navigation links", () => {
    const view = render(
      <SidebarProvider>
        <NavSecondary
          className="mt-auto"
          items={[
            {
              title: "Support",
              url: "/support",
              icon: <LifebuoyIcon />,
            },
            {
              title: "Notifications",
              url: "/notifications",
              icon: <BellIcon />,
            },
          ]}
        />
      </SidebarProvider>
    )

    expect(
      view.getByRole("link", { name: "Support" }).getAttribute("href")
    ).toBe("/support")
    expect(
      view.getByRole("link", { name: "Notifications" }).getAttribute("href")
    ).toBe("/notifications")
    expect(view.container.querySelector(".mt-auto")).toBeTruthy()
  })
  it("renders nested items with active parent and active child", () => {
    const view = render(
      <SidebarProvider>
        <NavSecondary
          items={[
            {
              title: "Settings",
              url: "/settings",
              icon: <LifebuoyIcon />,
              isActive: true,
              items: [
                {
                  title: "Email Templates",
                  url: "/settings/emails",
                  isActive: false,
                },
                {
                  title: "Email Logs",
                  url: "/settings/emails/logs",
                  isActive: true,
                },
              ],
            },
          ]}
        />
      </SidebarProvider>
    )

    // Active parent link preserved
    expect(
      view.getByRole("link", { name: "Settings" }).getAttribute("href")
    ).toBe("/settings")

    // Active child nested link preserved
    expect(
      view.getByRole("link", { name: "Email Logs" }).getAttribute("href")
    ).toBe("/settings/emails/logs")

    // Nested child link preserved
    expect(
      view.getByRole("link", { name: "Email Templates" }).getAttribute("href")
    ).toBe("/settings/emails")
  })
})
