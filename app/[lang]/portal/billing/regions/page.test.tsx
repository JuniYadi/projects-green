import { describe, it, expect, mock, beforeEach } from "bun:test"
import { render, screen, waitFor, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import PortalBillingRegionsPage from "./page"

const MOCK_REGIONS = [
  {
    id: "reg-sg",
    code: "SINGAPORE",
    name: "Singapore",
    country: "SG",
    flag: "🇸🇬",
    isActive: true,
    _count: {
      appHostingClusters: 2,
      pricings: 1,
    },
  },
  {
    id: "reg-id",
    code: "INDONESIA",
    name: "Indonesia",
    country: "ID",
    flag: "🇮🇩",
    isActive: false,
    _count: {
      appHostingClusters: 0,
      pricings: 0,
    },
  },
]

describe("PortalBillingRegionsPage", () => {
  beforeEach(() => {
    cleanup()
    globalThis.fetch = mock(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        const method = init?.method || "GET"

        if (url.includes("/api/admin/regions") && method === "GET") {
          return new Response(
            JSON.stringify({
              ok: true,
              data: MOCK_REGIONS,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        }

        if (url.includes("/api/admin/regions") && method === "POST") {
          const body = JSON.parse(String(init?.body || "{}"))
          return new Response(
            JSON.stringify({
              ok: true,
              data: { id: "reg-new", ...body },
            }),
            { status: 201, headers: { "Content-Type": "application/json" } }
          )
        }

        if (url.includes("/api/admin/regions/reg-sg") && method === "PATCH") {
          const body = JSON.parse(String(init?.body || "{}"))
          return new Response(
            JSON.stringify({
              ok: true,
              data: { ...MOCK_REGIONS[0], ...body },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        }

        if (url.includes("/api/admin/regions/reg-id") && method === "DELETE") {
          return new Response(
            JSON.stringify({
              ok: true,
              data: MOCK_REGIONS[1],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        }

        return new Response(JSON.stringify({ ok: false }), { status: 404 })
      }
    ) as unknown as typeof fetch
  })

  it("renders the master regions table and lists regions", async () => {
    render(<PortalBillingRegionsPage />)

    expect(screen.getByText("Master Regions")).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText("Singapore")).toBeInTheDocument()
      expect(screen.getByText("Indonesia")).toBeInTheDocument()
      expect(screen.getByText("SINGAPORE")).toBeInTheDocument()
      expect(screen.getByText("INDONESIA")).toBeInTheDocument()
      expect(screen.getByText("2 clusters")).toBeInTheDocument()
      expect(screen.getByText("0 clusters")).toBeInTheDocument()
    })
  })

  it("opens add region dialog when clicking Add Region button", async () => {
    const user = userEvent.setup()
    render(<PortalBillingRegionsPage />)

    await waitFor(() => {
      expect(screen.getByText("Singapore")).toBeInTheDocument()
    })

    const addButton = screen.getByRole("button", { name: /add region/i })
    await user.click(addButton)

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Add Region" })
      ).toBeInTheDocument()
      expect(screen.getByLabelText(/Name/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Code/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Country/i)).toBeInTheDocument()
    })
  })

  it("opens edit dialog and populates data", async () => {
    const user = userEvent.setup()
    render(<PortalBillingRegionsPage />)

    await waitFor(() => {
      expect(screen.getByText("Singapore")).toBeInTheDocument()
    })

    const editButtons = screen.getAllByRole("button", {
      name: /edit singapore/i,
    })
    await user.click(editButtons[0]!)

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Edit Region" })
      ).toBeInTheDocument()
      const nameInput = screen.getByLabelText(/Name/i) as HTMLInputElement
      expect(nameInput.value).toBe("Singapore")
      const codeInput = screen.getByLabelText(/Code/i) as HTMLInputElement
      expect(codeInput.value).toBe("SINGAPORE")
    })
  })
})
