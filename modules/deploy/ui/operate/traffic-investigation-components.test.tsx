import { describe, it, expect, mock, afterEach } from "bun:test"
import { render, cleanup } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import React from "react"
import { TrafficIpReviewDrawer } from "./traffic-ip-review-drawer"
import { TrafficIpInvestigationTable } from "./traffic-ip-investigation-table"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
})

function renderWithQuery(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  )
}

describe("Traffic Investigation Components", () => {
  afterEach(() => {
    cleanup()
  })

  describe("TrafficIpReviewDrawer", () => {
    it("renders drawer header and loading state when open", () => {
      const view = renderWithQuery(
        <TrafficIpReviewDrawer
          appSlug="my-app"
          ip="10.0.0.1"
          open={true}
          onOpenChange={mock()}
        />
      )
      expect(view.getByText("10.0.0.1")).toBeTruthy()
    })
  })

  describe("TrafficIpInvestigationTable", () => {
    it("renders search input, filter pills, and table controls", () => {
      const view = renderWithQuery(
        <TrafficIpInvestigationTable appSlug="my-app" onReviewIp={mock()} />
      )
      expect(view.getByPlaceholderText("Cari alamat IP...")).toBeTruthy()
      expect(view.getByText("Semua Sinyal")).toBeTruthy()
      expect(view.getByText("Manusia")).toBeTruthy()
      expect(view.getByText("Bot / Scanner")).toBeTruthy()
    })
  })
})
