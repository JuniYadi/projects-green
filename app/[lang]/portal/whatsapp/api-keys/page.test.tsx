import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test"
import { cleanup, render, waitFor } from "@testing-library/react"

const mockOverview = mock(async () => ({
  month: [],
  today: [],
  cost: { byCategory: [] },
}))

const mockDevicesList = mock(async () => ({ devices: [] }))

const mockFetch = mock(async (_input: string | Request) => {
  return new Response(JSON.stringify({ ok: false }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  })
})

mock.module("@/lib/api/whatsapp-client", () => ({
  whatsappClient: {
    usage: { overview: mockOverview },
    devices: { list: mockDevicesList },
  },
}))

const originalFetch = global.fetch
global.fetch = mockFetch as unknown as typeof fetch

const { default: DashboardPage } = await import("../page")
const { default: ApiKeysPage } = await import("./page")

const inventoryResponse = () =>
  new Response(
    JSON.stringify({
      ok: true,
      data: [
        {
          organizationId: "org-1",
          organizationName: "Org One",
          status: "ACTIVE",
          keyId: "key-1",
          fingerprint: "fingerprint-1",
          generatedKeyCount: 1,
          createdAt: "2026-08-14T10:00:00.000Z",
          rotatedAt: null,
          revokedAt: null,
          lastUsedAt: null,
        },
      ],
      summary: {
        generatedKeyTotal: 1,
        organizationsWithActiveKey: 1,
        organizationsWithoutActiveKey: 0,
      },
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  )

describe("PortalWhatsAppApiKeysPage", () => {
  beforeEach(() => {
    cleanup()
    mockOverview.mockClear()
    mockOverview.mockResolvedValue({
      month: [],
      today: [],
      cost: { byCategory: [] },
    })
    mockDevicesList.mockClear()
    mockDevicesList.mockResolvedValue({ devices: [] })
    mockFetch.mockClear()
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ ok: false }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      })
    )
  })

  afterAll(() => {
    global.fetch = originalFetch
  })

  it("renders the existing inventory on its dedicated route", async () => {
    mockFetch.mockResolvedValueOnce(inventoryResponse())

    const view = render(<ApiKeysPage />)

    await waitFor(() => expect(view.getByText("Org One")).toBeTruthy())
    expect(view.getByText("Organization API keys")).toBeTruthy()
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/admin/whatsapp/organization-api-keys?")
    )
  })

  it("shows an explicit access-denied state for unauthorized users", async () => {
    const view = render(<ApiKeysPage />)

    await waitFor(() => expect(view.getByText("Access denied")).toBeTruthy())
    expect(
      view.getByText("Only super-admins can view organization API keys.")
    ).toBeTruthy()
  })

  it("does not render or request inventory data on the dashboard", async () => {
    const view = render(<DashboardPage />)

    await waitFor(() => expect(mockOverview).toHaveBeenCalledTimes(1))
    expect(
      view.getByRole("heading", { name: "WhatsApp Dashboard" })
    ).toBeTruthy()
    expect(view.queryByText("Organization API keys")).toBeNull()
    expect(
      mockFetch.mock.calls.some(([input]) => {
        const value = typeof input === "string" ? input : input.url
        return value.includes("organization-api-keys")
      })
    ).toBe(false)
  })
})
