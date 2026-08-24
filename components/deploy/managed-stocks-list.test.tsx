import { describe, expect, it, mock } from "bun:test"
import { render, screen } from "@testing-library/react"

mock.module("@/lib/eden", () => ({
  eden: {
    api: {
      admin: {
        "managed-stocks": {
          get: mock(async () => ({ data: { ok: true, data: [] } })),
          import: {
            post: mock(async () => ({ data: { ok: true, id: "stock-1" } })),
          },
        },
        clusters: {
          get: mock(async () => ({ data: { ok: true, data: [] } })),
        },
      },
    },
  },
}))

// Test boundary: dynamic import required after mock.module setup
const { ManagedStocksList } = await import("./managed-stocks-list")

describe("ManagedStocksList", () => {
  it("renders stock pool section and import button", () => {
    render(<ManagedStocksList />)
    expect(screen.getByText("Import Database Stock")).toBeTruthy()
    expect(screen.getByText("Import a stock slot")).toBeTruthy()
  })
})
