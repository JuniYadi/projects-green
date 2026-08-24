import { describe, expect, it, mock } from "bun:test"
import { render, screen } from "@testing-library/react"

mock.module("@/lib/eden", () => ({
  eden: {
    api: {
      "email-logs": {
        get: mock(() =>
          Promise.resolve({
            data: {
              items: [],
              pagination: {
                total: 0,
                page: 1,
                pageSize: 20,
                totalPages: 1,
              },
            },
            error: null,
          })
        ),
      },
    },
  },
}))

import { DeliveryLogsView } from "./delivery-logs-view"

describe("DeliveryLogsView", () => {
  it("renders delivery logs view with filter options", () => {
    render(<DeliveryLogsView />)
    expect(screen.getByPlaceholderText("Search recipient...")).toBeDefined()
  })
})
