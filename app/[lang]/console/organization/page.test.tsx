import { beforeEach, describe, expect, it, mock } from "bun:test"
import { render } from "@testing-library/react"
import "@testing-library/jest-dom"

type MockAuthPayload = {
  user: {
    id: string
    firstName: string
    lastName: string
    email: string
    profilePictureUrl: string | null
  }
  organizationId: string | undefined
}

const mockWithAuth = mock(
  async (): Promise<MockAuthPayload> => ({
    user: {
      id: "user_123",
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@example.com",
      profilePictureUrl: null,
    },
    organizationId: "org_123",
  })
)

const mockResolveFirstActiveOrganization = mock(
  async (_userId: string): Promise<{ organizationId: string } | null> => null
)
const mockRedirect = mock((url: string) => {
  throw new Error(`REDIRECT:${url}`)
})

mock.module("@workos-inc/authkit-nextjs", () => ({
  withAuth: mockWithAuth,
}))

mock.module("next/navigation", () => ({
  redirect: mockRedirect,
  useParams: () => ({ lang: "en" }),
}))

mock.module("@/lib/whatsapp/resolvers", () => ({
  resolveFirstActiveOrganization: mockResolveFirstActiveOrganization,
}))

mock.module("./organization-tabs", () => ({
  OrganizationTabs: ({ organizationId }: { organizationId: string }) => (
    <div data-testid="org-tabs">Tabs for {organizationId}</div>
  ),
}))

describe("ConsoleOrganizationPage", () => {
  beforeEach(() => {
    mockWithAuth.mockClear()
    mockResolveFirstActiveOrganization.mockClear()
    mockRedirect.mockClear()
    mockWithAuth.mockImplementation(async () => ({
      user: {
        id: "user_123",
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@example.com",
        profilePictureUrl: null,
      },
      organizationId: "org_123",
    }))
  })

  it("renders organization tabs when organizationId is present", async () => {
    const pageModule = await import("./page")
    const ui = await pageModule.default({
      params: Promise.resolve({ lang: "en" }),
    })

    const view = render(ui)
    expect(view.getByTestId("org-tabs")).toHaveTextContent("Tabs for org_123")
  })

  it("auto-resolves first active organization when organizationId is missing in session", async () => {
    mockWithAuth.mockImplementation(async () => ({
      user: {
        id: "user_invited",
        firstName: "Invited",
        lastName: "User",
        email: "invited@example.com",
        profilePictureUrl: null,
      },
      organizationId: undefined,
    }))

    mockResolveFirstActiveOrganization.mockResolvedValueOnce({
      organizationId: "org_fallback_456",
    })

    const pageModule = await import("./page")
    const ui = await pageModule.default({
      params: Promise.resolve({ lang: "en" }),
    })

    const view = render(ui)
    expect(mockResolveFirstActiveOrganization).toHaveBeenCalledWith(
      "user_invited"
    )
    expect(view.getByTestId("org-tabs")).toHaveTextContent(
      "Tabs for org_fallback_456"
    )
  })

  it("redirects to onboarding when user has no organization memberships", async () => {
    mockWithAuth.mockImplementation(async () => ({
      user: {
        id: "user_empty",
        firstName: "Empty",
        lastName: "User",
        email: "empty@example.com",
        profilePictureUrl: null,
      },
      organizationId: undefined,
    }))

    mockResolveFirstActiveOrganization.mockResolvedValueOnce(null)

    const pageModule = await import("./page")

    await expect(
      pageModule.default({
        params: Promise.resolve({ lang: "en" }),
      })
    ).rejects.toThrow(
      "REDIRECT:/en/onboarding/organization?next=%2Fen%2Fconsole%2Forganization"
    )
  })
})
