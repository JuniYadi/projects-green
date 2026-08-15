import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { cleanup, render, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { WhatsappOrganizationApiKeyInventory } from "./organization-api-key-inventory"

const mockFetch = mock(async (input: string | Request) => {
  const url = typeof input === "string" ? input : input.url
  if (url.includes("organization-api-keys")) {
    return new Response(
      JSON.stringify({
        ok: true,
        data: [
          {
            organizationId: "org-1",
            organizationName: "Org One",
            status: "ACTIVE",
            keyId: "key-1",
            fingerprint: "fingerprint-1",
            generatedKeyCount: 2,
            createdAt: "2026-08-14T10:00:00.000Z",
            rotatedAt: null,
            revokedAt: null,
            lastUsedAt: null,
          },
        ],
        summary: {
          generatedKeyTotal: 2,
          organizationsWithActiveKey: 1,
          organizationsWithoutActiveKey: 1,
        },
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  }
  return new Response(JSON.stringify({ ok: false }), { status: 404 })
})

global.fetch = mockFetch as unknown as typeof fetch

describe("WhatsappOrganizationApiKeyInventory", () => {
  beforeEach(() => {
    mockFetch.mockClear()
  })

  afterEach(() => {
    cleanup()
  })

  it("renders totals and redacted inventory data without a raw secret", async () => {
    const view = render(<WhatsappOrganizationApiKeyInventory />)

    expect(await view.findByText("Org One")).toBeTruthy()
    expect(view.getByText("fingerprint-1")).toBeTruthy()
    expect(view.getByText("Generated keys")).toBeTruthy()
    expect(view.getAllByText("2").length).toBeGreaterThan(0)
    expect(view.queryByText("wa_live_raw-secret")).toBeNull()
  })

  it("sends filter values to the inventory endpoint", async () => {
    const user = userEvent.setup()
    const view = render(<WhatsappOrganizationApiKeyInventory />)
    const search = await view.findByRole("textbox", {
      name: "Search organization API keys",
    })
    await user.type(search, "Org One")
    await user.click(view.getByRole("button", { name: "Apply filters" }))

    await waitFor(() => {
      expect(
        mockFetch.mock.calls.some(([input]) => {
          const value = typeof input === "string" ? input : input.url
          return (
            new URL(value, "http://localhost").searchParams.get("q") ===
            "Org One"
          )
        })
      ).toBe(true)
    })
  })
})
