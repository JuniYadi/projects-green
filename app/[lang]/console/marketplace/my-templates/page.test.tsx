import "@/test/register"
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import {
  cleanup,
  render,
  screen,
  waitFor,
  fireEvent,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const mockPush = mock(() => {})

mock.module("next/navigation", () => ({
  useParams: mock(() => ({ lang: "en" })),
  useRouter: mock(() => ({ push: mockPush })),
}))

import MyTemplatesPage from "./page"

const originalFetch = globalThis.fetch

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })

const mockTemplates = [
  {
    id: "tpl-1",
    slug: "my-custom-saas",
    name: "My Custom SaaS",
    tagline: "High performance SaaS boilerplate",
    description: "Built with Node.js and PostgreSQL",
    category: "DEVELOPER_TOOLS",
    visibility: "PRIVATE",
    isOfficial: false,
    isFeatured: false,
    installCount: 5,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "tpl-2",
    slug: "public-starter",
    name: "Public Starter",
    tagline: "Publicly verified marketplace template",
    description: "Production ready stack",
    category: "AI",
    visibility: "PUBLIC",
    isOfficial: false,
    isFeatured: true,
    installCount: 142,
    createdAt: "2026-01-02T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
  },
]

describe("MyTemplatesPage", () => {
  beforeEach(() => {
    cleanup()
    mockPush.mockClear()
    globalThis.fetch = mock(() =>
      Promise.resolve(jsonResponse(mockTemplates))
    ) as unknown as typeof fetch
  })

  afterEach(() => {
    cleanup()
    globalThis.fetch = originalFetch
  })

  it("renders custom workspace templates list and badges", async () => {
    render(<MyTemplatesPage />)

    expect(screen.getByText("My Workspace Templates")).toBeDefined()

    await waitFor(() => {
      expect(screen.getByText("My Custom SaaS")).toBeDefined()
      expect(screen.getByText("Public Starter")).toBeDefined()
      expect(screen.getByText("PRIVATE")).toBeDefined()
      expect(screen.getByText("PUBLIC")).toBeDefined()
    })
  })

  it("filters templates by search term", async () => {
    render(<MyTemplatesPage />)
    const user = userEvent.setup()

    await waitFor(() => {
      expect(screen.getByText("My Custom SaaS")).toBeDefined()
    })

    const searchInput = screen.getByPlaceholderText(/Search custom templates/i)
    await user.type(searchInput, "Public")

    await waitFor(() => {
      expect(screen.queryByText("My Custom SaaS")).toBeNull()
      expect(screen.getByText("Public Starter")).toBeDefined()
    })
  })

  it("handles Submit Review action for PRIVATE templates", async () => {
    let reviewSubmittedId: string | null = null
    globalThis.fetch = mock((url) => {
      const urlString = String(url)
      if (urlString.includes("submit-review")) {
        const match = urlString.match(/templates\/([^/]+)\/submit-review/)
        reviewSubmittedId = match ? match[1] : null
        return Promise.resolve(jsonResponse({ success: true }))
      }
      return Promise.resolve(jsonResponse(mockTemplates))
    }) as unknown as typeof fetch

    render(<MyTemplatesPage />)

    await waitFor(() => {
      expect(screen.getByText("Submit Review")).toBeDefined()
    })

    fireEvent.click(screen.getByText("Submit Review"))

    await waitFor(() => {
      expect(reviewSubmittedId).toBe("tpl-1")
    })
  })

  it("navigates to Deploy page when clicking Deploy CTA", async () => {
    render(<MyTemplatesPage />)

    await waitFor(() => {
      const deployButtons = screen.getAllByRole("button", { name: /Deploy/i })
      expect(deployButtons.length).toBeGreaterThan(0)
      fireEvent.click(deployButtons[0])
    })

    expect(mockPush).toHaveBeenCalledWith(
      "/en/console/app/deploy?template=my-custom-saas"
    )
  })
})
