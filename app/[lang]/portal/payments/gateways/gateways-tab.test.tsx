import { describe, expect, it } from "bun:test"
import { fireEvent, render } from "@testing-library/react"

import { GatewaysTab } from "./gateways-tab"

describe("GatewaysTab", () => {
  it("opens a gateway creation form from the empty state action", async () => {
    globalThis.fetch = Object.assign(
      async () =>
        new Response(JSON.stringify({ ok: true, gateways: [] }), {
          status: 200,
        }),
      { preconnect: () => {} }
    ) as typeof fetch

    const view = render(<GatewaysTab />)

    fireEvent.click(await view.findByRole("button", { name: "Add Gateway" }))

    expect(view.getByLabelText("Gateway name")).toBeInTheDocument()
    expect(view.getByLabelText("Provider type")).toBeInTheDocument()
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
              gateways: [
                {
                  id: "gw-1",
                  name: "Duitku",
                  provider: "duitku",
                  status: "active",
                  createdAt: "2026-06-09",
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
    fireEvent.change(view.getByLabelText("Gateway name"), {
      target: { value: "Duitku Updated" },
    })
    fireEvent.click(view.getByRole("button", { name: "Save gateway" }))

    await view.findByText("Duitku")
    expect(
      calls.some(
        (call) =>
          call.url === "/api/portal/payments/gateways/gw-1" &&
          call.init?.method === "PUT"
      )
    ).toBe(true)
  })
})
