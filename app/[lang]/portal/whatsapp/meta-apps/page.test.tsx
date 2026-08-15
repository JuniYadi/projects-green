import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { cleanup, render, waitFor } from "@testing-library/react"

const mockFetch = mock(
  async () =>
    new Response(JSON.stringify({ ok: false }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    })
)
global.fetch = mockFetch as unknown as typeof fetch

const { default: MetaAppsPage } = await import("./page")

describe("PortalWhatsAppMetaAppsPage", () => {
  beforeEach(() => {
    mockFetch.mockClear()
  })

  afterEach(() => {
    cleanup()
  })

  it("renders the inventory section access-denied state for unauthorized users", async () => {
    const view = render(<MetaAppsPage />)
    await waitFor(() => expect(view.getByText("Access denied")).toBeTruthy())
  })
})
