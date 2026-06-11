import { describe, expect, it } from "bun:test"
import { fireEvent, render } from "@testing-library/react"

import { GatewaysTab } from "./gateways-tab"

describe("GatewaysTab", () => {
  it("renders gateways in a table", async () => {
    globalThis.fetch = Object.assign(
      async () =>
        new Response(
          JSON.stringify({
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
          }),
          { status: 200 }
        ),
      { preconnect: () => {} }
    ) as typeof fetch

    const view = render(<GatewaysTab />)

    expect(await view.findByRole("table")).toBeInTheDocument()
    expect(view.getByRole("columnheader", { name: /gateway/i })).toBeInTheDocument()
    expect(view.getByLabelText("Filter gateways...")).toBeInTheDocument()
  })

  it("opens a gateway creation form from the empty state action", async () => {
    globalThis.fetch = Object.assign(
      async () =>
        new Response(JSON.stringify({ ok: true, data: [] }), {
          status: 200,
        }),
      { preconnect: () => {} }
    ) as typeof fetch

    const view = render(<GatewaysTab />)

    fireEvent.click(await view.findByRole("button", { name: "Add Gateway" }))

    expect(view.getByLabelText("Gateway name")).toBeInTheDocument()
    expect(view.getByText("Provider type")).toBeInTheDocument()
    expect(
      view.getByRole("button", { name: "Create gateway" })
    ).toBeInTheDocument()
  })

  it("opens a gateway configure form and submits updates", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    globalThis.fetch = Object.assign(
      async (url: string | URL | Request, init?: RequestInit) => {
        calls.push({ url: String(url), init })
        if (!init) {
          return new Response(
            JSON.stringify({
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
            }),
            { status: 200 }
          )
        }
        return new Response(
          JSON.stringify({ ok: true, gateway: { id: "gw-1" } }),
          { status: 200 }
        )
      },
      { preconnect: () => {} }
    ) as typeof fetch

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
          call.init?.method === "PUT"
      )
    ).toBe(true)
  })
})
