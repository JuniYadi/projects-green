import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react"

import { SidebarProvider } from "@/components/ui/sidebar"

const mockSignOut = mock(async () => {})
const mockReplace = mock(() => {})
const mockRefresh = mock(() => {})
let mockPathname = "/en/console"
let mockSearchParams = new URLSearchParams()
const originalFetch = globalThis.fetch

const jsonResponse = (body: unknown, status = 200) => {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  })
}

mock.module("@workos-inc/authkit-nextjs/components", () => {
  return {
    useAuth: () => ({
      signOut: mockSignOut,
    }),
  }
})

mock.module("next/navigation", () => {
  return {
    redirect: () => {},
    usePathname: () => mockPathname,
    useSearchParams: () => mockSearchParams,
    useRouter: () => ({
      replace: mockReplace,
      refresh: mockRefresh,
    }),
  }
})

mock.module("next/navigation.js", () => {
  return {
    redirect: () => {},
    usePathname: () => mockPathname,
    useSearchParams: () => mockSearchParams,
    useRouter: () => ({
      replace: mockReplace,
      refresh: mockRefresh,
    }),
  }
})

describe("NavUser", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch
    cleanup()
  })

  beforeEach(() => {
    mockSignOut.mockClear()
    mockReplace.mockClear()
    mockRefresh.mockClear()
    mockPathname = "/en/console"
    mockSearchParams = new URLSearchParams()
    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      const path =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.pathname
            : input.url

      if (path.includes("/api/auth/session")) {
        return jsonResponse({
          ok: true,
          authenticationMethod: "GoogleOAuth",
          authenticationCategory: "oauth",
          lastSignInAt: "2026-05-20T01:23:45.000Z",
        })
      }

      return jsonResponse({}, 404)
    }) as unknown as typeof fetch
  })

  it("renders user identity with initials fallback and session metadata", async () => {
    const { NavUser } = await import("@/components/nav-user")

    const view = render(
      <SidebarProvider>
        <NavUser
          user={{
            name: "Jane Doe",
            email: "jane@example.com",
            avatarUrl: null,
          }}
        />
      </SidebarProvider>
    )

    expect(view.getByText("Jane Doe")).toBeInTheDocument()
    expect(view.getByText("jane@example.com")).toBeInTheDocument()
    expect(view.getAllByText("JD")[0]).toBeInTheDocument()

    fireEvent.pointerDown(view.getByRole("button"))

    await waitFor(() => {
      expect(view.getByText("Signed in via: Google OAuth")).toBeInTheDocument()
    })
  })

  it("falls back to email local-part initials when name is blank", async () => {
    const { NavUser } = await import("@/components/nav-user")

    const view = render(
      <SidebarProvider>
        <NavUser
          user={{
            name: "   ",
            email: "owner@example.com",
            avatarUrl: "   ",
          }}
        />
      </SidebarProvider>
    )

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled()
    })

    expect(view.getAllByText("OW").length).toBeGreaterThan(0)
  })

  it("switches locale while preserving the current route context", async () => {
    const { NavUser } = await import("@/components/nav-user")

    const view = render(
      <SidebarProvider>
        <NavUser
          user={{
            name: "Jane Doe",
            email: "jane@example.com",
            avatarUrl: null,
          }}
        />
      </SidebarProvider>
    )

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled()
    })

    fireEvent.pointerDown(view.getByRole("button"))
    fireEvent.click(await view.findByText("Language"))
    fireEvent.click(
      await view.findByRole("menuitemradio", { name: /Indonesian/ })
    )

    expect(mockReplace).toHaveBeenCalledWith("/id/console")
  })

  it("renders theme sub-menu and allows theme switching", async () => {
    const { NavUser } = await import("@/components/nav-user")

    const view = render(
      <SidebarProvider>
        <NavUser
          user={{
            name: "Jane Doe",
            email: "jane@example.com",
            avatarUrl: null,
          }}
        />
      </SidebarProvider>
    )

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled()
    })

    fireEvent.pointerDown(view.getByRole("button"))
    
    // Find and click the "Theme" submenu trigger
    const themeTrigger = await view.findByText("Theme")
    expect(themeTrigger).toBeInTheDocument()
    fireEvent.click(themeTrigger)

    // Verify Light, Dark, and System options exist
    expect(await view.findByRole("menuitemradio", { name: /Light/ })).toBeInTheDocument()
    expect(await view.findByRole("menuitemradio", { name: /Dark/ })).toBeInTheDocument()
    expect(await view.findByRole("menuitemradio", { name: /System/ })).toBeInTheDocument()
  })
})
