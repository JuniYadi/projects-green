import { describe, expect, it } from "bun:test"
import { fireEvent, render, waitFor } from "@testing-library/react"

import { GatewaysTab } from "./gateways-tab"

const MOCK_PROVIDERS_RESPONSE = {
  ok: true,
  data: [
    {
      value: "duitku",
      label: "Duitku",
      supportedCurrencies: ["IDR"],
      configFields: [
        { key: "merchantCode", label: "Merchant Code", type: "string", placeholder: "M12345", required: true },
        { key: "apiKey", label: "API Key", type: "password", placeholder: "Your Duitku API key", required: true },
        { key: "sandboxUrl", label: "Sandbox URL", type: "url", placeholder: "https://sandbox.duitku.com", required: false, defaultValue: "https://sandbox.duitku.com" },
        { key: "productionUrl", label: "Production URL", type: "url", placeholder: "https://api.duitku.com", required: false, defaultValue: "https://api.duitku.com" },
      ],
    },
    {
      value: "paypal",
      label: "PayPal",
      supportedCurrencies: ["USD"],
      configFields: [
        { key: "clientId", label: "Client ID", type: "string", placeholder: "Your PayPal REST app Client ID", required: true },
        { key: "clientSecret", label: "Client Secret", type: "password", placeholder: "Your PayPal REST app Secret", required: true },
        { key: "environment", label: "Environment", type: "select", placeholder: "", required: false, options: [{ label: "Sandbox", value: "sandbox" }, { label: "Production", value: "production" }] },
        { key: "webhookId", label: "Webhook ID", type: "string", placeholder: "Webhook verification ID from PayPal dashboard", required: false },
      ],
    },
  ],
}

const MOCK_GATEWAYS_RESPONSE_ONE = {
  ok: true,
  data: [
    {
      id: "gw-1",
      name: "Duitku",
      type: "duitku",
      isActive: true,
      isDefault: false,
      supportedCurrencies: ["IDR"],
      config: {},
    },
  ],
}

const MOCK_GATEWAYS_RESPONSE_EMPTY = { ok: true, data: [] }

/**
 * Mock global fetch to return gateways data for the list endpoint and
 * providers data for the providers endpoint. Handles POST/PUT/PATCH calls
 * that have an init argument (the gateways list fetch has no init).
 */
function mockFetch(
  gatewaysResponse: object = MOCK_GATEWAYS_RESPONSE_ONE,
): { calls: Array<{ url: string; init?: RequestInit }> } {
  const calls: Array<{ url: string; init?: RequestInit }> = []

  globalThis.fetch = Object.assign(
    async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = String(url)
      calls.push({ url: urlStr, init })

      // Providers endpoint
      if (urlStr === "/api/portal/payments/gateways/providers") {
        return new Response(JSON.stringify(MOCK_PROVIDERS_RESPONSE), { status: 200 })
      }

      // Mutations (POST, PUT, PATCH) — return success
      if (init) {
        return new Response(
          JSON.stringify({ ok: true, gateway: { id: "gw-1" } }),
          { status: 200 },
        )
      }

      // Gateways list
      return new Response(JSON.stringify(gatewaysResponse), { status: 200 })
    },
    { preconnect: () => {} },
  ) as typeof fetch

  return { calls }
}

describe("GatewaysTab", () => {
  it("renders gateways in a table", async () => {
    mockFetch()

    const view = render(<GatewaysTab />)

    expect(await view.findByRole("table")).toBeInTheDocument()
    expect(view.getByRole("columnheader", { name: /gateway/i })).toBeInTheDocument()
    expect(view.getByLabelText("Filter gateways...")).toBeInTheDocument()
  })

  it("opens a gateway creation form from the empty state action", async () => {
    mockFetch(MOCK_GATEWAYS_RESPONSE_EMPTY)

    const view = render(<GatewaysTab />)

    fireEvent.click(await view.findByRole("button", { name: "Add Gateway" }))

    expect(view.getByLabelText("Gateway name")).toBeInTheDocument()
    expect(view.getByText("Provider type")).toBeInTheDocument()
    expect(
      view.getByRole("button", { name: "Create gateway" })
    ).toBeInTheDocument()
  })

  it("opens a gateway configure form and submits updates", async () => {
    const { calls } = mockFetch()

    const view = render(<GatewaysTab />)
    fireEvent.click(await view.findByRole("button", { name: "Configure" }))
    const nameInput = view.getByDisplayValue("Duitku")
    fireEvent.change(nameInput, {
      target: { value: "Duitku Updated" },
    })
    fireEvent.click(view.getByRole("button", { name: "Save gateway" }))

    // After save, we expect to see the gateway list again with the name
    await view.findByRole("button", { name: "Add Gateway" })
    expect(
      calls.some(
        (call) =>
          call.url === "/api/portal/payments/gateways/gw-1" &&
          call.init?.method === "PUT",
      )
    ).toBe(true)
  })

  it("shows provider options from API in the create form", async () => {
    mockFetch(MOCK_GATEWAYS_RESPONSE_EMPTY)

    const view = render(<GatewaysTab />)

    fireEvent.click(await view.findByRole("button", { name: "Add Gateway" }))

    await waitFor(() => {
      expect(view.getByText("Duitku")).toBeInTheDocument()
    })
    expect(view.getByText("PayPal")).toBeInTheDocument()
  })
})
