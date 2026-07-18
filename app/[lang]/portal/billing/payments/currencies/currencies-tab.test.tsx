import { describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"

import { CurrenciesTab } from "./currencies-tab"

describe("CurrenciesTab", () => {
  it("renders currencies in a table", async () => {
    globalThis.fetch = Object.assign(
      async () =>
        new Response(
          JSON.stringify([
            {
              id: "cur-1",
              code: "USD",
              name: "US Dollar",
              symbol: "$",
              isBase: true,
              ratePerBase: 1,
              minTopup: 10,
              maxTopup: 1000,
              isActive: true,
              sortOrder: 1,
            },
          ]),
          { status: 200 }
        ),
      { preconnect: () => {} }
    ) as typeof fetch

    const view = render(<CurrenciesTab />)

    expect(await view.findByRole("table")).toBeInTheDocument()
    expect(
      view.getByRole("columnheader", { name: /currency/i })
    ).toBeInTheDocument()
    expect(view.getByLabelText("Filter currencies...")).toBeInTheDocument()
  })
})
