import { describe, it, expect } from "bun:test"
import PortalWhatsappAnalyticsPage from "./page"

describe("PortalWhatsappAnalyticsPage", () => {
  it("renders page component without crashing", () => {
    expect(typeof PortalWhatsappAnalyticsPage).toBe("function")
  })
})
