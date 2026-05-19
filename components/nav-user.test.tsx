import { beforeEach, describe, expect, it, mock } from "bun:test"
import { render } from "@testing-library/react"

import { SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"

const mockSignOut = mock(async () => {})

mock.module("@workos-inc/authkit-nextjs/components", () => {
  return {
    useAuth: () => ({ signOut: mockSignOut }),
  }
})

describe("NavUser", () => {
  beforeEach(() => {
    mockSignOut.mockClear()
  })

  it("renders user profile identity with initials fallback when avatar is missing", async () => {
    const { NavUser } = await import("@/components/nav-user")

    const view = render(
      <SidebarProvider>
        <TooltipProvider>
          <NavUser
            user={{
              name: "Jane Doe",
              email: "jane@example.com",
              avatarUrl: null,
            }}
          />
        </TooltipProvider>
      </SidebarProvider>
    )

    expect(view.getByText("Jane Doe")).toBeTruthy()
    expect(view.getByText("jane@example.com")).toBeTruthy()
    expect(view.getAllByText("JD").length).toBeGreaterThan(0)
  })

  it("falls back to email local-part initials when name is blank", async () => {
    const { NavUser } = await import("@/components/nav-user")

    const view = render(
      <SidebarProvider>
        <TooltipProvider>
          <NavUser
            user={{
              name: "   ",
              email: "owner@example.com",
              avatarUrl: "   ",
            }}
          />
        </TooltipProvider>
      </SidebarProvider>
    )

    expect(view.getAllByText("OW").length).toBeGreaterThan(0)
  })
})
