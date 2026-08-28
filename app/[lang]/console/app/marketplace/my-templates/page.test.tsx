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

const mockGetWorkspace = mock(() => Promise.resolve({ data: mockTemplates }))
const mockSubmitReview = mock(() => Promise.resolve({ data: { ok: true } }))

mock.module("@/lib/eden", () => ({
  eden: {
    api: {
      templates: Object.assign(
        mock(() => Promise.resolve({ data: mockTemplates })),
        {
          workspace: { get: mockGetWorkspace },
          "tpl-1": { "submit-review": { post: mockSubmitReview } },
          "tpl-2": { "submit-review": { post: mockSubmitReview } },
        }
      ),
    },
  },
}))
mock.module("@/lib/billing-client", () => ({
  getCatalogProduct: mock(async () => ({
    ok: true,
    product: {
      code: "APP_HOSTING",
      name: "App Hosting",
      plans: [
        {
          id: "plan_starter",
          code: "STARTER",
          name: "Starter",
          offers: [
            {
              id: "off_1",
              billingPeriod: "MONTHLY",
              periodPrice: "15000",
              currency: "IDR",
            },
          ],
        },
      ],
    },
  })),
}))

mock.module("next/navigation", () => ({
  useParams: mock(() => ({ lang: "en" })),
  useRouter: mock(() => ({ push: mockPush })),
}))

import MyTemplatesPage from "./page"

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
  })

  afterEach(() => {
    cleanup()
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
    render(<MyTemplatesPage />)

    await waitFor(() => {
      expect(screen.getByText("Submit Review")).toBeDefined()
    })

    fireEvent.click(screen.getByText("Submit Review"))

    await waitFor(() => {
      expect(mockSubmitReview).toHaveBeenCalled()
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
